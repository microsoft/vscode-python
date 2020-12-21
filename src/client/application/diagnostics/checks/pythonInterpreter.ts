// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import '../../../common/extensions';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../../common/types';
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

const messages = {
    [DiagnosticCodes.NoPythonInterpretersDiagnostic]:
        'Python is not installed. Please download and install Python before using the extension.',
    [DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic]:
        'No Python interpreter is selected. You need to select a Python interpreter to enable features such as IntelliSense, linting, and debugging.',
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
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settings = configurationService.getSettings(resource);
        if (settings.disableInstallationChecks === true) {
            return [];
        }

        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        // hasInterpreters being false can mean one of 2 things:
        // 1. getInterpreters hasn't returned any interpreters;
        // 2. getInterpreters hasn't run yet.
        // We want to make sure that false comes from 1, so we're adding this fix until we refactor interpreter discovery.
        // Also see https://github.com/microsoft/vscode-python/issues/3023.
        const hasInterpreters =
            (await interpreterService.hasInterpreters) ||
            (await interpreterService.getInterpreters(resource)).length > 0;

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
                const onClose = this.getOnCloseHandler(diagnostic);
                return messageService.handle(diagnostic, { commandPrompts, message: diagnostic.message, onClose });
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
    private getOnCloseHandler(diagnostic: IDiagnostic): IDiagnosticMessageOnCloseHandler | undefined {
        if (diagnostic.code === DiagnosticCodes.NoPythonInterpretersDiagnostic) {
            return (response?: string) => {
                sendTelemetryEvent(EventName.PYTHON_NOT_INSTALLED_PROMPT, undefined, {
                    selection: response ? 'Download' : 'Ignore',
                });
            };
        }

        return;
    }
}
