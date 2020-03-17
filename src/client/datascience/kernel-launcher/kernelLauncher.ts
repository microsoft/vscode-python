// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { InterpreterUri } from '../../common/installer/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { isResource } from '../../common/utils/misc';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from './types';

class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private _connection?: IKernelConnection;
    private interpreter: InterpreterUri;
    private executionFactory: IPythonExecutionFactory;
    public get process(): ChildProcess {
        return this._process!;
    }
    public get connection(): IKernelConnection {
        return this._connection!;
    }

    constructor(
        interpreter: InterpreterUri,
        @inject(IPythonExecutionFactory) executionFactory: IPythonExecutionFactory
    ) {
        this.interpreter = interpreter;
        this.executionFactory = executionFactory;
    }

    public async launch(): Promise<void> {
        const resource = isResource(this.interpreter) ? this.interpreter : undefined;
        const pythonPath = isResource(this.interpreter) ? undefined : this.interpreter.path;

        const executionService = await this.executionFactory.create({ resource, pythonPath });
        const kernelProcess = executionService.execObservable([], {});

        this._process = kernelProcess.proc;

        const getPorts = promisify(portfinder.getPorts);
        const ports = await getPorts(5, { host: '127.0.0.1', port: 9000 });

        this._connection = this.getKernelConnection(ports);

        return Promise.resolve();
    }
    public dispose() {
        this._process?.kill();
    }

    private getKernelConnection(ports: number[]): IKernelConnection {
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

@injectable()
export class KernelLauncher implements IKernelLauncher {
    private executionFactory: IPythonExecutionFactory;

    constructor(@inject(IPythonExecutionFactory) executionFactory: IPythonExecutionFactory) {
        this.executionFactory = executionFactory;
    }

    public async launch(interpreterUri: InterpreterUri): Promise<IKernelProcess> {
        const kernel = new KernelProcess(interpreterUri, this.executionFactory);
        await kernel.launch();
        return kernel;
    }
}
