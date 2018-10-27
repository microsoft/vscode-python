// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IFileSystem } from '../common/platform/types';
import { IPythonExecutionFactory } from '../common/process/types';
import { IDisposableRegistry, ILogger } from '../common/types';
import { JupyterProcess } from './jupyterProcess';
import { JupyterServer } from './jupyterServer';
import { IJupyterServer, IJupyterServerProvider } from './types';

@injectable()
export class JupyterServerProvider implements IJupyterServerProvider {

    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(ILogger) private logger: ILogger,
        @inject(IPythonExecutionFactory) private pythonExecutionFactory : IPythonExecutionFactory,
        @inject(IFileSystem) private fileSystem: IFileSystem) {
    }

    public async start(): Promise<IJupyterServer> {
        // Use the default python service (should match the currently selected one?)
        const pythonService = await this.pythonExecutionFactory.create({});
        const server = new JupyterServer(this.logger, pythonService, this.fileSystem, this.disposableRegistry);
        this.disposableRegistry.push(server);
        await server.start();
        return server;
    }

    public async isSupported() : Promise<boolean> {
        const pythonService = await this.pythonExecutionFactory.create({});
        return JupyterProcess.exists(pythonService);
    }
}
