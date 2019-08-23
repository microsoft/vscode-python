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
import {
    IConfigurationService, IDisposableRegistry, IExperimentsManager, IOutputChannel,
    IPersistentStateFactory, IPythonSettings, LanguageServerType, Resource
} from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IExtensionActivationService, ILanguageServerActivator, LanguageServerActivator } from './types';

const languageServerSetting: keyof IPythonSettings = 'languageServer';
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
        let lsSettingValue = this.getLanguageServerSetting();
        if (lsSettingValue === 'microsoft') {
            if (this.lsActivatedWorkspaces.has(this.getWorkspacePathKey(resource))) {
                return;
            }
            const diagnostic = await this.lsNotSupportedDiagnosticService.diagnose(undefined);
            this.lsNotSupportedDiagnosticService.handle(diagnostic).ignoreErrors();
            if (diagnostic.length) {
                sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, { supported: false });
                lsSettingValue = 'jedi';
            }
        } else {
            if (this.jediActivatedOnce) {
                return;
            }
            this.jediActivatedOnce = true;
        }

        this.resource = resource;
        await this.logStartup(lsSettingValue);
        if (lsSettingValue === 'none') {
            this.currentActivator = undefined;
            return;
        }
        let activatorName = lsSettingValue === 'jedi' ? LanguageServerActivator.Jedi : LanguageServerActivator.DotNet;
        let activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName);
        this.currentActivator = { jedi: lsSettingValue === 'jedi', activator };

        try {
            await activator.activate(resource);
            if (lsSettingValue === 'microsoft') {
                this.lsActivatedWorkspaces.set(this.getWorkspacePathKey(resource), activator);
            }
        } catch (ex) {
            if (lsSettingValue === 'jedi') {
                return;
            }
            //Language server fails, reverting to jedi
            if (this.jediActivatedOnce) {
                return;
            }
            this.jediActivatedOnce = true;
            lsSettingValue = 'jedi';
            await this.logStartup(lsSettingValue);
            activatorName = LanguageServerActivator.Jedi;
            activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName);
            this.currentActivator = { jedi: lsSettingValue === 'jedi', activator };
            await activator.activate(resource);
        }
    }

    public dispose() {
        if (this.currentActivator) {
            this.currentActivator.activator.dispose();
        }
    }

    @swallowExceptions('Switch Language Server')
    public async trackLanguageServerSwitch(newValue: LanguageServerType): Promise<void> {
        const state = this.stateFactory.createGlobalPersistentState<LanguageServerType | undefined>('SWITCH_LS', undefined);
        if (typeof state.value !== 'string') {
            await state.updateValue(newValue);
            return;
        }
        const oldValue = state.value;
        if (oldValue !== newValue) {
            await state.updateValue(newValue);
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_SWITCHED, undefined, { oldValue, newValue });
        }
    }

    /**
     * Checks if user has not manually set `languageServer` setting
     * @param resource
     * @returns `true` if user has NOT manually added the setting and is using default configuration, `false` if user has `languageServer` setting added
     */
    public isLanguageServerUsingDefaultConfiguration(resource?: Uri): boolean {
        const settings = this.workspaceService.getConfiguration('python', resource).inspect<LanguageServerType>('languageServer');
        if (!settings) {
            traceError('WorkspaceConfiguration.inspect returns `undefined` for setting `python.languageServer`');
            return false;
        }
        return (settings.globalValue === undefined && settings.workspaceValue === undefined && settings.workspaceFolderValue === undefined);
    }

    /**
     * Checks if user is using Jedi as intellisense
     * @returns `jedi` if user is using jedi, `microsoft` if user is using language server
     * or `none` if using neither.
     */
    public getLanguageServerSetting(): LanguageServerType {
        if (this.isLanguageServerUsingDefaultConfiguration()) {
            if (this.abExperiments.inExperiment(LSEnabled)) {
                return 'microsoft';
            }
            // Send telemetry if user is in control group
            this.abExperiments.sendTelemetryIfInExperiment(LSControl);
        }
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const languageServerValue = configurationService.getSettings(this.resource).languageServer.toLowerCase();
        let languageServerType: LanguageServerType;

        // Make sure the value is one of the allowed values.
        if (languageServerValue === 'microsoft') {
            languageServerType = 'microsoft';
        } else if (languageServerValue === 'none') {
            languageServerType = 'none';
        } else {
            // Map everything else to the default value.
            languageServerType = 'jedi';
        }

        this.trackLanguageServerSwitch(languageServerType).ignoreErrors();

        return languageServerType;
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

    private async logStartup(lsSettingValue: LanguageServerType): Promise<void> {
        let outputLine: string;
        if (lsSettingValue === 'jedi') {
            outputLine = 'Starting Jedi Python language engine.';
        } else if (lsSettingValue === 'none') {
            outputLine = 'No language server started.';
        } else {
            outputLine = 'Starting Microsoft Python language server.';
        }
        this.output.appendLine(outputLine);
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders!.map(workspace => workspace.uri)
            : [undefined];
        if (workspacesUris.findIndex(uri => event.affectsConfiguration(`python.${languageServerSetting}`, uri)) === -1) {
            return;
        }
        const newSettingValue = this.getLanguageServerSetting();

        // If the setting value doesn't require a change in activators, return without doing anything.
        if (newSettingValue === 'none') {
            if (this.currentActivator === undefined) {
                return;
            }
        } else {
            if (this.currentActivator && this.currentActivator.jedi === (newSettingValue === 'jedi')) {
                return;
            }
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
