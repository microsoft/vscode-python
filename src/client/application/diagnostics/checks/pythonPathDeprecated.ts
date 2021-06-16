// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { inject, named } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experiments/groups';
import { IDisposableRegistry, IExperimentService, Resource } from '../../../common/types';
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
            resource,
        );
    }
}

export const PythonPathDeprecatedDiagnosticServiceId = 'PythonPathDeprecatedDiagnosticServiceId';

export class PythonPathDeprecatedDiagnosticService extends BaseDiagnosticsService {
    private workspaceService: IWorkspaceService;

    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
    ) {
        super([DiagnosticCodes.PythonPathDeprecatedDiagnostic], serviceContainer, disposableRegistry, true);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        const experiments = this.serviceContainer.get<IExperimentService>(IExperimentService);
        if (!experiments.inExperimentSync(DeprecatePythonPath.experiment)) {
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

    protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        if (diagnostics.length === 0 || !(await this.canHandle(diagnostics[0]))) {
            return;
        }
        const diagnostic = diagnostics[0];
        if (await this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
            return;
        }
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        const options = [
            {
                prompt: Common.ok(),
            },
        ];
        const command = commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global });
        await command.invoke();
        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
}
