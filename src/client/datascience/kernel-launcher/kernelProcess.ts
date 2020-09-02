// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import * as tcpPortUsed from 'tcp-port-used';
import * as tmp from 'tmp';
import { Event, EventEmitter } from 'vscode';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IProcessServiceFactory, ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { noop, swallowExceptions } from '../../common/utils/misc';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import {
    createDefaultKernelSpec,
    findIndexOfConnectionFile,
    isPythonKernelConnection
} from '../jupyter/kernels/helpers';
import { KernelSpecConnectionMetadata, PythonKernelConnectionMetadata } from '../jupyter/kernels/types';
import { IDataScienceFileSystem, IJupyterKernelSpec } from '../types';
import { KernelDaemonPool } from './kernelDaemonPool';
import { PythonKernelLauncherDaemon } from './kernelLauncherDaemon';
import { IKernelConnection, IKernelProcess, IPythonKernelDaemon, PythonKernelDiedError } from './types';

// Launches and disposes a kernel process given a kernelspec and a resource or python interpreter.
// Exposes connection information and the process itself.
export class KernelProcess implements IKernelProcess {
    public get exited(): Event<{ exitCode?: number; reason?: string }> {
        return this.exitEvent.event;
    }
    public get kernelConnectionMetadata(): Readonly<KernelSpecConnectionMetadata | PythonKernelConnectionMetadata> {
        return this._kernelConnectionMetadata;
    }
    public get connection(): Readonly<IKernelConnection> {
        return this._connection;
    }
    private get isPythonKernel(): boolean {
        return isPythonKernelConnection(this.kernelConnectionMetadata);
    }
    private _process?: ChildProcess;
    private exitEvent = new EventEmitter<{ exitCode?: number; reason?: string }>();
    private pythonKernelLauncher?: PythonKernelLauncherDaemon;
    private launchedOnce?: boolean;
    private disposed?: boolean;
    private kernelDaemon?: IPythonKernelDaemon;
    private connectionFile?: string;
    private _launchKernelSpec?: IJupyterKernelSpec;
    private readonly _kernelConnectionMetadata: Readonly<KernelSpecConnectionMetadata | PythonKernelConnectionMetadata>;
    constructor(
        private readonly processExecutionFactory: IProcessServiceFactory,
        private readonly daemonPool: KernelDaemonPool,
        private readonly _connection: IKernelConnection,
        kernelConnectionMetadata: KernelSpecConnectionMetadata | PythonKernelConnectionMetadata,
        private readonly fs: IDataScienceFileSystem,
        private readonly resource: Resource
    ) {
        this._kernelConnectionMetadata = kernelConnectionMetadata;
    }
    public async interrupt(): Promise<void> {
        if (this.kernelDaemon) {
            await this.kernelDaemon?.interrupt();
        }
    }

