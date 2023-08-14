// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { inject, injectable } from 'inversify';
import { ProgressOptions, ProgressLocation, MarkdownString, WorkspaceFolder } from 'vscode';
import { pathExists } from 'fs-extra';
import { IExtensionActivationService } from '../../activation/types';
import { IApplicationShell, IApplicationEnvironment, IWorkspaceService } from '../../common/application/types';
import { inTerminalEnvVarExperiment } from '../../common/experiments/helpers';
import { IPlatformService } from '../../common/platform/types';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import {
    IExtensionContext,
    IExperimentService,
    Resource,
    IDisposableRegistry,
    IConfigurationService,
    IPathUtils,
} from '../../common/types';
import { Deferred, createDeferred } from '../../common/utils/async';
import { Interpreters } from '../../common/utils/localize';
import { traceDecoratorVerbose, traceVerbose } from '../../logging';
import { IInterpreterService } from '../contracts';
import { defaultShells } from './service';
import { IEnvironmentActivationService, ITerminalEnvVarCollectionService } from './types';
import { EnvironmentType } from '../../pythonEnvironments/info';
import { getSearchPathEnvVarNames } from '../../common/utils/exec';
import { EnvironmentVariables } from '../../common/variables/types';
import { TerminalShellType } from '../../common/terminal/types';
import { OSType } from '../../common/utils/platform';

@injectable()
export class TerminalEnvVarCollectionService implements IExtensionActivationService, ITerminalEnvVarCollectionService {
    public readonly supportedWorkspaceTypes = {
        untrustedWorkspace: false,
        virtualWorkspace: false,
    };

    private deferred: Deferred<void> | undefined;

    private registeredOnce = false;

    /**
     * Carries default environment variables for the currently selected shell.
     */
    private processEnvVars: EnvironmentVariables | undefined;

