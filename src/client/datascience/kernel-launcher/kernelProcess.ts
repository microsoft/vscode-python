// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { Event, EventEmitter } from 'vscode';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IProcessServiceFactory, ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { noop, swallowExceptions } from '../../common/utils/misc';
import { PythonInterpreter } from '../../interpreter/contracts';
import { IJupyterKernelSpec } from '../types';
import { findIndexOfConnectionFile } from './kernelFinder';
import { PythonKernelLauncherDaemon } from './kernelLauncherDaemon';
import { IKernelConnection, IKernelProcess, IPythonKernelDaemon, PythonKernelDiedError } from './types';

// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { KernelDaemonPool } from './kernelDaemonPool';

// Launches and disposes a kernel process given a kernelspec and a resource or python interpreter.
// Exposes connection information and the process itself.
export class KernelProcess implements IKernelProcess {
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
    private exitEvent = new EventEmitter<{ exitCode?: number; reason?: string }>();
    private pythonKernelLauncher?: PythonKernelLauncherDaemon;
    private launchedOnce?: boolean;
    private disposed?: boolean;
    private kernelDaemon?: IPythonKernelDaemon;
    private readonly _kernelSpec: IJupyterKernelSpec;
    private readonly originalKernelSpec: IJupyterKernelSpec;
    constructor(
        private readonly processExecutionFactory: IProcessServiceFactory,
        private readonly file: IFileSystem,
        private readonly daemonPool: KernelDaemonPool,
        private readonly _connection: IKernelConnection,
        kernelSpec: IJupyterKernelSpec,
        private readonly resource: Resource,
        private readonly interpreter?: PythonInterpreter
    ) {
        this.originalKernelSpec = kernelSpec;
        this._kernelSpec = cloneDeep(kernelSpec);
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
        if (this.isPythonKernel) {
            this.pythonKernelLauncher = new PythonKernelLauncherDaemon(this.daemonPool);
            const { observableOutput, daemon } = await this.pythonKernelLauncher.launch(
                this.resource,
                this._kernelSpec,
                this.interpreter
            );
            this.kernelDaemon = daemon;
            exeObs = observableOutput;
        } else {
            // First part of argument is always the executable.
            const executable = this._kernelSpec.argv[0];
            const executionService = await this.processExecutionFactory.create(this.resource);
            exeObs = executionService.execObservable(executable, this._kernelSpec.argv.slice(1), {
                env: this._kernelSpec.env
            });
        }

        if (exeObs.proc) {
            exeObs.proc.on('exit', (exitCode) => {
                traceInfo('KernelProcess Exit', `Exit - ${exitCode}`);
                this.exitEvent.fire({ exitCode: exitCode || undefined });
            });
        } else {
            throw new Error('KernelProcess failed to launch');
        }

        this._process = exeObs.proc;
        return exeObs;
    }
}
