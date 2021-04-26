// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { CancellationToken, Uri, WorkspaceFolder } from 'vscode';
import { InvalidPythonPathInDebuggerServiceId } from '../../../../application/diagnostics/checks/invalidPythonPathInDebugger';
import { IDiagnosticsService, IInvalidPythonPathInDebuggerService } from '../../../../application/diagnostics/types';
import { IDocumentManager, IWorkspaceService } from '../../../../common/application/types';
import { IPlatformService } from '../../../../common/platform/types';
import { IConfigurationService } from '../../../../common/types';
import { DebuggerTypeName } from '../../../constants';
import { DebugOptions, LaunchRequestArguments } from '../../../types';
import { PythonPathSource } from '../../types';
import { BaseConfigurationResolver } from './base';
import { IDebugEnvironmentVariablesService } from './helper';

@injectable()
export class LaunchConfigurationResolver extends BaseConfigurationResolver<LaunchRequestArguments> {
    constructor(
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IDiagnosticsService)
        @named(InvalidPythonPathInDebuggerServiceId)
        private readonly invalidPythonPathInDebuggerService: IInvalidPythonPathInDebuggerService,
        @inject(IPlatformService) platformService: IPlatformService,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(IDebugEnvironmentVariablesService) private readonly debugEnvHelper: IDebugEnvironmentVariablesService,
    ) {
        super(workspaceService, documentManager, platformService, configurationService);
    }

    public async resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: LaunchRequestArguments,
        _token?: CancellationToken,
    ): Promise<LaunchRequestArguments | undefined> {
        if (
            debugConfiguration.name === undefined &&
            debugConfiguration.type === undefined &&
            debugConfiguration.request === undefined &&
            debugConfiguration.program === undefined &&
            debugConfiguration.env === undefined
        ) {
            const defaultProgram = this.getProgram();
            debugConfiguration.name = 'Launch';
            debugConfiguration.type = DebuggerTypeName;
            debugConfiguration.request = 'launch';
            debugConfiguration.program = defaultProgram ?? '';
            debugConfiguration.env = {};
        }

        const workspaceFolder = this.getWorkspaceFolder(folder);
        this.resolveAndUpdatePaths(workspaceFolder, debugConfiguration);
        return debugConfiguration;
    }

    public async resolveDebugConfigurationWithSubstitutedVariables(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: LaunchRequestArguments,
        _token?: CancellationToken,
    ): Promise<LaunchRequestArguments | undefined> {
        const workspaceFolder = this.getWorkspaceFolder(folder);
        await this.provideLaunchDefaults(workspaceFolder, debugConfiguration);

        const isValid = await this.validateLaunchConfiguration(folder, debugConfiguration);
        if (!isValid) {
            return;
        }

        if (Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = debugConfiguration.debugOptions!.filter(
                (item, pos) => debugConfiguration.debugOptions!.indexOf(item) === pos,
            );
        }
        return debugConfiguration;
    }

    protected async provideLaunchDefaults(
        workspaceFolder: Uri | undefined,
        debugConfiguration: LaunchRequestArguments,
    ): Promise<void> {
        if (debugConfiguration.python === undefined) {
            debugConfiguration.python = debugConfiguration.pythonPath;
        }
        if (debugConfiguration.debugAdapterPython === undefined) {
            debugConfiguration.debugAdapterPython = debugConfiguration.pythonPath;
        }
        if (debugConfiguration.debugLauncherPython === undefined) {
            debugConfiguration.debugLauncherPython = debugConfiguration.pythonPath;
        }
        delete debugConfiguration.pythonPath;

        if (typeof debugConfiguration.cwd !== 'string' && workspaceFolder) {
            debugConfiguration.cwd = workspaceFolder.fsPath;
        }
        if (typeof debugConfiguration.envFile !== 'string' && workspaceFolder) {
            const settings = this.configurationService.getSettings(workspaceFolder);
            debugConfiguration.envFile = settings.envFile;
        }
        // Extract environment variables from .env file in the vscode context and
        // set the "env" debug configuration argument. This expansion should be
        // done here before handing of the environment settings to the debug adapter
        debugConfiguration.env = await this.debugEnvHelper.getEnvironmentVariables(debugConfiguration);
        if (typeof debugConfiguration.stopOnEntry !== 'boolean') {
            debugConfiguration.stopOnEntry = false;
        }
        debugConfiguration.showReturnValue = debugConfiguration.showReturnValue !== false;
        if (!debugConfiguration.console) {
            debugConfiguration.console = 'integratedTerminal';
        }
        // If using a terminal, then never open internal console.
        if (debugConfiguration.console !== 'internalConsole' && !debugConfiguration.internalConsoleOptions) {
            debugConfiguration.internalConsoleOptions = 'neverOpen';
        }
        if (!Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = [];
        }
        if (debugConfiguration.justMyCode === undefined) {
            // Populate justMyCode using debugStdLib
            debugConfiguration.justMyCode = !debugConfiguration.debugStdLib;
        }
        // Pass workspace folder so we can get this when we get debug events firing.
        debugConfiguration.workspaceFolder = workspaceFolder ? workspaceFolder.fsPath : undefined;
        const debugOptions = debugConfiguration.debugOptions!;
        if (!debugConfiguration.justMyCode) {
            this.debugOption(debugOptions, DebugOptions.DebugStdLib);
        }
        if (debugConfiguration.stopOnEntry) {
            this.debugOption(debugOptions, DebugOptions.StopOnEntry);
        }
        if (debugConfiguration.showReturnValue) {
            this.debugOption(debugOptions, DebugOptions.ShowReturnValue);
        }
        if (debugConfiguration.django) {
            this.debugOption(debugOptions, DebugOptions.Django);
        }
        if (debugConfiguration.jinja) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.redirectOutput === undefined && debugConfiguration.console === 'internalConsole') {
            debugConfiguration.redirectOutput = true;
        }
        if (debugConfiguration.redirectOutput) {
            this.debugOption(debugOptions, DebugOptions.RedirectOutput);
        }
        if (debugConfiguration.sudo) {
            this.debugOption(debugOptions, DebugOptions.Sudo);
        }
        if (debugConfiguration.subProcess === true) {
            this.debugOption(debugOptions, DebugOptions.SubProcess);
        }
        if (this.platformService.isWindows) {
            this.debugOption(debugOptions, DebugOptions.FixFilePathCase);
        }
        const isFastAPI = this.isDebuggingFastAPI(debugConfiguration);
        const isFlask = this.isDebuggingFlask(debugConfiguration);
        if (
            (debugConfiguration.pyramid || isFlask || isFastAPI) &&
            debugOptions.indexOf(DebugOptions.Jinja) === -1 &&
            debugConfiguration.jinja !== false
        ) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        // Unlike with attach, we do not set a default path mapping.
        // (See: https://github.com/microsoft/vscode-python/issues/3568)
        if (debugConfiguration.pathMappings) {
            let pathMappings = debugConfiguration.pathMappings;
            if (pathMappings.length > 0) {
                pathMappings = this.fixUpPathMappings(
                    pathMappings || [],
                    workspaceFolder ? workspaceFolder.fsPath : '',
                );
            }
            debugConfiguration.pathMappings = pathMappings.length > 0 ? pathMappings : undefined;
        }
        this.sendTelemetry(debugConfiguration.request as 'launch' | 'test', debugConfiguration);
    }

    protected async validateLaunchConfiguration(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: LaunchRequestArguments,
    ): Promise<boolean> {
        const diagnosticService = this.invalidPythonPathInDebuggerService;
        for (const executable of [
            debugConfiguration.python,
            debugConfiguration.debugAdapterPython,
            debugConfiguration.debugLauncherPython,
        ]) {
            const source =
                executable === debugConfiguration.pythonPath ? this.pythonPathSource : PythonPathSource.launchJson;
            if (!(await diagnosticService.validatePythonPath(executable, source, folder?.uri))) {
                return false;
            }
        }
        return true;
    }
}
