// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { NodeLanguageServerAnalysisOptions } from '../activation/node/analysisOptions';
import { NodeLanguageClientFactory } from '../activation/node/languageClientFactory';
import { NodeLanguageServerProxy } from '../activation/node/languageServerProxy';
import { NodeLanguageServerManager } from '../activation/node/manager';
import { ILanguageServerOutputChannel } from '../activation/types';
import { ICommandManager, IWorkspaceService } from '../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import {
    IConfigurationService,
    IDisposable,
    IExperimentService,
    IExtensions,
    IInterpreterPathService,
    Resource,
} from '../common/types';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { LanguageServerCapabilities } from './languageServerCapabilities';
import { ILanguageServerExtensionManager } from './types';

export class PylanceLSExtensionManager extends LanguageServerCapabilities
    implements IDisposable, ILanguageServerExtensionManager {
    serverManager: NodeLanguageServerManager;

    serverProxy: NodeLanguageServerProxy;

    clientFactory: NodeLanguageClientFactory;

    analysisOptions: NodeLanguageServerAnalysisOptions;

    constructor(
        serviceContainer: IServiceContainer,
        outputChannel: ILanguageServerOutputChannel,
        experimentService: IExperimentService,
        workspaceService: IWorkspaceService,
        _configurationService: IConfigurationService,
        interpreterPathService: IInterpreterPathService,
        _interpreterService: IInterpreterService,
        environmentService: IEnvironmentVariablesProvider,
        commandManager: ICommandManager,
        fileSystem: IFileSystem,
        private readonly extensions: IExtensions,
    ) {
        super();

        this.analysisOptions = new NodeLanguageServerAnalysisOptions(outputChannel, workspaceService);
        this.clientFactory = new NodeLanguageClientFactory(fileSystem, extensions);
        this.serverProxy = new NodeLanguageServerProxy(
            this.clientFactory,
            experimentService,
            interpreterPathService,
            environmentService,
            workspaceService,
            extensions,
        );
        this.serverManager = new NodeLanguageServerManager(
            serviceContainer,
            this.analysisOptions,
            this.serverProxy,
            commandManager,
            extensions,
        );
    }

    dispose(): void {
        this.serverManager.disconnect();
        this.serverManager.dispose();
        this.serverProxy.dispose();
        this.analysisOptions.dispose();
    }

    async startLanguageServer(resource: Resource, interpreter?: PythonEnvironment): Promise<void> {
        await this.serverManager.start(resource, interpreter);
        this.serverManager.connect();
    }

    stopLanguageServer(): void {
        this.serverManager.disconnect();
        this.serverProxy.dispose();
    }

    canStartLanguageServer(): boolean {
        const extension = this.extensions.getExtension(PYLANCE_EXTENSION_ID);
        return !!extension;
    }
}
