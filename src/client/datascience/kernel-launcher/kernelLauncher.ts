// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
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
        await executionService.exec([], {});

        this._connection = this.getKernelConnection();
        this._process = this.getChildProcess();

        return Promise.resolve();
    }
    public dispose() {
        this._process?.kill();
    }

    private getKernelConnection(): IKernelConnection {
        throw new Error('Method not implemented.');
    }

    private getChildProcess(): ChildProcess {
        throw new Error('Method not implemented.');
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
