// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { CancellationToken } from 'vscode';

import { ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../common/types';
import { IInterpreterService, IKnownSearchPathsForInterpreters, PythonInterpreter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IJupyterCommandFactory, IJupyterExecution, IJupyterSessionManager, INotebookServer } from '../types';
import { JupyterExecutionBase } from './jupyterExecution';
import { GuestJupyterExecution } from './liveshare/guestJupyterExecution';
import { HostJupyterExecution } from './liveshare/hostJupyterExecution';
import { RoleBasedFactory } from './liveshare/roleBasedFactory';

type JupyterExecutionClassType = {
    new(liveShare: ILiveShareApi,
        executionFactory: IPythonExecutionFactory,
        interpreterService: IInterpreterService,
        processServiceFactory: IProcessServiceFactory,
        knownSearchPaths: IKnownSearchPathsForInterpreters,
        logger: ILogger,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        fileSystem: IFileSystem,
        sessionManager: IJupyterSessionManager,
        workspace: IWorkspaceService,
        configuration: IConfigurationService,
        commandFactory : IJupyterCommandFactory,
        serviceContainer: IServiceContainer): IJupyterExecution;
};

@injectable()
export class JupyterExecution implements IJupyterExecution {

    private executionFactory: RoleBasedFactory<IJupyterExecution, JupyterExecutionClassType>;

    constructor(@inject(ILiveShareApi) liveShare: ILiveShareApi,
                @inject(IPythonExecutionFactory) pythonFactory: IPythonExecutionFactory,
                @inject(IInterpreterService) interpreterService: IInterpreterService,
                @inject(IProcessServiceFactory) processServiceFactory: IProcessServiceFactory,
                @inject(IKnownSearchPathsForInterpreters) knownSearchPaths: IKnownSearchPathsForInterpreters,
                @inject(ILogger) logger: ILogger,
                @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
                @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
                @inject(IFileSystem) fileSystem: IFileSystem,
                @inject(IJupyterSessionManager) sessionManager: IJupyterSessionManager,
                @inject(IWorkspaceService) workspace: IWorkspaceService,
                @inject(IConfigurationService) configuration: IConfigurationService,
                @inject(IJupyterCommandFactory) commandFactory : IJupyterCommandFactory,
                @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.executionFactory = new RoleBasedFactory(
            liveShare,
            JupyterExecutionBase,
            HostJupyterExecution,
            GuestJupyterExecution,
            liveShare,
            pythonFactory,
            interpreterService,
            processServiceFactory,
            knownSearchPaths,
            logger,
            disposableRegistry,
            asyncRegistry,
            fileSystem,
            sessionManager,
            workspace,
            configuration,
            commandFactory,
            serviceContainer
        );
    }

    public async isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const execution = await this.executionFactory.get();
        return execution.isNotebookSupported(cancelToken);
    }
    public async isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const execution = await this.executionFactory.get();
        return execution.isImportSupported(cancelToken);
    }
    public async isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const execution = await this.executionFactory.get();
        return execution.isKernelCreateSupported(cancelToken);
    }
    public async isKernelSpecSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const execution = await this.executionFactory.get();
        return execution.isKernelSpecSupported(cancelToken);
    }
    public async connectToNotebookServer(uri: string | undefined, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<INotebookServer | undefined> {
        const execution = await this.executionFactory.get();
        return execution.connectToNotebookServer(uri, usingDarkTheme, useDefaultConfig, cancelToken, workingDir);
    }
    public async spawnNotebook(file: string): Promise<void> {
        const execution = await this.executionFactory.get();
        return execution.spawnNotebook(file);
    }
    public async importNotebook(file: string, template: string): Promise<string> {
        const execution = await this.executionFactory.get();
        return execution.importNotebook(file, template);
    }
    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> {
        const execution = await this.executionFactory.get();
        return execution.getUsableJupyterPython(cancelToken);
    }
    public async dispose(): Promise<void> {
        const execution = await this.executionFactory.get();
        return execution.dispose();
    }
}
