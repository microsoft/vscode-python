// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, OutputChannel, Uri } from 'vscode';
import { LSNotSupportedDiagnosticServiceId } from '../application/diagnostics/checks/lsNotSupported';
import { IDiagnosticsService } from '../application/diagnostics/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { LSControl, LSEnabled } from '../common/experimentGroups';
import '../common/extensions';
import { traceError } from '../common/logger';
import { IConfigurationService, IDisposableRegistry, IExperimentsManager, IOutputChannel, IPersistentStateFactory, IPythonSettings, Resource } from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IExtensionActivationService, ILanguageServerActivator, LanguageServerActivator } from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';
const workspacePathNameForGlobalWorkspaces = '';
type ActivatorInfo = { jedi: boolean; activator: ILanguageServerActivator };

@injectable()
export class LanguageServerExtensionActivationService implements IExtensionActivationService, Disposable {
    private lsActivatedWorkspaces = new Map<string, ILanguageServerActivator>();
    private currentActivator?: ActivatorInfo;
    private jediActivatedOnce: boolean = false;
    private readonly workspaceService: IWorkspaceService;
    private readonly output: OutputChannel;
    private readonly appShell: IApplicationShell;
    private readonly lsNotSupportedDiagnosticService: IDiagnosticsService;
    private resource!: Resource;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
        @inject(IExperimentsManager) private readonly abExperiments: IExperimentsManager) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
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
        let jedi = this.useJedi();
        if (!jedi) {
            if (this.lsActivatedWorkspaces.has(this.getWorkspacePathKey(resource))) {
                return;
            }
            const diagnostic = await this.lsNotSupportedDiagnosticService.diagnose(undefined);
            this.lsNotSupportedDiagnosticService.handle(diagnostic).ignoreErrors();
            if (diagnostic.length) {
                sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, { supported: false });
                jedi = true;
            }
        } else {
            if (this.jediActivatedOnce) {
                return;
            }
            this.jediActivatedOnce = true;
        }

        this.resource = resource;
        await this.logStartup(jedi);
        let activatorName = jedi ? LanguageServerActivator.Jedi : LanguageServerActivator.DotNet;
        let activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName);
        this.currentActivator = { jedi, activator };

        try {
            await activator.activate(resource);
            if (!jedi) {
                this.lsActivatedWorkspaces.set(this.getWorkspacePathKey(resource), activator);
            }
        } catch (ex) {
            if (jedi) {
                return;
            }
            //Language server fails, reverting to jedi
            if (this.jediActivatedOnce) {
                return;
            }
            this.jediActivatedOnce = true;
            jedi = true;
            await this.logStartup(jedi);
            activatorName = LanguageServerActivator.Jedi;
            activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName);
            this.currentActivator = { jedi, activator };
            await activator.activate(resource);
        }
    }

    public dispose() {
        if (this.currentActivator) {
            this.currentActivator.activator.dispose();
        }
    }
    @swallowExceptions('Switch Language Server')
    public async trackLangaugeServerSwitch(jediEnabled: boolean): Promise<void> {
        const state = this.stateFactory.createGlobalPersistentState<boolean | undefined>('SWITCH_LS', undefined);
        if (typeof state.value !== 'boolean') {
            await state.updateValue(jediEnabled);
            return;
        }
        if (state.value !== jediEnabled) {
            await state.updateValue(jediEnabled);
            const message = jediEnabled ? 'Switch to Jedi from LS' : 'Switch to LS from Jedi';
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_SWITCHED, undefined, { change: message });
        }
    }

    /**
     * Checks if user has not manually set `jediEnabled` setting
     * @param resource
     * @returns `true` if user has NOT manually added the setting and is using default configuration, `false` if user has `jediEnabled` setting added
     */
    public isJediUsingDefaultConfiguration(resource?: Uri): boolean {
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
        if (this.isJediUsingDefaultConfiguration()) {
            if (this.abExperiments.inExperiment(LSEnabled)) {
                return false;
            }
            // Send telemetry if user is in control group
            this.abExperiments.sendTelemetryIfInExperiment(LSControl);
        }
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const enabled = configurationService.getSettings(this.resource).jediEnabled;
        this.trackLangaugeServerSwitch(enabled).ignoreErrors();
        return enabled;
    }

    protected onWorkspaceFoldersChanged() {
        //If an activated workspace folder was removed, dispose its activator
        const workspaceKeys = this.workspaceService.workspaceFolders!.map(workspaceFolder => this.getWorkspacePathKey(workspaceFolder.uri));
        const activatedWkspcKeys = Array.from(this.lsActivatedWorkspaces.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter(item => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                this.lsActivatedWorkspaces.get(folder)!.dispose();
                this.lsActivatedWorkspaces!.delete(folder);
            }
        }
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
    private getWorkspacePathKey(resource: Resource): string {
        return this.workspaceService.getWorkspaceFolderIdentifier(resource, workspacePathNameForGlobalWorkspaces);
    }
}
