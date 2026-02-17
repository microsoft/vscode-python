// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { LanguageServerOutputChannel } from '../activation/common/outputChannel';
import { JediLanguageServerAnalysisOptions } from '../activation/jedi/analysisOptions';
import { JediLanguageClientFactory } from '../activation/jedi/languageClientFactory';
import { JediLanguageServerProxy } from '../activation/jedi/languageServerProxy';
import { JediLanguageServerManager } from '../activation/jedi/manager';
import { IWorkspaceService, ICommandManager, IApplicationShell } from '../common/application/types';
import {
    IExperimentService,
    IInterpreterPathService,
    IConfigurationService,
    Resource,
    IDisposable,
} from '../common/types';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { traceError } from '../logging';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { ILanguageServerExtensionManager } from './types';

export class JediLSExtensionManager implements IDisposable, ILanguageServerExtensionManager {
    private serverProxy: JediLanguageServerProxy;
    private outputChannel: LanguageServerOutputChannel;

    serverManager: JediLanguageServerManager;

    clientFactory: JediLanguageClientFactory;

    analysisOptions: JediLanguageServerAnalysisOptions;

    constructor(
        serviceContainer: IServiceContainer,
        _experimentService: IExperimentService,
        workspaceService: IWorkspaceService,
        configurationService: IConfigurationService,
        _interpreterPathService: IInterpreterPathService,
        interpreterService: IInterpreterService,
        environmentService: IEnvironmentVariablesProvider,
        commandManager: ICommandManager,
    ) {
        const appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.outputChannel = new LanguageServerOutputChannel(appShell, commandManager);
        this.analysisOptions = new JediLanguageServerAnalysisOptions(
            environmentService,
            this.outputChannel,
            configurationService,
            workspaceService,
        );
        this.clientFactory = new JediLanguageClientFactory(interpreterService);
        this.serverProxy = new JediLanguageServerProxy(this.clientFactory);
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
        this.outputChannel.dispose();
    }

    async startLanguageServer(resource: Resource, interpreter?: PythonEnvironment): Promise<void> {
        await this.serverManager.start(resource, interpreter);
        this.serverManager.connect();
    }

    async stopLanguageServer(): Promise<void> {
        this.serverManager.disconnect();
        await this.serverProxy.stop();
    }

    // eslint-disable-next-line class-methods-use-this
    canStartLanguageServer(interpreter: PythonEnvironment | undefined): boolean {
        if (!interpreter) {
            traceError('Unable to start Jedi language server as a valid interpreter is not selected');
            return false;
        }
        // Otherwise return true for now since it's shipped with the extension.
        // Update this when JediLSP is pulled in a separate extension.
        return true;
    }

    // eslint-disable-next-line class-methods-use-this
    languageServerNotAvailable(): Promise<void> {
        // Nothing to do here.
        // Update this when JediLSP is pulled in a separate extension.
        return Promise.resolve();
    }
}
