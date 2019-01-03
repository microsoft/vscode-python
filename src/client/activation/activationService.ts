// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    ConfigurationChangeEvent, DiagnosticSeverity,
    Disposable, OutputChannel, Uri
} from 'vscode';
import { BaseDiagnostic, BaseDiagnosticsService } from '../application/diagnostics/base';
import { IDiagnosticsCommandFactory } from '../application/diagnostics/commands/types';
import { DiagnosticCodes } from '../application/diagnostics/constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../application/diagnostics/promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../application/diagnostics/types';
import {
    IApplicationShell, ICommandManager,
    IWorkspaceService
} from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import '../common/extensions';
import {
    IConfigurationService, IDisposableRegistry,
    IOutputChannel, IPythonSettings
} from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { PYTHON_LANGUAGE_SERVER_PLATFORM_NOT_SUPPORTED } from '../telemetry/constants';
import {
    ExtensionActivators, IExtensionActivationService,
    IExtensionActivator,
    ILanguageServerCompatibilityService
} from './types';

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled';
const lsNotSupported = 'Your operating system does not meet the minimum requirements of the Language Server. Reverting to the alternative, Jedi';
type ActivatorInfo = { jedi: boolean; activator: IExtensionActivator };

export class LSNotSupportedDiagnostic extends BaseDiagnostic {
    constructor(message) {
        super(DiagnosticCodes.LSNotSupportedDiagnostic,
            message, DiagnosticSeverity.Warning, DiagnosticScope.Global);
    }
}

export class LSNotSupportedDiagnosticService extends BaseDiagnosticsService {
    protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super([DiagnosticCodes.LSNotSupportedDiagnostic], serviceContainer);
        this.messageService = serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(IDiagnosticHandlerService, DiagnosticCommandPromptHandlerServiceId);
    }
    public async diagnose(): Promise<IDiagnostic[]>{
        return [new LSNotSupportedDiagnostic(lsNotSupported)];
    }
    public async handle(diagnostics: IDiagnostic[]): Promise<void>{
        if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
            return;
        }
        const diagnostic = diagnostics[0];
        if (await this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
            return;
        }
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        const options = [
            {
                prompt: 'More Info',
                command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://aka.ms/AA3qqka' })
            },
            {
                prompt: 'Do not show again',
                command: commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global })
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
}

@injectable()
export class ExtensionActivationService implements IExtensionActivationService, Disposable {
    private currentActivator?: ActivatorInfo;
    private readonly workspaceService: IWorkspaceService;
    private readonly output: OutputChannel;
    private readonly appShell: IApplicationShell;
    private readonly lsNotSupportedDiagnosticService: LSNotSupportedDiagnosticService;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(ILanguageServerCompatibilityService) private readonly lsCompatibility: ILanguageServerCompatibilityService) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.output = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.lsNotSupportedDiagnosticService = new LSNotSupportedDiagnosticService(serviceContainer);
        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        disposables.push(this);
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }

    public async activate(): Promise<void> {
        if (this.currentActivator) {
            return;
        }

        let jedi = this.useJedi();
        if (!jedi && !await this.lsCompatibility.isSupported()) {
            sendTelemetryEvent(PYTHON_LANGUAGE_SERVER_PLATFORM_NOT_SUPPORTED);
            const diagnostic: IDiagnostic[] = await this.lsNotSupportedDiagnosticService.diagnose();
            await this.lsNotSupportedDiagnosticService.handle(diagnostic);
            jedi = true;
        }

        await this.logStartup(jedi);

        const activatorName = jedi ? ExtensionActivators.Jedi : ExtensionActivators.DotNet;
        const activator = this.serviceContainer.get<IExtensionActivator>(IExtensionActivator, activatorName);
        this.currentActivator = { jedi, activator };

        await activator.activate();
    }

    public dispose() {
        if (this.currentActivator) {
            this.currentActivator.activator.deactivate().ignoreErrors();
        }
    }

    private async logStartup(isJedi: boolean): Promise<void> {
        const outputLine = isJedi ? 'Starting Jedi Python language engine.' : 'Starting Microsoft Python language server.';
        this.output.appendLine(outputLine);
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders!.map(workspace => workspace.uri) : [undefined];
        if (workspacesUris.findIndex(uri => event.affectsConfiguration(`python.${jediEnabledSetting}`, uri)) === -1) {
            return;
        }
        const jedi = this.useJedi();
        if (this.currentActivator && this.currentActivator.jedi === jedi) {
            return;
        }

        const item = await this.appShell.showInformationMessage('Please reload the window switching between language engines.', 'Reload');
        if (item === 'Reload') {
            this.serviceContainer.get<ICommandManager>(ICommandManager).executeCommand('workbench.action.reloadWindow');
        }
    }
    private useJedi(): boolean {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders!.map(item => item.uri) : [undefined];
        const configuraionService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        return workspacesUris.filter(uri => configuraionService.getSettings(uri).jediEnabled).length > 0;
    }
}
