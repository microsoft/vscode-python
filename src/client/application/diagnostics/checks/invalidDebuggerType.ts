// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { DiagnosticSeverity, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { IFileSystem } from '../../../common/platform/types';
import { IDisposableRegistry, Resource } from '../../../common/types';
import { Diagnostics } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

const messages = {
    [DiagnosticCodes.InvalidDebuggerTypeDiagnostic]:
        Diagnostics.invalidDebuggerTypeDiagnostic(),
    [DiagnosticCodes.JustMyCodeDiagnostic]:
        Diagnostics.justMyCodeDiagnostic()
};

export class InvalidLaunchJsonDebuggerDiagnostic extends BaseDiagnostic {
    constructor(code: DiagnosticCodes.InvalidDebuggerTypeDiagnostic | DiagnosticCodes.JustMyCodeDiagnostic, resource: Resource) {
        super(
            code,
            messages[code],
            DiagnosticSeverity.Error,
            DiagnosticScope.WorkspaceFolder,
            resource,
            'always'
        );
    }
}

export const InvalidLaunchJsonDebuggerServiceId = 'InvalidLaunchJsonDebuggerServiceId';

@injectable()
export class InvalidLaunchJsonDebuggerService extends BaseDiagnosticsService {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDiagnosticHandlerService)
        @named(DiagnosticCommandPromptHandlerServiceId)
        private readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>
    ) {
        super([DiagnosticCodes.InvalidDebuggerTypeDiagnostic, DiagnosticCodes.JustMyCodeDiagnostic], serviceContainer, disposableRegistry, true);
    }
    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        return ([] as IDiagnostic[])
            .concat(await this.diagnoseCode(DiagnosticCodes.InvalidDebuggerTypeDiagnostic, resource))
            .concat(await this.diagnoseCode(DiagnosticCodes.JustMyCodeDiagnostic, resource));
    }
    protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        diagnostics.forEach(diagnostic => this.handleDiagnostic(diagnostic));
    }
    private async handleDiagnostic(diagnostic: IDiagnostic): Promise<void> {
        if (!this.canHandle(diagnostic)) {
            return;
        }
        const commandPrompts = [
            {
                prompt: Diagnostics.bannerLabelYes(),
                command: {
                    diagnostic,
                    invoke: async (): Promise<void> => {
                        await this.fixLaunchJson(diagnostic.code);
                    }
                }
            },
            {
                prompt: Diagnostics.bannerLabelNo()
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts });
    }
    private async diagnoseCode(code: DiagnosticCodes.InvalidDebuggerTypeDiagnostic | DiagnosticCodes.JustMyCodeDiagnostic, resource: Resource): Promise<IDiagnostic[]> {
        if (!this.workspaceService.hasWorkspaceFolders) {
            return [];
        }

        const results = await Promise.all(
            this.workspaceService.workspaceFolders!.map(workspaceFolder =>
                this.isLaunchJsonInvalidInWorkspace(code, workspaceFolder)
            )
        );
        return results.filter(used => used === true).length > 0 ? [new InvalidLaunchJsonDebuggerDiagnostic(code, resource)] : [];
    }
    private async isLaunchJsonInvalidInWorkspace(code: DiagnosticCodes, workspaceFolder: WorkspaceFolder) {
        const launchJson = this.getLaunchJsonFile(workspaceFolder);
        if (!(await this.fs.fileExists(launchJson))) {
            return false;
        }

        const fileContents = await this.fs.readFile(launchJson);
        return fileContents.indexOf(
            code === DiagnosticCodes.InvalidDebuggerTypeDiagnostic ? '"pythonExperimental"' : '"debugStdLib"'
        ) > 0;
    }
    private async fixLaunchJson(code: DiagnosticCodes) {
        if (!this.workspaceService.hasWorkspaceFolders) {
            return;
        }

        await Promise.all(
            this.workspaceService.workspaceFolders!.map(workspaceFolder => this.fixLaunchJsonInWorkspace(code, workspaceFolder))
        );
    }
    private async fixLaunchJsonInWorkspace(code: DiagnosticCodes, workspaceFolder: WorkspaceFolder) {
        if (!(await this.isLaunchJsonInvalidInWorkspace(code, workspaceFolder))) {
            return;
        }

        const launchJson = this.getLaunchJsonFile(workspaceFolder);
        let fileContents = await this.fs.readFile(launchJson);
        switch (code) {
            case DiagnosticCodes.InvalidDebuggerTypeDiagnostic: {
                fileContents = this.findAndReplace(fileContents, '"pythonExperimental"', '"python"');
                fileContents = this.findAndReplace(fileContents, '"Python Experimental:', '"Python:');
                break;
            }
            case DiagnosticCodes.JustMyCodeDiagnostic: {
                fileContents = this.findAndReplace(fileContents, '"debugStdLib": false', '"justMyCode": true');
                fileContents = this.findAndReplace(fileContents, '"debugStdLib": true', '"justMyCode": false');
                break;
            }
            default: {
                return;
            }
        }

        await this.fs.writeFile(launchJson, fileContents);
    }
    private findAndReplace(fileContents: string, search: string, replace: string) {
        const searchRegex = new RegExp(search, 'g');
        return fileContents.replace(searchRegex, replace);
    }
    private getLaunchJsonFile(workspaceFolder: WorkspaceFolder) {
        return path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
    }
}
