// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { Event, EventEmitter } from 'vscode';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { WrappedError } from '../../common/errors/errorUtils';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory, ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop, swallowExceptions } from '../../common/utils/misc';
import { IJupyterKernelSpec } from '../types';
import { findIndexOfConnectionFile } from './kernelFinder';
import { PythonKernelLauncherDaemon } from './kernelLauncherDaemon';
import { IKernelConnection, IKernelProcess, IPythonKernelDaemon, PythonKernelDiedError } from './types';

// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');

// Launches and disposes a kernel process given a kernelspec and a resource or python interpreter.
// Exposes connection information and the process itself.
export class KernelProcess implements IKernelProcess {
    public get ready(): Promise<void> {
        return this.readyPromise.promise;
    }
    public get exited(): Event<number | null> {
        return this.exitEvent.event;
    }
    public get kernelSpec(): Readonly<IJupyterKernelSpec> {
        return this.originalKernelSpec;
    }
    public get connection(): Readonly<IKernelConnection> {
        return this._connection;
    }
    private get isPythonKernel(): boolean {
        return this.kernelSpec.language.toLowerCase() === PYTHON_LANGUAGE.toLowerCase();
    }
    private _process?: ChildProcess;
    private connectionFile?: TemporaryFile;
    private readyPromise: Deferred<void>;
    private exitEvent: EventEmitter<number | null> = new EventEmitter<number | null>();
    private pythonKernelLauncher?: PythonKernelLauncherDaemon;
    private launchedOnce?: boolean;
    private kernelDaemon?: IPythonKernelDaemon;
    private readonly _kernelSpec: IJupyterKernelSpec;
    private readonly originalKernelSpec: IJupyterKernelSpec;
    constructor(
        private readonly pythonExecutionFactory: IPythonExecutionFactory,
        private readonly processExecutionFactory: IProcessServiceFactory,
        private readonly file: IFileSystem,
        private readonly _connection: IKernelConnection,
        kernelSpec: IJupyterKernelSpec,
        private readonly resource: Resource
    ) {
        this.originalKernelSpec = kernelSpec;
        this._kernelSpec = cloneDeep(kernelSpec);
        this.readyPromise = createDeferred<void>();
    }
    public async interrupt(): Promise<void> {
        if (this.kernelDaemon) {
            await this.kernelDaemon?.interrupt();
        }
    }
    public async launch(): Promise<void> {
        if (this.launchedOnce) {
            throw new Error('Kernel has already been launched.');
        }
        this.launchedOnce = true;

        await this.createAndUpdateConnectionFile();

        const exeObs = await this.launchAsObservable();

        sleep(1_000)
            .then(() => {
                this.readyPromise.resolve();
            })
            .catch(noop);

        let stdout = '';
        let stderr = '';
        exeObs.out.subscribe(
            (output) => {
                if (output.source === 'stderr') {
                    // Capture stderr, incase kernel doesn't start.
                    stderr += output.out;
                    traceWarning(`StdErr from Kernel Process ${output.out}`);
                } else {
                    stdout += output.out;
                    // Search for --existing this is the message that will indicate that our kernel is actually
                    // up and started from stdout
                    //    To connect another client to this kernel, use:
                    //    --existing /var/folders/q7/cn8fg6s94fgdcl0h7rbxldf00000gn/T/tmp-16231TOL2dgBoWET1.json
                    if (!this.readyPromise.completed && stdout.includes('--existing')) {
                        this.readyPromise.resolve();
                    }
                    traceInfo(output.out);
                }
            },
            (error) => {
                if (this.readyPromise.completed) {
                    traceInfo('KernelProcess Error', error, stderr);
                } else {
                    traceError('Kernel died before it could start', error, stderr);
                    // Include original error and stderr in error thrown.
                    const errorMessage = `${localize.DataScience.rawKernelProcessExitBeforeConnect()}. Error = ${error}, stderr = ${stderr}`;
                    const errorToWrap = error instanceof Error ? error : new Error(error);
                    this.readyPromise.reject(new WrappedError(errorMessage, errorToWrap));
                }
                if (error instanceof PythonKernelDiedError) {
                    traceInfo('KernelProcess Exit', `Exit - ${error.exitCode}`);
                    this.exitEvent.fire(error.exitCode);

                    // As the kernel has died, kill the daemon.
                    this.kernelDaemon?.kill().catch(noop); // NOSONAR
                }
            }
        );
    }

    public async dispose(): Promise<void> {
        if (this.kernelDaemon) {
            await this.kernelDaemon.kill().catch(noop);
            swallowExceptions(() => this.kernelDaemon?.dispose());
        }
        swallowExceptions(() => this._process?.kill());
        swallowExceptions(() => this.pythonKernelLauncher?.dispose());
        swallowExceptions(() => this.connectionFile?.dispose());
    }

    private async createAndUpdateConnectionFile() {
        this.connectionFile = await this.file.createTemporaryFile('.json');
        await this.file.writeFile(this.connectionFile.filePath, JSON.stringify(this._connection), {
            encoding: 'utf-8',
            flag: 'w'
        });

        // Update the args in the kernelspec to include the conenction file.
        const indexOfConnectionFile = findIndexOfConnectionFile(this._kernelSpec);
        if (indexOfConnectionFile === -1) {
            throw new Error(`Connection file not found in kernelspec json args, ${this._kernelSpec.argv.join(' ')}`);
        }
        this._kernelSpec.argv[indexOfConnectionFile] = this.connectionFile.filePath;
    }

    private async launchAsObservable() {
        let exeObs: ObservableExecutionResult<string>;
        if (this.isPythonKernel) {
            this.pythonKernelLauncher = new PythonKernelLauncherDaemon(this.pythonExecutionFactory);
            const { observableResult, daemon } = await this.pythonKernelLauncher.launch(
                this.resource,
                this._kernelSpec
            );
            this.kernelDaemon = daemon;
            exeObs = observableResult;
        } else {
            // First part of argument is always the executable.
            const executable = this._kernelSpec.argv[0];
            const executionService = await this.processExecutionFactory.create(this.resource);
            exeObs = executionService.execObservable(executable, this._kernelSpec.argv.slice(1), {
                env: this._kernelSpec.env
            });
        }

        if (exeObs.proc) {
            exeObs.proc!.on('exit', (exitCode) => {
                traceInfo('KernelProcess Exit', `Exit - ${exitCode}`);
                if (!this.readyPromise.completed) {
                    this.readyPromise.reject(new Error(localize.DataScience.rawKernelProcessExitBeforeConnect()));
                }
                this.exitEvent.fire(exitCode);
            });
        } else {
            traceInfo('KernelProcess failed to launch');
            this.readyPromise.reject(new Error(localize.DataScience.rawKernelProcessNotStarted()));
        }

        this._process = exeObs.proc;
        return exeObs;
    }
}
