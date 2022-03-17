// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { JediLanguageServerAnalysisOptions } from '../activation/jedi/analysisOptions';
import { JediLanguageClientFactory } from '../activation/jedi/languageClientFactory';
import { JediLanguageServerProxy } from '../activation/jedi/languageServerProxy';
import { JediLanguageServerManager } from '../activation/jedi/manager';
import { ILanguageServerOutputChannel } from '../activation/types';
import { IWorkspaceService, ICommandManager } from '../common/application/types';
import { IExperimentService, IInterpreterPathService, IConfigurationService, Resource } from '../common/types';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { ILanguageServerExtensionManager } from './types';

export class JediLSExtensionManager implements ILanguageServerExtensionManager {
    serverManager: JediLanguageServerManager;

    serverProxy: JediLanguageServerProxy;

    clientFactory: JediLanguageClientFactory;

    analysisOptions: JediLanguageServerAnalysisOptions;

    constructor(
        serviceContainer: IServiceContainer,
        outputChannel: ILanguageServerOutputChannel,
        _experimentService: IExperimentService,
        workspaceService: IWorkspaceService,
        configurationService: IConfigurationService,
        interpreterPathService: IInterpreterPathService,
        interpreterService: IInterpreterService,
        environmentService: IEnvironmentVariablesProvider,
        commandManager: ICommandManager,
    ) {
        this.analysisOptions = new JediLanguageServerAnalysisOptions(
            environmentService,
            outputChannel,
            configurationService,
            workspaceService,
        );
        this.clientFactory = new JediLanguageClientFactory(interpreterService);
        this.serverProxy = new JediLanguageServerProxy(this.clientFactory, interpreterPathService);
        this.serverManager = new JediLanguageServerManager(
            serviceContainer,
            this.analysisOptions,
            this.serverProxy,
            commandManager,
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
        // TODO
        console.warn(this.serverManager);
    }

    canStartLanguageServer(): boolean {
        // TODO
        console.warn(this.serverManager);
        return true;
    }
}
