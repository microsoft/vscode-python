// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { Event, EventEmitter } from 'vscode';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory, ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
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
    public get exited(): Event<{ exitCode?: number; reason?: string }> {
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
    private exitEvent = new EventEmitter<{ exitCode?: number; reason?: string }>();
    private pythonKernelLauncher?: PythonKernelLauncherDaemon;
    private launchedOnce?: boolean;
    private disposed?: boolean;
    private kernelDaemon?: IPythonKernelDaemon;
    private readonly _kernelSpec: IJupyterKernelSpec;
    private readonly originalKernelSpec: IJupyterKernelSpec;
    constructor(
        private readonly pythonExecutionFactory: IPythonExecutionFactory,
        private readonly processExecutionFactory: IProcessServiceFactory,
        private readonly file: IFileSystem,
        private readonly _connection: IKernelConnection,
        kernelSpec: IJupyterKernelSpec
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

        // Jupyter does the same thing. Spawn the kernel process and try to connect.
        // Unfortunately on windows it doesn't write to stdout such that we can read from it.
        // Hence we must assume it has started and try to connect to it.
        // If the kernel process dies we'll communiate that via the `exited` event.
        this.readyPromise.resolve();

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
                    traceInfo(`Kernel Output: ${stdout}`);
                }
            },
            (error) => {
                if (this.disposed) {
                    traceInfo('Kernel died', error, stderr);
                    return;
                }
                traceError('Kernel died', error, stderr);
                if (error instanceof PythonKernelDiedError) {
                    if (this.disposed) {
                        traceInfo('KernelProcess Exit', `Exit - ${error.exitCode}, ${error.reason}`, error);
                    } else {
                        traceError('KernelProcess Exit', `Exit - ${error.exitCode}, ${error.reason}`, error);
                    }
                    this.exitEvent.fire({ exitCode: error.exitCode, reason: error.reason || error.message });
                }
            }
        );
    }

    public async dispose(): Promise<void> {
        this.disposed = true;
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
        const resource: Resource = undefined;
        if (this.isPythonKernel) {
            this.pythonKernelLauncher = new PythonKernelLauncherDaemon(this.pythonExecutionFactory);
            const { observableResult, daemon } = await this.pythonKernelLauncher.launch(resource, this._kernelSpec);
            this.kernelDaemon = daemon;
            exeObs = observableResult;
        } else {
            // First part of argument is always the executable.
            const executable = this._kernelSpec.argv[0];
            const executionService = await this.processExecutionFactory.create(resource);
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
                this.exitEvent.fire({ exitCode: exitCode || undefined });
            });
        } else {
            traceInfo('KernelProcess failed to launch');
            this.readyPromise.reject(new Error(localize.DataScience.rawKernelProcessNotStarted()));
        }

        this._process = exeObs.proc;
        return exeObs;
    }
}
