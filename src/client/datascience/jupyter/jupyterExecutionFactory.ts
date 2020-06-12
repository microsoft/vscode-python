// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import { CancellationToken, Event, EventEmitter } from 'vscode';

import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import {
    IAsyncDisposable,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IOutputChannel
} from '../../common/types';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { PythonInterpreter } from '../../pythonEnvironments/discovery/types';
import { JUPYTER_OUTPUT_CHANNEL } from '../constants';
import { IJupyterExecution, INotebookServer, INotebookServerOptions } from '../types';
import { KernelSelector } from './kernels/kernelSelector';
import { GuestJupyterExecution } from './liveshare/guestJupyterExecution';
import { HostJupyterExecution } from './liveshare/hostJupyterExecution';
import { IRoleBasedObject, RoleBasedFactory } from './liveshare/roleBasedFactory';
import { NotebookStarter } from './notebookStarter';

interface IJupyterExecutionInterface extends IRoleBasedObject, IJupyterExecution {}

// tslint:disable:callable-types
type JupyterExecutionClassType = {
    new (
        liveShare: ILiveShareApi,
        interpreterService: IInterpreterService,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        fileSystem: IFileSystem,
        workspace: IWorkspaceService,
        configuration: IConfigurationService,
        kernelSelector: KernelSelector,
        notebookStarter: NotebookStarter,
        appShell: IApplicationShell,
        jupyterOutputChannel: IOutputChannel,
        serviceContainer: IServiceContainer
    ): IJupyterExecutionInterface;
};
// tslint:enable:callable-types

@injectable()
export class JupyterExecutionFactory implements IJupyterExecution, IAsyncDisposable {
    private executionFactory: RoleBasedFactory<IJupyterExecutionInterface, JupyterExecutionClassType>;
    private sessionChangedEventEmitter: EventEmitter<void> = new EventEmitter<void>();
    private serverStartedEventEmitter: EventEmitter<INotebookServerOptions | undefined> = new EventEmitter<
        INotebookServerOptions | undefined
    >();

    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(KernelSelector) kernelSelector: KernelSelector,
        @inject(NotebookStarter) notebookStarter: NotebookStarter,
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IOutputChannel) @named(JUPYTER_OUTPUT_CHANNEL) jupyterOutputChannel: IOutputChannel,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        asyncRegistry.push(this);
        this.executionFactory = new RoleBasedFactory<IJupyterExecutionInterface, JupyterExecutionClassType>(
            liveShare,
            HostJupyterExecution,
            GuestJupyterExecution,
            liveShare,
            interpreterService,
            disposableRegistry,
            asyncRegistry,
            fileSystem,
            workspace,
            configuration,
            kernelSelector,
            notebookStarter,
            appShell,
            jupyterOutputChannel,
            serviceContainer
        );
        this.executionFactory.sessionChanged(() => this.onSessionChanged());
    }

    public get sessionChanged(): Event<void> {
        return this.sessionChangedEventEmitter.event;
    }

    public get serverStarted(): Event<INotebookServerOptions | undefined> {
        return this.serverStartedEventEmitter.event;
    }

    public async dispose(): Promise<void> {
        // Dispose of our execution object
        const execution = await this.executionFactory.get();
        return execution.dispose();
    }

    public async refreshCommands(): Promise<void> {
        const execution = await this.executionFactory.get();
        return execution.refreshCommands();
    }

    public async isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const execution = await this.executionFactory.get();
        return execution.isNotebookSupported(cancelToken);
    }

    public async getNotebookError(): Promise<string> {
        const execution = await this.executionFactory.get();
        return execution.getNotebookError();
    }

    public async isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const execution = await this.executionFactory.get();
        return execution.isImportSupported(cancelToken);
    }
    public async isSpawnSupported(cancelToken?: CancellationToken): Promise<boolean> {
        const execution = await this.executionFactory.get();
        return execution.isSpawnSupported(cancelToken);
    }
    public async connectToNotebookServer(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        const execution = await this.executionFactory.get();
        const server = await execution.connectToNotebookServer(options, cancelToken);
        if (server) {
            this.serverStartedEventEmitter.fire(options);
        }
        return server;
    }
    public async spawnNotebook(file: string): Promise<void> {
        const execution = await this.executionFactory.get();
        return execution.spawnNotebook(file);
    }
    public async importNotebook(file: string, template: string | undefined): Promise<string> {
        const execution = await this.executionFactory.get();
        return execution.importNotebook(file, template);
    }
    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> {
        const execution = await this.executionFactory.get();
        return execution.getUsableJupyterPython(cancelToken);
    }
    public async getServer(options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        const execution = await this.executionFactory.get();
        return execution.getServer(options);
    }

    private onSessionChanged() {
        this.sessionChangedEventEmitter.fire();
    }
}
