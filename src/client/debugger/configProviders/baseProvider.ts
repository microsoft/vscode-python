// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable, unmanaged } from 'inversify';
import * as path from 'path';
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider, ProviderResult, Uri, WorkspaceFolder } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { PythonLanguage } from '../../common/constants';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IConfigurationService } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { AttachRequestArguments, DebuggerType, DebugOptions, LaunchRequestArguments } from '../Common/Contracts';

// tslint:disable:no-invalid-template-strings

export type PythonLaunchDebugConfiguration = DebugConfiguration & LaunchRequestArguments;
export type PythonAttachDebugConfiguration = DebugConfiguration & AttachRequestArguments;

@injectable()
export abstract class BaseConfigurationProvider implements DebugConfigurationProvider {
    constructor(@unmanaged() public debugType: DebuggerType, protected serviceContainer: IServiceContainer) { }
    public resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        const workspaceFolder = this.getWorkspaceFolder(folder);

        if (debugConfiguration.request === 'attach') {
            this.provideAttachDefaults(workspaceFolder, debugConfiguration as PythonAttachDebugConfiguration);
        } else {
            const config = debugConfiguration as PythonLaunchDebugConfiguration;
            const numberOfSettings = Object.keys(config);

            if ((config.noDebug === true && numberOfSettings.length === 1) || numberOfSettings.length === 0) {
                const defaultProgram = this.getProgram();

                config.name = 'Launch';
                config.type = this.debugType;
                config.request = 'launch';
                config.program = defaultProgram ? defaultProgram : '';
                config.env = {};
            }

            this.provideLaunchDefaults(workspaceFolder, config);
        }
        return debugConfiguration;
    }
    protected provideAttachDefaults(workspaceFolder: Uri | undefined, debugConfiguration: PythonAttachDebugConfiguration): void {
        if (!Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = [];
        }
        // Always redirect output.
        if (debugConfiguration.debugOptions.indexOf(DebugOptions.RedirectOutput) === -1) {
            debugConfiguration.debugOptions.push(DebugOptions.RedirectOutput);
        }
        if (!debugConfiguration.host) {
            debugConfiguration.host = 'localhost';
        }
        if (!debugConfiguration.localRoot && workspaceFolder) {
            debugConfiguration.localRoot = workspaceFolder.fsPath;
        }
    }
    protected provideLaunchDefaults(workspaceFolder: Uri | undefined, debugConfiguration: PythonLaunchDebugConfiguration): void {
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
            debugConfiguration.console = 'integratedTerminal';
        }
        // If using a terminal, then never open internal console.
        if (debugConfiguration.console !== 'none' && !debugConfiguration.internalConsoleOptions) {
            debugConfiguration.internalConsoleOptions = 'neverOpen';
        }
        if (!Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = [];
        }
        // Always redirect output.
        if (debugConfiguration.debugOptions.indexOf(DebugOptions.RedirectOutput) === -1) {
            debugConfiguration.debugOptions.push(DebugOptions.RedirectOutput);
        }
        if (debugConfiguration.debugOptions.indexOf(DebugOptions.Pyramid) >= 0) {
            const platformService = this.serviceContainer.get<IPlatformService>(IPlatformService);
            const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
            const pserve = platformService.isWindows ? 'pserve.exe' : 'pserve';
            if (fs.fileExistsSync(debugConfiguration.pythonPath)) {
                debugConfiguration.program = path.join(path.dirname(debugConfiguration.pythonPath), pserve);
            } else {
                debugConfiguration.program = pserve;
            }
        }
    }
    private getWorkspaceFolder(folder: WorkspaceFolder | undefined): Uri | undefined {
        if (folder) {
            return folder.uri;
        }
        const program = this.getProgram();
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
    private getProgram(): string | undefined {
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        const editor = documentManager.activeTextEditor;
        if (editor && editor.document.languageId === PythonLanguage.language) {
            return editor.document.fileName;
        }
    }
    private resolveAndUpdatePythonPath(workspaceFolder: Uri | undefined, debugConfiguration: PythonLaunchDebugConfiguration): void {
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
