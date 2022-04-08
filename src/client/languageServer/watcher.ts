// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent } from 'vscode';
import { LanguageServerChangeHandler } from '../activation/common/languageServerChangeHandler';
import {
    IExtensionActivationService,
    ILanguageServer,
    ILanguageServerCache,
    ILanguageServerOutputChannel,
    LanguageServerType,
} from '../activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { IFileSystem } from '../common/platform/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IExtensions,
    IInterpreterPathService,
    Resource,
} from '../common/types';
import { LanguageService } from '../common/utils/localize';
import { IEnvironmentVariablesProvider } from '../common/variables/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { traceLog } from '../logging';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { JediLSExtensionManager } from './jediLSExtensionManager';
import { NoneLSExtensionManager } from './noneLSExtensionManager';
import { PylanceLSExtensionManager } from './pylanceLSExtensionManager';
import { ILanguageServerExtensionManager, ILanguageServerWatcher } from './types';

@injectable()
/**
 * The Language Server Watcher class implements the ILanguageServerWatcher interface, which is the one-stop shop for language server activation.
 *
 * It also implements the ILanguageServerCache interface needed by our Jupyter support.
 */
export class LanguageServerWatcher
    implements IExtensionActivationService, ILanguageServerWatcher, ILanguageServerCache {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    languageServerExtensionManager: ILanguageServerExtensionManager | undefined;

    languageServerType: LanguageServerType;

    private resource: Resource;

    private interpreter: PythonEnvironment | undefined;

    private languageServerChangeHandler: LanguageServerChangeHandler;

    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(ILanguageServerOutputChannel) private readonly lsOutputChannel: ILanguageServerOutputChannel,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IEnvironmentVariablesProvider) private readonly environmentService: IEnvironmentVariablesProvider,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IApplicationShell) readonly applicationShell: IApplicationShell,
        @inject(IDisposableRegistry) readonly disposables: IDisposableRegistry,
    ) {
        this.languageServerType = this.configurationService.getSettings().languageServer;

        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));

        if (this.workspaceService.isTrusted) {
            disposables.push(this.interpreterService.onDidChangeInterpreter(this.onDidChangeInterpreter.bind(this)));
        }

        this.languageServerChangeHandler = new LanguageServerChangeHandler(
            this.languageServerType,
            this.extensions,
            this.applicationShell,
            this.commandManager,
            this.workspaceService,
            this.configurationService,
        );
        disposables.push(this.languageServerChangeHandler);

        disposables.push(
            extensions.onDidChange(async () => {
                await this.extensionsChangeHandler();
            }),
        );
    }

    // IExtensionActivationService

    public async activate(resource: Resource): Promise<void> {
        this.resource = resource;
        await this.startLanguageServer(this.languageServerType);
    }

    // ILanguageServerWatcher;

    public async startLanguageServer(languageServerType: LanguageServerType): Promise<void> {
        const interpreter = await this.interpreterService?.getActiveInterpreter(this.resource);

        // Destroy the old language server if it's different.
        if (interpreter !== this.interpreter) {
            this.stopLanguageServer();
        }

        // If the interpreter is Python 2 and the LS setting is explicitly set to Jedi, turn it off.
        // If set to Default, use Pylance.
        let serverType = languageServerType;
        if (interpreter && (interpreter.version?.major ?? 0) < 3) {
            if (serverType === LanguageServerType.Jedi) {
                serverType = LanguageServerType.None;
            } else if (this.getCurrentLanguageServerTypeIsDefault()) {
                serverType = LanguageServerType.Node;
            }
        }

        if (
            !this.workspaceService.isTrusted &&
            serverType !== LanguageServerType.Node &&
            serverType !== LanguageServerType.None
        ) {
            traceLog(LanguageService.untrustedWorkspaceMessage());
            serverType = LanguageServerType.None;
        }

        // Instantiate the language server extension manager.
        this.languageServerExtensionManager = this.createLanguageServer(serverType);

        if (this.languageServerExtensionManager.canStartLanguageServer()) {
            // Start the language server.
            await this.languageServerExtensionManager.startLanguageServer(this.resource, interpreter);

            logStartup(languageServerType);
            this.languageServerType = languageServerType;
            this.interpreter = interpreter;
        } else {
            await this.languageServerExtensionManager.languageServerNotAvailable();
        }
    }

    // ILanguageServerCache

    public async get(): Promise<ILanguageServer> {
        if (!this.languageServerExtensionManager) {
            this.startLanguageServer(this.languageServerType);
        }

        return Promise.resolve(this.languageServerExtensionManager!.get());
    }

    // Private methods

    private stopLanguageServer(): void {
        if (this.languageServerExtensionManager) {
            this.languageServerExtensionManager.stopLanguageServer();
            this.languageServerExtensionManager.dispose();
            this.languageServerExtensionManager = undefined;
        }
    }

    private createLanguageServer(languageServerType: LanguageServerType): ILanguageServerExtensionManager {
        switch (languageServerType) {
            case LanguageServerType.Jedi:
                this.languageServerExtensionManager = new JediLSExtensionManager(
                    this.serviceContainer,
                    this.lsOutputChannel,
                    this.experimentService,
                    this.workspaceService,
                    this.configurationService,
                    this.interpreterPathService,
                    this.interpreterService,
                    this.environmentService,
                    this.commandManager,
                );
                break;
            case LanguageServerType.Node:
                this.languageServerExtensionManager = new PylanceLSExtensionManager(
                    this.serviceContainer,
                    this.lsOutputChannel,
                    this.experimentService,
                    this.workspaceService,
                    this.configurationService,
                    this.interpreterPathService,
                    this.interpreterService,
                    this.environmentService,
                    this.commandManager,
                    this.fileSystem,
                    this.extensions,
                    this.applicationShell,
                );
                break;
            case LanguageServerType.None:
            default:
                this.languageServerExtensionManager = new NoneLSExtensionManager();
                break;
        }

        return this.languageServerExtensionManager;
    }

    private async refreshLanguageServer(): Promise<void> {
        const languageServerType = this.configurationService.getSettings().languageServer;

        if (languageServerType !== this.languageServerType) {
            this.stopLanguageServer();
            await this.startLanguageServer(languageServerType);
        }
    }

    private getCurrentLanguageServerTypeIsDefault(): boolean {
        return this.configurationService.getSettings(this.resource).languageServerIsDefault;
    }

    // Watch for settings changes.
    private async onDidChangeConfiguration(event: ConfigurationChangeEvent): Promise<void> {
        if (event.affectsConfiguration('python.languageServer')) {
            await this.refreshLanguageServer();
        }
    }

    // Watch for interpreter changes.
    private async onDidChangeInterpreter(): Promise<void> {
        // Reactivate the resource. It should destroy the old one if it's different.
        return this.activate(this.resource);
    }

    // Watch for extension changes.
    private async extensionsChangeHandler(): Promise<void> {
        const languageServerType = this.configurationService.getSettings().languageServer;

        if (languageServerType !== this.languageServerType) {
            await this.refreshLanguageServer();
        }
    }
}

function logStartup(languageServerType: LanguageServerType): void {
    let outputLine;
    switch (languageServerType) {
        case LanguageServerType.Jedi:
            outputLine = LanguageService.startingJedi();
            break;
        case LanguageServerType.Node:
            outputLine = LanguageService.startingPylance();
            break;
        case LanguageServerType.None:
            outputLine = LanguageService.startingNone();
            break;
        default:
            throw new Error(`Unknown language server type: ${languageServerType}`);
    }
    traceLog(outputLine);
}