    constructor(
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(IApplicationShell) private shell: IApplicationShell,
        @inject(IExperimentService) private experimentService: IExperimentService,
        @inject(IApplicationEnvironment) private applicationEnvironment: IApplicationEnvironment,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IEnvironmentActivationService) private environmentActivationService: IEnvironmentActivationService,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
    ) {}

    public async activate(resource: Resource): Promise<void> {
        if (!inTerminalEnvVarExperiment(this.experimentService)) {
            const workspaceFolder = this.getWorkspaceFolder(resource);
            this.context.getEnvironmentVariableCollection({ workspaceFolder }).clear();
            await this.handleMicroVenv(resource);
            if (!this.registeredOnce) {
                this.interpreterService.onDidChangeInterpreter(
                    async (r) => {
                        await this.handleMicroVenv(r);
                    },
                    this,
                    this.disposables,
                );
                this.registeredOnce = true;
            }
            return;
        }
        if (!this.registeredOnce) {
            this.interpreterService.onDidChangeInterpreter(
                async (r) => {
                    this.showProgress();
                    await this._applyCollection(r).ignoreErrors();
                    this.hideProgress();
                },
                this,
                this.disposables,
            );
            this.applicationEnvironment.onDidChangeShell(
                async (shell: string) => {
                    this.showProgress();
                    this.processEnvVars = undefined;
                    // Pass in the shell where known instead of relying on the application environment, because of bug
                    // on VSCode: https://github.com/microsoft/vscode/issues/160694
                    await this._applyCollection(undefined, shell).ignoreErrors();
                    this.hideProgress();
                },
                this,
                this.disposables,
            );
            this.registeredOnce = true;
        }
        this._applyCollection(resource).ignoreErrors();
    }

    public async _applyCollection(resource: Resource, shell = this.applicationEnvironment.shell): Promise<void> {
        const workspaceFolder = this.getWorkspaceFolder(resource);
        const settings = this.configurationService.getSettings(resource);
        const envVarCollection = this.context.getEnvironmentVariableCollection({ workspaceFolder });
        // Clear any previously set env vars from collection
        envVarCollection.clear();
        if (!settings.terminal.activateEnvironment) {
            traceVerbose('Activating environments in terminal is disabled for', resource?.fsPath);
            return;
        }
        const env = await this.environmentActivationService.getActivatedEnvironmentVariables(
            resource,
            undefined,
            undefined,
            shell,
        );
        if (!env) {
            const shellType = identifyShellFromShellPath(shell);
            const defaultShell = defaultShells[this.platform.osType];
            if (defaultShell?.shellType !== shellType) {
                // Commands to fetch env vars may fail in custom shells due to unknown reasons, in that case
                // fallback to default shells as they are known to work better.
                await this._applyCollection(resource, defaultShell?.shell);
                return;
            }
            await this.trackTerminalPrompt(shell, resource, env);
            this.processEnvVars = undefined;
            return;
        }
        if (!this.processEnvVars) {
            this.processEnvVars = await this.environmentActivationService.getProcessEnvironmentVariables(
                resource,
                shell,
            );
        }
        const processEnv = this.processEnvVars;
        Object.keys(env).forEach((key) => {
            if (shouldSkip(key)) {
                return;
            }
            const value = env[key];
            const prevValue = processEnv[key];
            if (prevValue !== value) {
                if (value !== undefined) {
                    if (key === 'PS1') {
                        // We cannot have the full PS1 without executing in terminal, which we do not. Hence prepend it.
                        traceVerbose(`Prepending environment variable ${key} in collection with ${value}`);
                        envVarCollection.prepend(key, value, {
                            applyAtShellIntegration: true,
                            applyAtProcessCreation: false,
                        });
                        return;
                    }
                    traceVerbose(`Setting environment variable ${key} in collection to ${value}`);
                    envVarCollection.replace(key, value, {
                        applyAtShellIntegration: true,
                        applyAtProcessCreation: true,
                    });
                }
            }
        });

        const displayPath = this.pathUtils.getDisplayName(settings.pythonPath, workspaceFolder?.uri.fsPath);
        const description = new MarkdownString(`${Interpreters.activateTerminalDescription} \`${displayPath}\``);
        envVarCollection.description = description;

        await this.trackTerminalPrompt(shell, resource, env);
    }

    private isPromptSet = new Map<number | undefined, boolean>();

    // eslint-disable-next-line class-methods-use-this
    public isTerminalPromptSetCorrectly(resource?: Resource): boolean {
        const workspaceFolder = this.getWorkspaceFolder(resource);
        return !!this.isPromptSet.get(workspaceFolder?.index);
    }

    /**
     * Call this once we know terminal prompt is set correctly for terminal owned by this resource.
     */
    private terminalPromptIsCorrect(resource: Resource) {
        const key = this.getWorkspaceFolder(resource)?.index;
        this.isPromptSet.set(key, true);
    }

    private terminalPromptIsUnknown(resource: Resource) {
        const key = this.getWorkspaceFolder(resource)?.index;
        this.isPromptSet.delete(key);
    }

    /**
     * Tracks whether prompt for terminal was correctly set.
     */
    private async trackTerminalPrompt(shell: string, resource: Resource, env: EnvironmentVariables | undefined) {
        this.terminalPromptIsUnknown(resource);
        if (!env) {
            this.terminalPromptIsCorrect(resource);
            return;
        }
        // Prompts for these shells cannot be set reliably using variables
        const exceptionShells = [
            TerminalShellType.powershell,
            TerminalShellType.powershellCore,
            TerminalShellType.fish,
            TerminalShellType.zsh, // TODO: Remove this once https://github.com/microsoft/vscode/issues/188875 is fixed
        ];
        const customShellType = identifyShellFromShellPath(shell);
        if (exceptionShells.includes(customShellType)) {
            return;
        }
        if (this.platform.osType !== OSType.Windows) {
            // These shells are expected to set PS1 variable for terminal prompt for virtual/conda environments.
            const interpreter = await this.interpreterService.getActiveInterpreter(resource);
            const shouldPS1BeSet = interpreter?.type !== undefined;
            if (shouldPS1BeSet && !env.PS1) {
                // PS1 should be set but no PS1 was set.
                return;
            }
        }
        this.terminalPromptIsCorrect(resource);
    }

    private async handleMicroVenv(resource: Resource) {
        const workspaceFolder = this.getWorkspaceFolder(resource);
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        if (interpreter?.envType === EnvironmentType.Venv) {
            const activatePath = path.join(path.dirname(interpreter.path), 'activate');
            if (!(await pathExists(activatePath))) {
                const envVarCollection = this.context.getEnvironmentVariableCollection({ workspaceFolder });
                const pathVarName = getSearchPathEnvVarNames()[0];
                envVarCollection.replace(
                    'PATH',
                    `${path.dirname(interpreter.path)}${path.delimiter}${process.env[pathVarName]}`,
                    { applyAtShellIntegration: true, applyAtProcessCreation: true },
                );
                return;
            }
        }
        this.context.getEnvironmentVariableCollection({ workspaceFolder }).clear();
    }

    private getWorkspaceFolder(resource: Resource): WorkspaceFolder | undefined {
        let workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
        if (
            !workspaceFolder &&
            Array.isArray(this.workspaceService.workspaceFolders) &&
            this.workspaceService.workspaceFolders.length > 0
        ) {
            [workspaceFolder] = this.workspaceService.workspaceFolders;
        }
        return workspaceFolder;
    }

    @traceDecoratorVerbose('Display activating terminals')
    private showProgress(): void {
        if (!this.deferred) {
            this.createProgress();
        }
    }

    @traceDecoratorVerbose('Hide activating terminals')
    private hideProgress(): void {
        if (this.deferred) {
            this.deferred.resolve();
            this.deferred = undefined;
        }
    }

    private createProgress() {
        const progressOptions: ProgressOptions = {
            location: ProgressLocation.Window,
            title: Interpreters.activatingTerminals,
        };
        this.shell.withProgress(progressOptions, () => {
            this.deferred = createDeferred();
            return this.deferred.promise;
        });
    }
}

function shouldSkip(env: string) {
    return ['_', 'SHLVL'].includes(env);
}
