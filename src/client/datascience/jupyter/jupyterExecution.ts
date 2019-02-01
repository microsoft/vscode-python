// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';
import * as vsls from 'vsls/vscode';

import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { IInterpreterService, IKnownSearchPathsForInterpreters, PythonInterpreter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { LiveShare } from '../constants';
import { IJupyterCommandFactory, IJupyterExecution, IJupyterSessionManager, INotebookServer } from '../types';
import { JupyterExecutionBase } from './jupyterExecutionBase';
import { GuestJupyterExecution } from './liveshare/guestJupyterExecution';
import { HostJupyterExecution } from './liveshare/hostJupyterExecution';

@injectable()
export class JupyterExecution implements IJupyterExecution {

    private executionHandler: Deferred<IJupyterExecution> | undefined;

    constructor(@inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
                @inject(IInterpreterService) private interpreterService: IInterpreterService,
                @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
                @inject(IKnownSearchPathsForInterpreters) private knownSearchPaths: IKnownSearchPathsForInterpreters,
                @inject(ILogger) private logger: ILogger,
                @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
                @inject(IAsyncDisposableRegistry) private asyncRegistry: IAsyncDisposableRegistry,
                @inject(IFileSystem) private fileSystem: IFileSystem,
                @inject(IJupyterSessionManager) private sessionManager: IJupyterSessionManager,
                @inject(IWorkspaceService) private workspace: IWorkspaceService,
                @inject(IConfigurationService) private configuration: IConfigurationService,
                @inject(IJupyterCommandFactory) private commandFactory : IJupyterCommandFactory,
                @inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        vsls.getApiAsync().then(
            v => this.loadExecution(v).ignoreErrors(),
            r => this.loadExecution(undefined).ignoreErrors()
        );
    }

    public async isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.isNotebookSupported(cancelToken);
        }
        return false;
    }
    public async isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.isImportSupported(cancelToken);
        }
        return false;
    }
    public async isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.isKernelCreateSupported(cancelToken);
        }
        return false;
    }
    public async isKernelSpecSupported(cancelToken?: CancellationToken): Promise<boolean> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.isKernelSpecSupported(cancelToken);
        }
        return false;
    }
    public async connectToNotebookServer(uri: string, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<INotebookServer> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.connectToNotebookServer(uri, usingDarkTheme, useDefaultConfig, cancelToken, workingDir)
        }
        return undefined;
    }
    public async spawnNotebook(file: string): Promise<void> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.spawnNotebook(file);
        }
    }
    public async importNotebook(file: string, template: string): Promise<string> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.importNotebook(file, template);
        }
    }
    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.getUsableJupyterPython(cancelToken);
        }
        return undefined;
    }

    public async dispose(): Promise<void> {
        if (this.executionHandler) {
            const execution = await this.executionHandler.promise;
            return execution.dispose();
        }
    }


    private async loadExecution(api: vsls.LiveShare | undefined) : Promise<void> {
        // Dispose of the last execution handler
        if (this.executionHandler.resolved) {
            const current = await this.executionHandler.promise;
            if (current) {
                await current.dispose();
            }
        }

        // Create a new one based on our current state of our live share session
        this.executionHandler = createDeferred<IJupyterExecution>();
        if (api) {
            api.onDidChangeSession(() => this.loadExecution(api));
            if (api.session) {
                if (api.session.role === vsls.Role.Host) {
                    this.executionHandler.resolve(
                        new HostJupyterExecution(
                            this.executionFactory,
                            this.interpreterService,
                            this.processServiceFactory,
                            this.knownSearchPaths,
                            this.logger,
                            this.disposableRegistry,
                            this.asyncRegistry,
                            this.fileSystem,
                            this.sessionManager,
                            this.workspace,
                            this.configuration,
                            this.commandFactory,
                            this.serviceContainer));
                } else if (api.session.role === vsls.Role.Guest) {
                    this.executionHandler.resolve(
                        new GuestJupyterExecution(
                            this.executionFactory,
                            this.interpreterService,
                            this.processServiceFactory,
                            this.knownSearchPaths,
                            this.logger,
                            this.disposableRegistry,
                            this.asyncRegistry,
                            this.fileSystem,
                            this.sessionManager,
                            this.workspace,
                            this.configuration,
                            this.commandFactory,
                            this.serviceContainer));

                }
            }
        }

        if (!this.executionHandler.resolved) {
            // Just create a base one. We don't have a vsls session active
            this.executionHandler.resolve(
                new JupyterExecutionBase(
                    this.executionFactory,
                    this.interpreterService,
                    this.processServiceFactory,
                    this.knownSearchPaths,
                    this.logger,
                    this.disposableRegistry,
                    this.asyncRegistry,
                    this.fileSystem,
                    this.sessionManager,
                    this.workspace,
                    this.configuration,
                    this.commandFactory,
                    this.serviceContainer));
        }
    }


}
