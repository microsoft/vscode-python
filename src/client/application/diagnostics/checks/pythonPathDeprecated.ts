// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, named } from 'inversify';
import { ConfigurationTarget, DiagnosticSeverity } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../../common/constants';
import { DeprecatePythonPath } from '../../../common/experiments/groups';
import { IDisposableRegistry, IExperimentsManager, IOutputChannel, Resource } from '../../../common/types';
import { Common, Diagnostics } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

export class PythonPathDeprecatedDiagnostic extends BaseDiagnostic {
    constructor(message: string, resource: Resource) {
        super(
            DiagnosticCodes.PythonPathDeprecatedDiagnostic,
            message,
            DiagnosticSeverity.Information,
            DiagnosticScope.WorkspaceFolder,
            resource
        );
    }
}

export const PythonPathDeprecatedDiagnosticServiceId = 'PythonPathDeprecatedDiagnosticServiceId';

export class PythonPathDeprecatedDiagnosticService extends BaseDiagnosticsService {
    private workspaceService: IWorkspaceService;
    private output: IOutputChannel;
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        super([DiagnosticCodes.PythonPathDeprecatedDiagnostic], serviceContainer, disposableRegistry, true);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.output = this.serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    }
    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        const experiments = this.serviceContainer.get<IExperimentsManager>(IExperimentsManager);
        experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        if (!experiments.inExperiment(DeprecatePythonPath.experiment)) {
            return [];
        }
        const setting = this.workspaceService.getConfiguration('python', resource).inspect<string>('pythonPath');
        if (!setting) {
            return [];
        }
        const isCodeWorkspaceSettingSet = this.workspaceService.workspaceFile && setting.workspaceValue !== undefined;
        const isSettingsJsonSettingSet = setting.workspaceFolderValue !== undefined;
        if (isCodeWorkspaceSettingSet || isSettingsJsonSettingSet) {
            return [new PythonPathDeprecatedDiagnostic(Diagnostics.removedPythonPathFromSettings(), resource)];
        }
        return [];
    }

    public async _removePythonPathFromWorkspaceSettings(resource: Resource) {
        const workspaceConfig = this.workspaceService.getConfiguration('python', resource);
        await Promise.all([
            workspaceConfig.update('pythonPath', undefined, ConfigurationTarget.Workspace),
            workspaceConfig.update('pythonPath', undefined, ConfigurationTarget.WorkspaceFolder)
        ]);
    }

    protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        if (diagnostics.length === 0 || !(await this.canHandle(diagnostics[0]))) {
            return;
        }
        const diagnostic = diagnostics[0];
        if (await this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
            return;
        }
        await this._removePythonPathFromWorkspaceSettings(diagnostic.resource);
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        const options = [
            {
                prompt: Common.openOutputPanel(),
                command: {
                    diagnostic,
                    invoke: async (): Promise<void> => this.output.show(true)
                }
            },
            {
                prompt: Common.doNotShowAgain(),
                command: commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global })
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
}
