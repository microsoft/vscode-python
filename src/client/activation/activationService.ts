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
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IOutputChannel,
    IPersistentStateFactory,
    IPythonSettings,
    Resource
} from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { IInterpreterService, PythonInterpreter } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import {
    IExtensionActivationService,
    ILanguageServer,
    ILanguageServerActivator,
    ILanguageServerCache,
    LanguageServerActivator
} from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';
const workspacePathNameForGlobalWorkspaces = '';
type ActivatorInfo = { jedi: boolean; server: ILanguageServerActivator };

@injectable()
export class LanguageServerExtensionActivationService implements IExtensionActivationService, ILanguageServerCache, Disposable {
    private lsActivatedServers = new Map<string, Promise<ILanguageServerActivator>>();
    private jediServer: ILanguageServerActivator | undefined;
    private currentActivator?: ActivatorInfo;
    private readonly workspaceService: IWorkspaceService;
    private readonly output: OutputChannel;
    private readonly appShell: IApplicationShell;
    private readonly lsNotSupportedDiagnosticService: IDiagnosticsService;
    private readonly interpreterService: IInterpreterService;
    private resource!: Resource;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
        @inject(IExperimentsManager) private readonly abExperiments: IExperimentsManager) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.output = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.lsNotSupportedDiagnosticService = this.serviceContainer.get<IDiagnosticsService>(
            IDiagnosticsService,
            LSNotSupportedDiagnosticServiceId
        );
        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        disposables.push(this);
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
        disposables.push(this.workspaceService.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
    }

    public async activate(resource: Resource): Promise<void> {
        this.resource = resource;
        // Do the same thing as a get.
        await this.get(resource);
    }

    public async get(resource: Resource, interpreter?: PythonInterpreter): Promise<ILanguageServer> {
        // See if we already have it or not
        const key = await this.getKey(resource, interpreter);
        let result: Promise<ILanguageServerActivator> | undefined = this.lsActivatedServers.get(key);
        if (!result) {
            result = this.createServer(resource, interpreter);
            this.lsActivatedServers.set(key, result);
        }
        return result;
    }

    public dispose() {
        if (this.currentActivator) {
            this.currentActivator.server.dispose();
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
        return (settings.globalValue === undefined && settings.workspaceValue === undefined && settings.workspaceFolderValue === undefined);
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
        const enabled = configurationService.getSettings(this.resource).jediEnabled;
        this.sendTelemetryForChosenLanguageServer(enabled).ignoreErrors();
        return enabled;
    }

    protected async onWorkspaceFoldersChanged() {
        //If an activated workspace folder was removed, dispose its activator
        const workspaceKeys = await Promise.all(this.workspaceService.workspaceFolders!.map(workspaceFolder => this.getKey(workspaceFolder.uri)));
        const activatedWkspcKeys = Array.from(this.lsActivatedServers.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter(item => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                this.lsActivatedServers.get(folder)!.then(a => a.dispose()).ignoreErrors();
                this.lsActivatedServers!.delete(folder);
            }
        }
    }

    private async createServer(resource: Resource, interpreter?: PythonInterpreter): Promise<ILanguageServerActivator> {
        let jedi = this.useJedi();
        if (!jedi) {
            const diagnostic = await this.lsNotSupportedDiagnosticService.diagnose(undefined);
            this.lsNotSupportedDiagnosticService.handle(diagnostic).ignoreErrors();
            if (diagnostic.length) {
                sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, { supported: false });
                jedi = true;
            }
        } else if (this.jediServer) {
            return this.jediServer;
        }

        await this.logStartup(jedi);
        let serverName = jedi ? LanguageServerActivator.Jedi : LanguageServerActivator.DotNet;
        let server = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, serverName);
        this.currentActivator = { jedi, server };

        try {
            await server.activate(resource);
        } catch (ex) {
            if (jedi) {
                throw ex;
            }
            jedi = true;
            await this.logStartup(jedi);
            serverName = LanguageServerActivator.Jedi;
            server = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, serverName);
            this.currentActivator = { jedi, server };
            await server.activate(resource, interpreter);
        }

        // Jedi is always a singleton. Don't need to create it more than once.
        if (jedi) {
            this.jediServer = server;
        }

        return server;
    }

    private async logStartup(isJedi: boolean): Promise<void> {
        const outputLine = isJedi
            ? 'Starting Jedi Python language engine.'
            : 'Starting Microsoft Python language server.';
        this.output.appendLine(outputLine);
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders!.map(workspace => workspace.uri)
            : [undefined];
        if (workspacesUris.findIndex(uri => event.affectsConfiguration(`python.${jediEnabledSetting}`, uri)) === -1) {
            return;
        }
        const jedi = this.useJedi();
        if (this.currentActivator && this.currentActivator.jedi === jedi) {
            return;
        }

        const item = await this.appShell.showInformationMessage(
            'Please reload the window switching between language engines.',
            'Reload'
        );
        if (item === 'Reload') {
            this.serviceContainer.get<ICommandManager>(ICommandManager).executeCommand('workbench.action.reloadWindow');
        }
    }
    private async getKey(resource: Resource, interpreter?: PythonInterpreter): Promise<string> {
        const resourcePortion = this.workspaceService.getWorkspaceFolderIdentifier(resource, workspacePathNameForGlobalWorkspaces);
        interpreter = interpreter ? interpreter : await this.interpreterService.getActiveInterpreter(resource);
        const interperterPortion = interpreter ? interpreter.path : '';
        return `${resourcePortion}-${interperterPortion}`;
    }
}
