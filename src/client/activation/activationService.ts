// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../common/extensions';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, OutputChannel, Uri } from 'vscode';

import { LSNotSupportedDiagnosticServiceId } from '../application/diagnostics/checks/lsNotSupported';
import { IDiagnosticsService } from '../application/diagnostics/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { LSControl, LSEnabled } from '../common/experimentGroups';
import { traceError } from '../common/logger';
import { IConfigurationService, IDisposableRegistry, IExperimentsManager, IOutputChannel, IPersistentStateFactory, IPythonSettings, Resource } from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { noop } from '../common/utils/misc';
import { IInterpreterService, PythonInterpreter } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { Commands } from './languageServer/constants';
import { RefCountedLanguageServer } from './refCountedLanguageServer';
import { IExtensionActivationService, ILanguageServerActivator, ILanguageServerCache, LanguageServerType } from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';
const languageServerSetting: keyof IPythonSettings = 'languageServer';
const workspacePathNameForGlobalWorkspaces = '';

interface IActivatedServer {
    key: string;
    server: ILanguageServerActivator;
    jedi: boolean;
}

@injectable()
export class LanguageServerExtensionActivationService implements IExtensionActivationService, ILanguageServerCache, Disposable {
    private cache = new Map<string, Promise<RefCountedLanguageServer>>();
    private activatedServer?: IActivatedServer;
    private readonly workspaceService: IWorkspaceService;
    private readonly output: OutputChannel;
    private readonly appShell: IApplicationShell;
    private readonly lsNotSupportedDiagnosticService: IDiagnosticsService;
    private readonly interpreterService: IInterpreterService;
    private resource!: Resource;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
        @inject(IExperimentsManager) private readonly abExperiments: IExperimentsManager
    ) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.output = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.lsNotSupportedDiagnosticService = this.serviceContainer.get<IDiagnosticsService>(IDiagnosticsService, LSNotSupportedDiagnosticServiceId);
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        disposables.push(this);
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
        disposables.push(this.workspaceService.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
        disposables.push(this.interpreterService.onDidChangeInterpreter(this.onDidChangeInterpreter.bind(this)));
        disposables.push(commandManager.registerCommand(Commands.ClearAnalyisCache, this.onClearAnalysisCaches.bind(this)));
    }

    public async activate(resource: Resource): Promise<void> {
        // Get a new server and dispose of the old one (might be the same one)
        this.resource = resource;
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        const key = await this.getKey(resource, interpreter);

        // If we have an old server with a different key, then deactivate it as the
        // creation of the new server may fail if this server is still connected
        if (this.activatedServer && this.activatedServer.key !== key) {
            this.activatedServer.server.deactivate();
        }

        // Get the new item
        const result = await this.get(resource, interpreter);

        // Now we dispose. This ensures the object stays alive if it's the same object because
        // we dispose after we increment the ref count.
        if (this.activatedServer) {
            this.activatedServer.server.dispose();
        }

        // Save our active server.
        this.activatedServer = { key, server: result, jedi: result.type === LanguageServerType.Jedi };

        // Force this server to reconnect (if disconnected) as it should be the active
        // language server for all of VS code.
        this.activatedServer.server.activate();
    }

    public async get(resource: Resource, interpreter?: PythonInterpreter): Promise<RefCountedLanguageServer> {
        // See if we already have it or not
        const key = await this.getKey(resource, interpreter);
        let result: Promise<RefCountedLanguageServer> | undefined = this.cache.get(key);
        if (!result) {
            // Create a special ref counted result so we don't dispose of the
            // server too soon.
            result = this.createRefCountedServer(resource, interpreter, key);
            this.cache.set(key, result);
        } else {
            // Increment ref count if already exists.
            result = result.then(r => {
                r.increment();
                return r;
            });
        }
        return result;
    }

    public dispose() {
        if (this.activatedServer) {
            this.activatedServer.server.dispose();
        }
    }
    @swallowExceptions('Send telemetry for Language Server current selection')
    public async sendTelemetryForChosenLanguageServer(jediEnabled: boolean): Promise<void> {
        const state = this.stateFactory.createGlobalPersistentState<boolean | undefined>('SWITCH_LS', undefined);
        if (typeof state.value !== 'boolean') {
            await state.updateValue(jediEnabled);
        }
        if (state.value !== jediEnabled) {
            await state.updateValue(jediEnabled);
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_CURRENT_SELECTION, undefined, { switchTo: jediEnabled });
        } else {
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_CURRENT_SELECTION, undefined, { lsStartup: jediEnabled });
        }
    }

    /**
     * Checks if user has not manually set `jediEnabled` setting
     * @param resource
     * @returns `true` if user has NOT manually added the setting and is using default configuration, `false` if user has `jediEnabled` setting added
     */
    public isJediUsingDefaultConfiguration(resource: Resource): boolean {
        const settings = this.workspaceService.getConfiguration('python', resource).inspect<boolean>('jediEnabled');
        if (!settings) {
            traceError('WorkspaceConfiguration.inspect returns `undefined` for setting `python.jediEnabled`');
            return false;
        }
        return settings.globalValue === undefined && settings.workspaceValue === undefined && settings.workspaceFolderValue === undefined;
    }

    /**
     * Checks if user is using Jedi as intellisense
     * @returns `true` if user is using jedi, `false` if user is using language server
     */
    public useJedi(): boolean {
        if (this.isJediUsingDefaultConfiguration(this.resource)) {
            if (this.abExperiments.inExperiment(LSEnabled)) {
                return false;
            }
            // Send telemetry if user is in control group
            this.abExperiments.sendTelemetryIfInExperiment(LSControl);
        }
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        let enabled = configurationService.getSettings(this.resource).jediEnabled;
        const languageServerType = configurationService.getSettings(this.resource).languageServer;
        enabled = enabled || languageServerType === LanguageServerType.Jedi;
        this.sendTelemetryForChosenLanguageServer(enabled).ignoreErrors();
        return enabled;
    }

    protected async onWorkspaceFoldersChanged() {
        //If an activated workspace folder was removed, dispose its activator
        const workspaceKeys = await Promise.all(this.workspaceService.workspaceFolders!.map(workspaceFolder => this.getKey(workspaceFolder.uri)));
        const activatedWkspcKeys = Array.from(this.cache.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter(item => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                const server = await this.cache.get(folder);
                server?.dispose(); // This should remove it from the cache if this is the last instance.
            }
        }
    }

    private async onDidChangeInterpreter() {
        // Reactivate the resource. It should destroy the old one if it's different.
        return this.activate(this.resource);
    }

    private async createRefCountedServer(resource: Resource, interpreter: PythonInterpreter | undefined, key: string): Promise<RefCountedLanguageServer> {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        let serverType = configurationService.getSettings(this.resource).languageServer;
        if (!serverType) {
            serverType = LanguageServerType.Jedi;
        }

        switch (serverType) {
            case LanguageServerType.None:
                sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_NONE, undefined, undefined);
                break;
            case LanguageServerType.Node:
                // No telemetry in development phase.
                break;
            case LanguageServerType.Microsoft:
                if (this.useJedi()) {
                    serverType = LanguageServerType.Jedi;
                    break;
                }
                const diagnostic = await this.lsNotSupportedDiagnosticService.diagnose(undefined);
                this.lsNotSupportedDiagnosticService.handle(diagnostic).ignoreErrors();
                if (diagnostic.length) {
                    sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, { supported: false });
                    serverType = LanguageServerType.Jedi;
                }
                break;
            default:
                serverType = LanguageServerType.Jedi;
                break;
        }

        await this.logStartup(serverType);
        let server = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, serverType);
        try {
            await server.start(resource, interpreter);
        } catch (ex) {
            if (serverType === LanguageServerType.Jedi) {
                throw ex;
            }
            await this.logStartup(serverType);
            serverType = LanguageServerType.Jedi;
            server = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, serverType);
            await server.start(resource, interpreter);
        }

        // Wrap the returned server in something that ref counts it.
        return new RefCountedLanguageServer(server, serverType, () => {
            // When we finally remove the last ref count, remove from the cache
            this.cache.delete(key);

            // Dispose of the actual server.
            server.dispose();
        });
    }

    private async logStartup(serverType: LanguageServerType): Promise<void> {
        let outputLine;
        switch (serverType) {
            case LanguageServerType.Jedi:
                outputLine = 'Starting Jedi Python language engine.';
                break;
            case LanguageServerType.Microsoft:
                outputLine = 'Starting Microsoft Python language server.';
                break;
            case LanguageServerType.Node:
                outputLine = 'Starting Node.js language server.';
                break;
            case LanguageServerType.None:
                outputLine = 'Editor support is inactive since language server is set to None.';
                break;
            default:
                throw new Error('Unknown langauge server type in activator.');
        }
        this.output.appendLine(outputLine);
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders!.map(workspace => workspace.uri)
            : [undefined];
        if (
            workspacesUris.findIndex(uri => event.affectsConfiguration(`python.${jediEnabledSetting}`, uri)) === -1 &&
            workspacesUris.findIndex(uri => event.affectsConfiguration(`python.${languageServerSetting}`, uri)) === -1
        ) {
            return;
        }
        const jedi = this.useJedi();
        if (this.activatedServer) {
            if (this.activatedServer.jedi === jedi) {
                return;
            }
            const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
            const lsType = configurationService.getSettings(this.resource).languageServer;
            if (this.activatedServer.key === lsType) {
                return;
            }
        }

        const item = await this.appShell.showInformationMessage('Please reload the window switching between language engines.', 'Reload');
        if (item === 'Reload') {
            this.serviceContainer.get<ICommandManager>(ICommandManager).executeCommand('workbench.action.reloadWindow');
        }
    }
    private async getKey(resource: Resource, interpreter?: PythonInterpreter): Promise<string> {
        const resourcePortion = this.workspaceService.getWorkspaceFolderIdentifier(resource, workspacePathNameForGlobalWorkspaces);
        interpreter = interpreter ? interpreter : await this.interpreterService.getActiveInterpreter(resource);
        const interperterPortion = interpreter ? `${interpreter.path}-${interpreter.envName}` : '';
        return `${resourcePortion}-${interperterPortion}`;
    }

    private async onClearAnalysisCaches() {
        const values = await Promise.all([...this.cache.values()]);
        values.forEach(v => (v.clearAnalysisCache ? v.clearAnalysisCache() : noop()));
    }
}
