// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DiagnosticSeverity, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { Logger, traceError } from '../../../common/logger';
import { IConfigurationService } from '../../../common/types';
import { SystemVariables } from '../../../common/variables/systemVariables';
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
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDiagnosticsCommandFactory) private readonly commandFactory: IDiagnosticsCommandFactory,
        @inject(IInterpreterHelper) private readonly interpreterHelper: IInterpreterHelper,
        @inject(IConfigurationService) private readonly configService: IConfigurationService) {
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
        const options = [
            {
                prompt: 'Select Python Interpreter',
                command: this.commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: CommandName })
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
    public async validatePythonPath(pythonPath?: string, resource?: Uri) {
        pythonPath = pythonPath ? this.resolveVariables(pythonPath, resource) : undefined;
        // tslint:disable-next-line:no-invalid-template-strings
        if (pythonPath === '${config:python.pythonPath}' || !pythonPath) {
            pythonPath = this.configService.getSettings(resource).pythonPath;
        }
        if (await this.interpreterHelper.getInterpreterInformation(pythonPath).catch(() => undefined)) {
            return true;
        }
        traceError(`Invalid Python Path '${pythonPath}'`);
        this.handle([new InvalidPythonPathInDebuggerDiagnostic()])
            .catch(ex => Logger.error('Failed to handle invalid python path in debugger', ex))
            .ignoreErrors();
        return false;
    }
    protected resolveVariables(pythonPath: string, resource: Uri | undefined): string {
        const workspaceFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const systemVariables = new SystemVariables(workspaceFolder ? workspaceFolder.uri.fsPath : undefined);
        return systemVariables.resolveAny(pythonPath);
    }
}
