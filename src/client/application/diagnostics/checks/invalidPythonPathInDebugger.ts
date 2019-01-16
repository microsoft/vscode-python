// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { DiagnosticSeverity, Uri, workspace as workspc, WorkspaceFolder } from 'vscode';
import { openFile } from '../../../../test/common';
import { IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { traceError } from '../../../common/logger';
import { IConfigurationService } from '../../../common/types';
import { Diagnostics } from '../../../common/utils/localize';
import { SystemVariables } from '../../../common/variables/systemVariables';
import { IInterpreterHelper } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService, IInvalidPythonPathInDebuggerService } from '../types';

export class InvalidPythonPathInDebuggerSettingsDiagnostic extends BaseDiagnostic {
    constructor() {
        super(DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic,
            Diagnostics.invalidPythonPathInDebuggerSettings(), DiagnosticSeverity.Error, DiagnosticScope.WorkspaceFolder);
    }
}

export class InvalidPythonPathInDebuggerLaunchDiagnostic extends BaseDiagnostic {
    constructor() {
        super(DiagnosticCodes.InvalidPythonPathInDebuggerLaunchDiagnostic,
            Diagnostics.invalidPythonPathInDebuggerLaunch(), DiagnosticSeverity.Error, DiagnosticScope.WorkspaceFolder);
    }
}

export const InvalidPythonPathInDebuggerServiceId = 'InvalidPythonPathInDebuggerServiceId';

@injectable()
export class InvalidPythonPathInDebuggerService extends BaseDiagnosticsService implements IInvalidPythonPathInDebuggerService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDiagnosticsCommandFactory) private readonly commandFactory: IDiagnosticsCommandFactory,
        @inject(IInterpreterHelper) private readonly interpreterHelper: IInterpreterHelper,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IDiagnosticHandlerService) @named(DiagnosticCommandPromptHandlerServiceId) protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>) {
        super([DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic, DiagnosticCodes.InvalidPythonPathInDebuggerLaunchDiagnostic], serviceContainer);
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
        const commandPrompts = this.getCommandPrompts(diagnostic);

        await this.messageService.handle(diagnostic, { commandPrompts });
    }
    public async validatePythonPath(pythonPath?: string, resource?: Uri) {
        pythonPath = pythonPath ? this.resolveVariables(pythonPath, resource) : undefined;
        let pathInLaunchJson = true;
        // tslint:disable-next-line:no-invalid-template-strings
        if (pythonPath === '${config:python.pythonPath}' || !pythonPath) {
            pathInLaunchJson = false;
            pythonPath = this.configService.getSettings(resource).pythonPath;
        }
        if (await this.interpreterHelper.getInterpreterInformation(pythonPath).catch(() => undefined)) {
            return true;
        }
        traceError(`Invalid Python Path '${pythonPath}'`);
        if (pathInLaunchJson) {
            this.handle([new InvalidPythonPathInDebuggerLaunchDiagnostic()])
                .catch(ex => traceError('Failed to handle invalid python path in launch.json debugger', ex))
                .ignoreErrors();
        } else {
            this.handle([new InvalidPythonPathInDebuggerSettingsDiagnostic()])
                .catch(ex => traceError('Failed to handle invalid python path in settings.json debugger', ex))
                .ignoreErrors();
        }
        return false;
    }
    protected resolveVariables(pythonPath: string, resource: Uri | undefined): string {
        const workspaceFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const systemVariables = new SystemVariables(workspaceFolder ? workspaceFolder.uri.fsPath : undefined);
        return systemVariables.resolveAny(pythonPath);
    }
    private getCommandPrompts(diagnostic: IDiagnostic): { prompt: string; command?: IDiagnosticCommand }[] {
        switch (diagnostic.code) {
            case DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic: {
                return [{
                    prompt: 'Select Python Interpreter',
                    command: this.commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: 'python.setInterpreter' })
                }];
            }
            case DiagnosticCodes.InvalidPythonPathInDebuggerLaunchDiagnostic: {
                return [{
                    prompt: 'Open launch.json',
                    // tslint:disable-next-line:no-object-literal-type-assertion
                    command: {
                        diagnostic, invoke: async (): Promise<void> => {
                            const launchJson = this.getLaunchJsonFile(workspc.workspaceFolders[0]);
                            await openFile(launchJson);
                        }
                    }
                }];
            }
            default: {
                throw new Error('Invalid diagnostic for \'InvalidPythonPathInDebuggerService\'');
            }
        }
    }
    private getLaunchJsonFile(workspaceFolder: WorkspaceFolder) {
        return path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
    }
}
