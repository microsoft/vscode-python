// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../../common/application/types';
import { IFileSystem } from '../../../../common/platform/types';
import { IPathUtils } from '../../../../common/types';
import { DebugConfigurationPrompts, localize } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { SystemVariables } from '../../../../common/variables/systemVariables';
import { sendTelemetryEvent } from '../../../../telemetry';
import { DEBUGGER_CONFIGURATION_PROMPTS } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationProvider } from '../../types';

// tslint:disable-next-line:no-invalid-template-strings
const workspaceFolderToken = '${workspaceFolder}';

@injectable()
export class DjangoLaunchDebugConfigurationProvider implements IDebugConfigurationProvider {
    constructor(@inject(IFileSystem) private fs: IFileSystem,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IPathUtils) private pathUtils: IPathUtils) { }
    public async buildConfiguration(input: MultiStepInput<DebugConfigurationState>, state: DebugConfigurationState) {
        const program = await this.getManagePyPath(state.folder);
        let manuallyEnteredAValue: boolean | undefined;
        const defaultProgram = `${workspaceFolderToken}${this.pathUtils.separator}manage.py`;
        const config: Partial<LaunchRequestArguments> = {
            name: localize('python.snippet.launch.django.label', 'Python: Django')(),
            type: DebuggerTypeName,
            request: 'launch',
            program: program || defaultProgram,
            args: [
                'runserver',
                '--noreload',
                '--nothreading'
            ],
            django: true
        };
        if (!program) {
            const selectedProgram = await input.showInputBox({
                title: DebugConfigurationPrompts.djangoEnterManagePyPathTitle(),
                value: defaultProgram,
                prompt: DebugConfigurationPrompts.djangoEnterManagePyPathPrompt(),
                validate: value => this.validateManagePy(state.folder, defaultProgram, value)
            });
            if (selectedProgram) {
                manuallyEnteredAValue = true;
                config.program = selectedProgram;
            }
        }

        sendTelemetryEvent(DEBUGGER_CONFIGURATION_PROMPTS, undefined, { configurationType: DebugConfigurationType.launchDjango, autoDetectedDjangoManagePyPath: !!program, manuallyEnteredAValue });
        Object.assign(state.config, config);
    }
    public async validateManagePy(folder: WorkspaceFolder | undefined, defaultValue: string, selected?: string): Promise<string | undefined> {
        const error = DebugConfigurationPrompts.djangoEnterManagePyPathInvalidFilePathError();
        if (!selected || selected.trim().length === 0) {
            return error;
        }
        const resolvedPath = this.resolveVariables(selected, folder ? folder.uri : undefined);
        if (selected !== defaultValue && !await this.fs.fileExists(resolvedPath)) {
            return error;
        }
        if (!resolvedPath.trim().toLowerCase().endsWith('.py')) {
            return error;
        }
        return;
    }
    protected resolveVariables(pythonPath: string, resource: Uri | undefined): string {
        const workspaceFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const systemVariables = new SystemVariables(workspaceFolder ? workspaceFolder.uri.fsPath : undefined);
        return systemVariables.resolveAny(pythonPath);
    }

    protected async getManagePyPath(folder: WorkspaceFolder | undefined): Promise<string | undefined> {
        if (!folder) {
            return;
        }
        const defaultLocationOfManagePy = path.join(folder.uri.fsPath, 'manage.py');
        if (await this.fs.fileExists(defaultLocationOfManagePy)) {
            return `${workspaceFolderToken}${this.pathUtils.separator}manage.py`;
        }
    }
}
