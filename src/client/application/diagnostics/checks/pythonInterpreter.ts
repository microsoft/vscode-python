// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import '../../../common/extensions';
import { IPlatformService } from '../../../common/platform/types';
import { IConfigurationService } from '../../../common/types';
import { IInterpreterHelper, IInterpreterService, InterpreterType } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService } from '../types';

const messages = {
    [DiagnosticCodes.NoPythonInterpretersDiagnostic]: 'Python is not installed. Please download and install Python before using the extension.',
    [DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic]: 'You have selected the macOS system install of Python, which is not not recommended for use with the Python extension. Some functionality will be limited, please select a different interpreter.',
    [DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic]: 'The macOS system install of Python is not recommended, some functionality in the extension will be limited. Install another version of Python for the best experience.'
};

export class InvalidPythonInterpreterDiagnostic extends BaseDiagnostic {
    constructor(code: DiagnosticCodes) {
        super(code, messages[code], DiagnosticSeverity.Error, DiagnosticScope.WorkspaceFolder);
    }
}

export const InvalidPythonInterpreterServiceId = 'InvalidPythonInterpreterServiceId';

@injectable()
export class InvalidPythonInterpreterService extends BaseDiagnosticsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super([DiagnosticCodes.NoPythonInterpretersDiagnostic,
        DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
        DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic], serviceContainer);
    }
    public async diagnose(): Promise<IDiagnostic[]> {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settings = configurationService.getSettings();
        if (settings.disableInstallationChecks === true) {
            return [];
        }

        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const interpreters = await interpreterService.getInterpreters();

        if (interpreters.length === 0) {
            return [new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.NoPythonInterpretersDiagnostic)];
        }

        const platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        if (!platform.isMac) {
            return [];
        }

        const helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        if (!helper.isMacDefaultPythonPath(settings.pythonPath)) {
            return [];
        }
        const interpreter = await interpreterService.getActiveInterpreter();
        if (!interpreter || interpreter.type !== InterpreterType.Unknown) {
            return [];
        }
        if (interpreters.filter(i => !helper.isMacDefaultPythonPath(i.path)).length === 0) {
            return [new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic)];
        }

        return [new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic)];
    }
    public async handle(diagnostics: IDiagnostic[]): Promise<void> {
        if (diagnostics.length === 0) {
            return;
        }
        const messageService = this.serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(IDiagnosticHandlerService, DiagnosticCommandPromptHandlerServiceId);
        await Promise.all(diagnostics.map(async diagnostic => {
            if (!this.canHandle(diagnostic)) {
                return;
            }
            const commandPrompts = this.getCommandPrompts(diagnostic);
            return messageService.handle(diagnostic, { commandPrompts, message: diagnostic.message });
        }));
    }
    private getCommandPrompts(diagnostic: IDiagnostic): { prompt: string; command?: IDiagnosticCommand }[] {
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        switch (diagnostic.code) {
            case DiagnosticCodes.NoPythonInterpretersDiagnostic: {
                return [{
                    prompt: 'Download',
                    command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://www.python.org/downloads' })
                }];
            }
            case DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic: {
                return [{
                    prompt: 'Select Python Interpreter',
                    command: commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: 'python.setInterpreter' })
                }];
            }
            case DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic: {
                return [{
                    prompt: 'Learn more',
                    command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites' })
                },
                {
                    prompt: 'Download',
                    command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://www.python.org/downloads' })
                }];
            }
            default: {
                throw new Error('Invalid diagnostic for \'InvalidPythonInterpreterService\'');
            }
        }
    }
}
