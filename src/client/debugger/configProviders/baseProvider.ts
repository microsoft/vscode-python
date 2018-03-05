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
export type PTVSDDebugConfiguration = PythonDebugConfiguration & { redirectOutput: boolean, fixFilePathCase: boolean };

@injectable()
export abstract class BaseConfigurationProvider implements DebugConfigurationProvider {
    constructor(@unmanaged() public debugType: DebuggerType, protected serviceContainer: IServiceContainer) { }
    public resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        const config = debugConfiguration as PythonDebugConfiguration;
        const numberOfSettings = Object.keys(config);
        const workspaceFolder = this.getWorkspaceFolder(folder, config);

        if ((config.noDebug === true && numberOfSettings.length === 1) || numberOfSettings.length === 0) {
            const defaultProgram = this.getProgram(config);

            config.name = 'Launch';
            config.type = this.debugType;
            config.request = 'launch';
            config.program = defaultProgram ? defaultProgram : '';
            config.env = {};
        }

        this.provideDefaults(workspaceFolder, config);
        return config;
    }
    protected provideDefaults(workspaceFolder: Uri | undefined, debugConfiguration: PythonDebugConfiguration): void {
        this.resolveAndUpdatePythonPath(workspaceFolder, debugConfiguration);
        if (typeof debugConfiguration.cwd !== 'string' && workspaceFolder) {
            debugConfiguration.cwd = workspaceFolder.fsPath;
        }
        if (typeof debugConfiguration.envFile !== 'string' && workspaceFolder) {
            const envFile = workspaceFolder ? path.join(workspaceFolder.fsPath, '.env') : '';
            debugConfiguration.envFile = envFile;
        }
        if (typeof debugConfiguration.stopOnEntry !== 'boolean') {
            debugConfiguration.stopOnEntry = false;
        }
        if (!debugConfiguration.console) {
            debugConfiguration.console = 'none';
        }
        // If using a terminal, then never open internal console.
        if (debugConfiguration.console !== 'none' && !debugConfiguration.internalConsoleOptions) {
            debugConfiguration.internalConsoleOptions = 'neverOpen';
        }
        if (!Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = [];
        }
        // Always redirect output.
        if (debugConfiguration.debugOptions.indexOf('RedirectOutput') === -1) {
            debugConfiguration.debugOptions.push('RedirectOutput');
        }
    }
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
        if (!debugConfiguration) {
            return;
        }
        if (debugConfiguration.pythonPath === '${config:python.pythonPath}' || !debugConfiguration.pythonPath) {
            const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
            const pythonPath = configService.getSettings(workspaceFolder).pythonPath;
            debugConfiguration.pythonPath = pythonPath;
        }
    }
}
