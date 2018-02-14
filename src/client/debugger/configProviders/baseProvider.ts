// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable, unmanaged } from 'inversify';
import * as path from 'path';
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider, ProviderResult, Uri, WorkspaceFolder } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { PythonLanguage } from '../../common/constants';
import { IConfigurationService } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { DebuggerType, LaunchRequestArguments } from '../Common/Contracts';

// tslint:disable:no-invalid-template-strings

export type PythonDebugConfiguration = DebugConfiguration & LaunchRequestArguments;

@injectable()
export abstract class BaseConfigurationProvider implements DebugConfigurationProvider {
    constructor(@unmanaged() public debugType: DebuggerType, private serviceContainer: IServiceContainer) { }
    public resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        const config = debugConfiguration as PythonDebugConfiguration;
        const numberOfSettings = Object.keys(config);
        const provideDefaultConfigSettings = (config.noDebug === true && numberOfSettings.length === 1) || numberOfSettings.length === 0;
        const workspaceFolder = this.getWorkspaceFolder(folder, config);
        if (!provideDefaultConfigSettings) {
            this.resolveAndUpdatePythonPath(workspaceFolder, config);
            return config;
        }

        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const pythonPath = configService.getSettings(workspaceFolder).pythonPath;
        const defaultProgram = this.getProgram(config);
        const envFile = workspaceFolder ? path.join(workspaceFolder.fsPath, '.env') : '';

        config.name = 'Launch';
        config.type = this.debugType;
        config.request = 'launch';
        config.pythonPath = pythonPath;
        config.program = defaultProgram ? defaultProgram : '';
        config.cwd = workspaceFolder ? workspaceFolder.fsPath : undefined;
        config.envFile = envFile;
        config.env = {};
        config.debugOptions = [];

        this.provideDefaults(config);
        return config;
    }
    protected abstract provideDefaults(debugConfiguration: PythonDebugConfiguration): void;
    private getWorkspaceFolder(folder: WorkspaceFolder | undefined, config: PythonDebugConfiguration): Uri | undefined {
        if (folder) {
            return folder.uri;
        }
        const program = this.getProgram(config);
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (!Array.isArray(workspaceService.workspaceFolders) || workspaceService.workspaceFolders.length === 0) {
            return program ? Uri.file(path.dirname(program)) : undefined;
        }
        if (workspaceService.workspaceFolders.length === 1) {
            return workspaceService.workspaceFolders[0].uri;
        }
        if (program) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(Uri.file(program));
            if (workspaceFolder) {
                return workspaceFolder.uri;
            }
        }
    }
    private getProgram(config: PythonDebugConfiguration): string | undefined {
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        const editor = documentManager.activeTextEditor;
        if (editor && editor.document.languageId === PythonLanguage.language) {
            return editor.document.fileName;
        }
    }
    private resolveAndUpdatePythonPath(workspaceFolder: Uri | undefined, debugConfiguration: PythonDebugConfiguration): void {
        if (!debugConfiguration || debugConfiguration.pythonPath !== '${config:python.pythonPath}') {
            return;
        }
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const pythonPath = configService.getSettings(workspaceFolder).pythonPath;
        debugConfiguration.pythonPath = pythonPath;
    }
}
