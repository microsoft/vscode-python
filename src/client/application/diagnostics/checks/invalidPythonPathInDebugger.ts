// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DiagnosticSeverity, Uri } from 'vscode';
import '../../../common/extensions';
import { Logger } from '../../../common/logger';
import { IConfigurationService } from '../../../common/types';
import { IInterpreterHelper } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService, IInvalidPythonPathInDebuggerService } from '../types';

const InvalidPythonPathInDebuggerMessage = 'You need to select a Python interpreter before you start debugging.\n\nTip: click on "Select Python Interpreter" in the status bar.';

export class InvalidPythonPathInDebuggerDiagnostic extends BaseDiagnostic {
    constructor() {
        super(DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            InvalidPythonPathInDebuggerMessage, DiagnosticSeverity.Error, DiagnosticScope.WorkspaceFolder);
    }
}

export const InvalidPythonPathInDebuggerServiceId = 'InvalidPythonPathInDebuggerServiceId';

const CommandName = 'python.setInterpreter';

@injectable()
export class InvalidPythonPathInDebuggerService extends BaseDiagnosticsService implements IInvalidPythonPathInDebuggerService {
    protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super([DiagnosticCodes.InvalidPythonPathInDebuggerDiagnostic], serviceContainer);
        this.messageService = serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(IDiagnosticHandlerService, DiagnosticCommandPromptHandlerServiceId);
    }
    public async diagnose(): Promise<IDiagnostic[]> {
        return [];
    }
    public async handle(diagnostics: IDiagnostic[]): Promise<void> {
        // This class can only handle one type of diagnostic, hence just use first item in list.
        if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
            return;
        }
        const diagnostic = diagnostics[0];
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        const options = [
            {
                prompt: 'Select Python Interpreter',
                command: commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: CommandName })
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
    public async validatePythonPath(pythonPath?: string, resource?: Uri) {
        // tslint:disable-next-line:no-invalid-template-strings
        if (pythonPath === '${config:python.pythonPath}' || !pythonPath) {
            const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
            pythonPath = configService.getSettings(resource).pythonPath;
        }
        const helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        if (await helper.getInterpreterInformation(pythonPath).catch(() => undefined)) {
            return true;
        }

        this.handle([new InvalidPythonPathInDebuggerDiagnostic()])
            .catch(ex => Logger.error('Failed to handle invalid python path in debugger', ex))
            .ignoreErrors();
        return false;
    }
}
