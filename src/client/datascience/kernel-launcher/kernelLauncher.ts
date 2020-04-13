// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter } from 'vscode';
import { InterpreterUri } from '../../common/installer/types';
import { traceInfo } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { isResource, noop } from '../../common/utils/misc';
import { IJupyterKernelSpec } from '../types';
import { IKernelConnection, IKernelFinder, IKernelLauncher, IKernelProcess } from './types';

// Launches and disposes a kernel process given a kernelspec and a resource or python interpreter.
// Exposes connection information and the process itself.
class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private _connection?: IKernelConnection;
    private _kernelSpec?: IJupyterKernelSpec;
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

    public get kernelSpec(): IJupyterKernelSpec | undefined {
        return this._kernelSpec;
    }
    public get process(): ChildProcess | undefined {
        return this._process;
    }
    public get connection(): IKernelConnection | undefined {
        return this._connection;
    }

    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IFileSystem) private file: IFileSystem
    ) {
        this.readyPromise = createDeferred<void>();
    }

    public async launch(interpreter: InterpreterUri, kernelSpec: IJupyterKernelSpec): Promise<void> {
        this.connectionFile = await this.file.createTemporaryFile('.json');
        this._kernelSpec = kernelSpec;

        const resource = isResource(interpreter) ? interpreter : undefined;
        const pythonPath = isResource(interpreter) ? undefined : interpreter.path;

        const args = [...kernelSpec.argv];
        this._connection = await this.getKernelConnection();
        await this.file.writeFile(this.connectionFile.filePath, JSON.stringify(this._connection), {
            encoding: 'utf-8',
            flag: 'w'
        });

        // Inclide the conenction file in the arguments and remove the first argument which should be python
        args[4] = this.connectionFile.filePath;
        args.splice(0, 1);

        const executionService = await this.executionFactory.create({ resource, pythonPath });
        const exeObs = executionService.execObservable(args, {});

        if (exeObs.proc) {
            exeObs.proc!.on('exit', exitCode => {
                traceInfo('KernelProcess Exit', `Exit - ${exitCode}`);
                this.readyPromise.reject();
                this.exitEvent.fire(exitCode);
            });
        } else {
            traceInfo('KernelProcess failed to launch');
            this.readyPromise.reject();
        }
        exeObs.out.subscribe(output => {
            if (output.source === 'stderr') {
                traceInfo(`StdErr from Kernel Process ${output.out}`);
            } else {
                // Search for --existing this is the message that will indicate that our kernel is actually
                // up and started from stdout
                //    To connect another client to this kernel, use:
                //    --existing /var/folders/q7/cn8fg6s94fgdcl0h7rbxldf00000gn/T/tmp-16231TOL2dgBoWET1.json
                if (output.out.includes('--existing')) {
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

// Launches and returns a kernel process given a resource or python interpreter.
// If the given interpreter is undefined, it will try to use the selected interpreter.
// If the selected interpreter doesn't have a kernel, it will find a kernel on disk and use that.
@injectable()
export class KernelLauncher implements IKernelLauncher {
    constructor(
        @inject(IKernelFinder) private kernelFinder: IKernelFinder,
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IFileSystem) private file: IFileSystem
    ) {}

    public async launch(interpreterUri: InterpreterUri, kernelName?: string): Promise<IKernelProcess> {
        const kernelSpec = await this.kernelFinder.findKernelSpec(interpreterUri, kernelName);
        const kernelProcess = new KernelProcess(this.executionFactory, this.file);
        await kernelProcess.launch(interpreterUri, kernelSpec);
        return kernelProcess;
    }
}
