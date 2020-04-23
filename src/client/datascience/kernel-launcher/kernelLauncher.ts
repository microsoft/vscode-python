// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter } from 'vscode';
import { traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { IJupyterKernelSpec } from '../types';
import { getKernelInterpreter } from './helpers';
import { findIndexOfConnectionFile } from './kernelFinder';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from './types';

// Launches and disposes a kernel process given a kernelspec and a resource or python interpreter.
// Exposes connection information and the process itself.
class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private connectionFile?: TemporaryFile;
    private readyPromise: Deferred<void>;
    private exitEvent: EventEmitter<number | null> = new EventEmitter<number | null>();

    // This promise is resolved when the launched process is ready to get JMP messages
    public get ready(): Promise<void> {
        return this.readyPromise.promise;
    }

    // This event is triggered if the process is exited
    public get exited(): Event<number | null> {
        return this.exitEvent.event;
    }

    public get kernelSpec(): Readonly<IJupyterKernelSpec> {
        return this._kernelSpec;
    }
    public get connection(): Readonly<IKernelConnection> {
        return this._connection;
    }

    constructor(
        private executionFactory: IPythonExecutionFactory,
        private interpreter: PythonInterpreter,
        private file: IFileSystem,
        private _connection: IKernelConnection,
        private _kernelSpec: IJupyterKernelSpec
    ) {
        this.readyPromise = createDeferred<void>();
    }

    public async launch(): Promise<void> {
        this.connectionFile = await this.file.createTemporaryFile('.json');
        const args = [...this._kernelSpec.argv];
        await this.file.writeFile(this.connectionFile.filePath, JSON.stringify(this._connection), {
            encoding: 'utf-8',
            flag: 'w'
        });

        // Inclide the conenction file in the arguments and remove the first argument which should be python
        const indexOfConnectionFile = findIndexOfConnectionFile(this._kernelSpec);
        if (indexOfConnectionFile === -1) {
            throw new Error(`Connection file not found in kernelspec json args, ${args.join(' ')}`);
        }
        args[indexOfConnectionFile] = this.connectionFile.filePath;

        const executionService = await this.executionFactory.createActivatedEnvironment({
            resource: undefined,
            interpreter: this.interpreter
        });

        // First part of argument is always the executable. We don't need it, so remove
        args.shift();

        // Then launch that process, also merging in the environment in the kernelspec
        const exeObs = executionService.execObservable(args, { extraVariables: this._kernelSpec.env });

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
        exeObs.out.subscribe((output) => {
            if (output.source === 'stderr') {
                traceWarning(`StdErr from Kernel Process ${output.out}`);
            } else {
                // Search for --existing this is the message that will indicate that our kernel is actually
                // up and started from stdout
                //    To connect another client to this kernel, use:
                //    --existing /var/folders/q7/cn8fg6s94fgdcl0h7rbxldf00000gn/T/tmp-16231TOL2dgBoWET1.json
                if (!this.readyPromise.completed && output.out.includes('--existing')) {
                    this.readyPromise.resolve();
                }
                traceInfo(output.out);
            }
        });
        this._process = exeObs.proc;
    }

    public dispose() {
        try {
            this._process?.kill();
            this.connectionFile?.dispose();
        } catch {
            noop();
        }
    }
}

// Launches and returns a kernel process given a resource or python interpreter.
// If the given interpreter is undefined, it will try to use the selected interpreter.
// If the selected interpreter doesn't have a kernel, it will find a kernel on disk and use that.
@injectable()
export class KernelLauncher implements IKernelLauncher {
    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IFileSystem) private file: IFileSystem
    ) {}

    @captureTelemetry(Telemetry.KernelLauncherPerf)
    public async launch(kernelSpec: IJupyterKernelSpec): Promise<IKernelProcess> {
        // Make sure that we have a valid interpreter with ipykernel installed
        const kernelInterpreter = await getKernelInterpreter(kernelSpec, this.interpreterService);

        const connection = await this.getKernelConnection();
        const kernelProcess = new KernelProcess(
            this.executionFactory,
            kernelInterpreter,
            this.file,
            connection,
            kernelSpec
        );
        await kernelProcess.launch();
        return kernelProcess;
    }

    private async getKernelConnection(): Promise<IKernelConnection> {
        const getPorts = promisify(portfinder.getPorts);
        const ports = await getPorts(5, { host: '127.0.0.1', port: 9000 });

        return {
            version: 1,
            key: uuid(),
            signature_scheme: 'hmac-sha256',
            transport: 'tcp',
            ip: '127.0.0.1',
            hb_port: ports[0],
            control_port: ports[1],
            shell_port: ports[2],
            stdin_port: ports[3],
            iopub_port: ports[4]
        };
    }
}
