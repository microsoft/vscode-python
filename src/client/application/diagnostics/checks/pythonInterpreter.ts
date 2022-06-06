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
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import {
    DiagnosticScope,
    IDiagnostic,
    IDiagnosticCommand,
    IDiagnosticHandlerService,
    IDiagnosticMessageOnCloseHandler,
} from '../types';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

const messages = {
    [DiagnosticCodes.NoPythonInterpretersDiagnostic]: localize(
        'DiagnosticCodes.NoPythonInterpretersDiagnostic',
        'Python is not installed. Please download and install Python before using the extension.',
    ),
    [DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic]: localize(
        'DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic',
        'No Python interpreter is selected. You need to select a Python interpreter to enable features such as IntelliSense, linting, and debugging.',
    ),
};

export class InvalidPythonInterpreterDiagnostic extends BaseDiagnostic {
    constructor(
        code:
            | DiagnosticCodes.NoPythonInterpretersDiagnostic
            | DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
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
            [
                DiagnosticCodes.NoPythonInterpretersDiagnostic,
                DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
            ],
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
                new InvalidPythonInterpreterDiagnostic(
                    DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
                    resource,
                ),
            ];
        }

        return [];
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
                const onClose = getOnCloseHandler(diagnostic);
                await messageService.handle(diagnostic, { commandPrompts, message: diagnostic.message, onClose });
            }),
        );
    }

    private getCommandPrompts(diagnostic: IDiagnostic): { prompt: string; command?: IDiagnosticCommand }[] {
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        switch (diagnostic.code) {
            case DiagnosticCodes.NoPythonInterpretersDiagnostic: {
                return [
                    {
                        prompt: 'Download',
                        command: commandFactory.createCommand(diagnostic, {
                            type: 'launch',
                            options: 'https://www.python.org/downloads',
                        }),
                    },
                ];
            }
            case DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic: {
                return [
                    {
                        prompt: 'Select Python Interpreter',
                        command: commandFactory.createCommand(diagnostic, {
                            type: 'executeVSCCommand',
                            options: 'python.setInterpreter',
                        }),
                    },
                ];
            }
            default: {
                throw new Error("Invalid diagnostic for 'InvalidPythonInterpreterService'");
            }
        }
    }
}

function getOnCloseHandler(diagnostic: IDiagnostic): IDiagnosticMessageOnCloseHandler | undefined {
    if (diagnostic.code === DiagnosticCodes.NoPythonInterpretersDiagnostic) {
        return (response?: string) => {
            sendTelemetryEvent(EventName.PYTHON_NOT_INSTALLED_PROMPT, undefined, {
                selection: response ? 'Download' : 'Ignore',
            });
        };
    }
    return undefined;
}