    @captureTelemetry(Telemetry.RawKernelProcessLaunch, undefined, true)
    public async launch(workingDirectory: string): Promise<void> {
        if (this.launchedOnce) {
            throw new Error('Kernel has already been launched.');
        }
        this.launchedOnce = true;

        // Update our connection arguments in the kernel spec
        await this.updateConnectionArgs();

        const exeObs = await this.launchAsObservable(workingDirectory);

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
                    if (this.disposed) {
                        return;
                    }
                    this.exitEvent.fire({ exitCode: error.exitCode, reason: error.reason || error.message });
                }
            }
        );

        // Don't return until our heartbeat channel is open for connections
        return this.waitForHeartbeat();
    }

    public async dispose(): Promise<void> {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (this.kernelDaemon) {
            await this.kernelDaemon.kill().catch(noop);
            swallowExceptions(() => this.kernelDaemon?.dispose());
        }
        swallowExceptions(() => {
            this._process?.kill(); // NOSONAR
            this.exitEvent.fire({});
        });
        swallowExceptions(() => this.pythonKernelLauncher?.dispose());
        swallowExceptions(async () => (this.connectionFile ? this.fs.deleteLocalFile(this.connectionFile) : noop()));
    }

    // Make sure that the heartbeat channel is open for connections
    private async waitForHeartbeat() {
        try {
            // Wait until the port is open for connection
            // First parameter is wait between retries, second parameter is total wait before error
            await tcpPortUsed.waitUntilUsed(this.connection.hb_port, 200, 30_000);
        } catch (error) {
            // Make sure to dispose if we never get a heartbeat
            this.dispose().ignoreErrors();
            traceError('Timed out waiting to get a heartbeat from kernel process.');
            throw new Error('Timed out waiting to get a heartbeat from kernel process.');
        }
    }

    private get launchKernelSpec(): IJupyterKernelSpec {
        if (this._launchKernelSpec) {
            return this._launchKernelSpec;
        }

        let kernelSpec = this._kernelConnectionMetadata.kernelSpec;
        // If there is no kernelspec & when launching a Python process, generate a dummy `kernelSpec`
        if (!kernelSpec && this._kernelConnectionMetadata.kind === 'startUsingPythonInterpreter') {
            kernelSpec = createDefaultKernelSpec(
                this._kernelConnectionMetadata.interpreter.displayName ||
                    this._kernelConnectionMetadata.interpreter.path
            );
        }
        // We always expect a kernel spec.
        if (!kernelSpec) {
            throw new Error('KernelSpec cannot be empty in KernelProcess.ts');
        }
        if (!Array.isArray(kernelSpec.argv)) {
            traceError('KernelSpec.argv in KernelPrcess is undefined');
            // tslint:disable-next-line: no-any
            this._launchKernelSpec = undefined;
        } else {
            // Copy our kernelspec and assign a new argv array
            this._launchKernelSpec = { ...kernelSpec, argv: [...kernelSpec.argv] };
        }
        return this._launchKernelSpec!;
    }

    // Instead of having to use a connection file update our local copy of the kernelspec to launch
    // directly with command line arguments
    private async updateConnectionArgs() {
        // First check to see if we have a kernelspec that expects a connection file,
        // Error if we don't have one. We expect '-f', '{connectionfile}' in our launch args
        const indexOfConnectionFile = findIndexOfConnectionFile(this.launchKernelSpec);

        // Technically if we don't have a kernelspec then index should already be -1, but the check here lets us avoid ? on the type
        if (indexOfConnectionFile === -1) {
            throw new Error(
                `Connection file not found in kernelspec json args, ${this.launchKernelSpec.argv.join(' ')}`
            );
        }

        if (
            this.isPythonKernel &&
            indexOfConnectionFile === 0 &&
            this.launchKernelSpec.argv[indexOfConnectionFile - 1] !== '-f'
        ) {
            throw new Error(
                `Connection file not found in kernelspec json args, ${this.launchKernelSpec.argv.join(' ')}`
            );
        }

        // Python kernels are special. Handle the extra arguments.
        if (this.isPythonKernel) {
            // Slice out -f and the connection file from the args
            this.launchKernelSpec.argv.splice(indexOfConnectionFile - 1, 2);

            // Add in our connection command line args
            this.launchKernelSpec.argv.push(...this.addPythonConnectionArgs());
        } else {
            // For other kernels, just write to the connection file.
            // Note: We have to dispose the temp file and recreate it because otherwise the file
            // system will hold onto the file with an open handle. THis doesn't work so well when
            // a different process tries to open it.
            const tempFile = await this.fs.createTemporaryLocalFile('.json');
            this.connectionFile = tempFile.filePath;
            await tempFile.dispose();
            await this.fs.writeLocalFile(this.connectionFile, JSON.stringify(this._connection));

            // Then replace the connection file argument with this file
            this.launchKernelSpec.argv[indexOfConnectionFile] = this.connectionFile;
        }
    }

    // Add the command line arguments
    private addPythonConnectionArgs(): string[] {
        const newConnectionArgs: string[] = [];

        newConnectionArgs.push(`--ip=${this._connection.ip}`);
        newConnectionArgs.push(`--stdin=${this._connection.stdin_port}`);
        newConnectionArgs.push(`--control=${this._connection.control_port}`);
        newConnectionArgs.push(`--hb=${this._connection.hb_port}`);
        newConnectionArgs.push(`--Session.signature_scheme="${this._connection.signature_scheme}"`);
        newConnectionArgs.push(`--Session.key=b"${this._connection.key}"`); // Note we need the 'b here at the start for a byte string
        newConnectionArgs.push(`--shell=${this._connection.shell_port}`);
        newConnectionArgs.push(`--transport="${this._connection.transport}"`);
        newConnectionArgs.push(`--iopub=${this._connection.iopub_port}`);

        // Turn this on if you get desparate. It can cause crashes though as the
        // logging code isn't that robust.
        // if (isTestExecution()) {
        //     // Extra logging for tests
        //     newConnectionArgs.push(`--log-level=10`);
        // }

        // We still put in the tmp name to make sure the kernel picks a valid connection file name. It won't read it as
        // we passed in the arguments, but it will use it as the file name so it doesn't clash with other kernels.
        newConnectionArgs.push(`--f=${tmp.tmpNameSync({ postfix: '.json' })}`);

        return newConnectionArgs;
    }

    private async launchAsObservable(workingDirectory: string) {
        let exeObs: ObservableExecutionResult<string> | undefined;
        if (this.isPythonKernel) {
            this.pythonKernelLauncher = new PythonKernelLauncherDaemon(this.daemonPool);
            const kernelDaemonLaunch = await this.pythonKernelLauncher.launch(
                this.resource,
                workingDirectory,
                this.launchKernelSpec,
                this._kernelConnectionMetadata.interpreter
            );

            this.kernelDaemon = kernelDaemonLaunch.daemon;
            exeObs = kernelDaemonLaunch.observableOutput;
        }

        // If we are not python just use the ProcessExecutionFactory
        if (!exeObs) {
            // First part of argument is always the executable.
            const executable = this.launchKernelSpec.argv[0];
            const executionService = await this.processExecutionFactory.create(this.resource);
            exeObs = executionService.execObservable(executable, this.launchKernelSpec.argv.slice(1), {
                env: this._kernelConnectionMetadata.kernelSpec?.env,
                cwd: workingDirectory
            });
        }

        if (exeObs && exeObs.proc) {
            exeObs.proc.on('exit', (exitCode) => {
                traceInfo('KernelProcess Exit', `Exit - ${exitCode}`);
                if (this.disposed) {
                    return;
                }
                this.exitEvent.fire({ exitCode: exitCode || undefined });
            });
            // tslint:disable-next-line: no-any
            exeObs.proc.stdout.on('data', (data: any) => {
                traceInfo(`KernelProcess output: ${data}`);
            });
            // tslint:disable-next-line: no-any
            exeObs.proc.stderr.on('data', (data: any) => {
                traceInfo(`KernelProcess error: ${data}`);
            });
        } else {
            throw new Error('KernelProcess failed to launch');
        }

        this._process = exeObs.proc;
        return exeObs;
    }
}
