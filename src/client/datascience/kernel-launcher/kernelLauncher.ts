// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import { getPorts } from 'portfinder';
import uuid from 'uuid';
import { InterpreterUri } from '../../common/installer/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { isResource } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from './types';

class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private _connection?: IKernelConnection;
    private interpreter: InterpreterUri;
    private serviceContainer: IServiceContainer;
    public get process(): ChildProcess {
        return this._process!;
    }
    public get connection(): IKernelConnection {
        return this._connection!;
    }

    constructor(interpreter: InterpreterUri, @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.interpreter = interpreter;
        this.serviceContainer = serviceContainer;
    }

    public async launch(): Promise<void> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const resource = isResource(this.interpreter) ? this.interpreter : undefined;
        const pythonPath = isResource(this.interpreter) ? undefined : this.interpreter.path;

        const executionService = await pythonExecutionFactory.create({ resource, pythonPath });
        const kernelProcess = executionService.execObservable([], {});

        this._process = kernelProcess.proc;

        getPorts(5, { host: '127.0.0.1', port: 9000 }, (error: Error, ports: number[]) => {
            if (error) {
                throw error;
            }
            this._connection = this.getKernelConnection(ports);
        });

        return Promise.resolve();
    }
    public dispose() {
        this._process?.kill();
    }

    private getKernelConnection(ports: number[]): IKernelConnection {
        return {
            version: 1,
            key: uuid.v4(),
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
    private serviceContainer: IServiceContainer;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.serviceContainer = serviceContainer;
    }

    public async launch(interpreterUri: InterpreterUri): Promise<IKernelProcess> {
        const kernel = new KernelProcess(interpreterUri, this.serviceContainer);
        await kernel.launch();
        return kernel;
    }
}
