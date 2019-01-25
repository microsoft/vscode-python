// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, OutputChannel, Uri } from 'vscode';
import { LSNotSupportedDiagnosticServiceId } from '../application/diagnostics/checks/lsNotSupported';
import { IDiagnosticsService } from '../application/diagnostics/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings, Resource } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IExtensionActivationService, ILanguageServerActivator, LanguageServerActivator } from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';
type ActivatorInfo = { jedi: boolean; activator: ILanguageServerActivator };

@injectable()
export class LanguageServerExtensionActivationService implements IExtensionActivationService, Disposable {
    private currentActivator?: ActivatorInfo;
    private activatedOnce: boolean = false;
    private readonly workspaceService: IWorkspaceService;
    private readonly output: OutputChannel;
    private readonly appShell: IApplicationShell;
    private readonly lsNotSupportedDiagnosticService: IDiagnosticsService;
    private resource!: Resource;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
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
    }

    public async activate(resource: Resource): Promise<void> {
        if (this.currentActivator || this.activatedOnce) {
            return;
        }
        this.resource = resource;
        this.activatedOnce = true;

        let jedi = this.useJedi();
        if (!jedi) {
            const diagnostic = await this.lsNotSupportedDiagnosticService.diagnose(undefined);
            this.lsNotSupportedDiagnosticService.handle(diagnostic).ignoreErrors();
            if (diagnostic.length) {
                sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_NOT_SUPPORTED);
                jedi = true;
            }
        }

        await this.logStartup(jedi);

        let activatorName = jedi ? LanguageServerActivator.Jedi : LanguageServerActivator.DotNet;
        let activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName);
        this.currentActivator = { jedi, activator };

        try {
            await activator.activate();
            return;
        } catch (ex) {
            if (jedi) {
                return;
            }
            //Language server fails, reverting to jedi
            jedi = true;
            await this.logStartup(jedi);
            activatorName = LanguageServerActivator.Jedi;
            activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName);
            this.currentActivator = { jedi, activator };
            await activator.activate();
        }
    }

    public dispose() {
        if (this.currentActivator) {
            this.currentActivator.activator.dispose();
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
    private useJedi(): boolean {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        return configurationService.getSettings(this.resource).jediEnabled;
    }
}
