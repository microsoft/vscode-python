// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { inject, injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import '../../../common/extensions';
import * as nls from 'vscode-nls';
import { IDisposableRegistry, Resource } from '../../../common/types';
import { IInterpreterService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService } from '../types';
import { Common } from '../../../common/utils/localize';
import { Commands } from '../../../common/constants';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

const messages = {
    [DiagnosticCodes.NoPythonInterpretersDiagnostic]: localize(
        'DiagnosticCodes.NoPythonInterpretersDiagnostic',
        'No Python interpreter is selected. You need to select a Python interpreter to enable features such as IntelliSense, linting, and debugging.',
    ),
    [DiagnosticCodes.InvalidPythonInterpreterDiagnostic]: localize(
        'DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic',
        'An Invalid Python interpreter is selected, please try changing it to enable features such as IntelliSense, linting, and debugging.',
    ),
};

export class InvalidPythonInterpreterDiagnostic extends BaseDiagnostic {
    constructor(
        code: DiagnosticCodes.NoPythonInterpretersDiagnostic | DiagnosticCodes.InvalidPythonInterpreterDiagnostic,
        resource: Resource,
    ) {
        super(code, messages[code], DiagnosticSeverity.Error, DiagnosticScope.WorkspaceFolder, resource);
    }
}

export const InvalidPythonInterpreterServiceId = 'InvalidPythonInterpreterServiceId';

@injectable()
export class InvalidPythonInterpreterService extends BaseDiagnosticsService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
    ) {
        super(
            [DiagnosticCodes.NoPythonInterpretersDiagnostic, DiagnosticCodes.InvalidPythonInterpreterDiagnostic],
            serviceContainer,
            disposableRegistry,
            false,
        );
    }

    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const hasInterpreters = await interpreterService.hasInterpreters();

        if (!hasInterpreters) {
            return [new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.NoPythonInterpretersDiagnostic, resource)];
        }

        const currentInterpreter = await interpreterService.getActiveInterpreter(resource);
        if (!currentInterpreter) {
            return [
                new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.InvalidPythonInterpreterDiagnostic, resource),
            ];
        }
        return [];
    }

    public async validateInterpreterPathInSettings(resource: Resource): Promise<boolean> {
        const diagnostics = await this.diagnose(resource);
        if (!diagnostics.length) {
            return true;
        }
        this.handle(diagnostics).ignoreErrors();
        return false;
    }

    protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        if (diagnostics.length === 0) {
            return;
        }
        const messageService = this.serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(
            IDiagnosticHandlerService,
            DiagnosticCommandPromptHandlerServiceId,
        );
        await Promise.all(
            diagnostics.map(async (diagnostic) => {
                if (!this.canHandle(diagnostic)) {
                    return;
                }
                const commandPrompts = this.getCommandPrompts(diagnostic);
                await messageService.handle(diagnostic, { commandPrompts, message: diagnostic.message });
            }),
        );
    }

    private getCommandPrompts(diagnostic: IDiagnostic): { prompt: string; command?: IDiagnosticCommand }[] {
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        return [
            {
                prompt: Common.selectPythonInterpreter,
                command: commandFactory.createCommand(diagnostic, {
                    type: 'executeVSCCommand',
                    options: Commands.Set_Interpreter,
                }),
            },
        ];
    }
}
