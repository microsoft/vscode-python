// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, named } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { CODE_RUNNER_EXTENSION_ID } from '../../../common/constants';
import { DeprecatePythonPath } from '../../../common/experiments/groups';
import { IDisposableRegistry, IExperimentsManager, IExtensions, Resource } from '../../../common/types';
import { Common, Diagnostics } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

export class UpgradeCodeRunnerDiagnostic extends BaseDiagnostic {
    constructor(message: string, resource: Resource) {
        super(
            DiagnosticCodes.UpgradeCodeRunnerDiagnostic,
            message,
            DiagnosticSeverity.Information,
            DiagnosticScope.Global,
            resource,
        );
    }
}

export const UpgradeCodeRunnerDiagnosticServiceId = 'UpgradeCodeRunnerDiagnosticServiceId';

export class UpgradeCodeRunnerDiagnosticService extends BaseDiagnosticsService {
    public _diagnosticReturned: boolean = false;
    private workspaceService: IWorkspaceService;
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IExtensions) private readonly extensions: IExtensions,
    ) {
        super([DiagnosticCodes.UpgradeCodeRunnerDiagnostic], serviceContainer, disposableRegistry, true);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        if (this._diagnosticReturned) {
            return [];
        }
        const experiments = this.serviceContainer.get<IExperimentsManager>(IExperimentsManager);
        experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        if (!experiments.inExperiment(DeprecatePythonPath.experiment)) {
            return [];
        }
        const extension = this.extensions.getExtension(CODE_RUNNER_EXTENSION_ID);
        if (!extension) {
            return [];
        }
        // Available feature flags: https://github.com/formulahendry/vscode-code-runner/blob/master/package.json#L6
        const flagValue: boolean | undefined = extension.packageJSON?.featureFlags?.usingNewPythonInterpreterPathApiV2;
        if (flagValue) {
            // Using new version of Code runner already, no need to upgrade
            return [];
        }
        const pythonExecutor = this.workspaceService
            .getConfiguration('code-runner', resource)
            .get<string>('executorMap.python');
        if (pythonExecutor?.includes('$pythonPath')) {
            this._diagnosticReturned = true;
            return [new UpgradeCodeRunnerDiagnostic(Diagnostics.upgradeCodeRunner(), resource)];
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
                prompt: Common.doNotShowAgain(),
                command: commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global }),
            },
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
}
