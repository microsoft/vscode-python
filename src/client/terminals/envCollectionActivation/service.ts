// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { inject, injectable } from 'inversify';
import {
    ProgressOptions,
    ProgressLocation,
    MarkdownString,
    WorkspaceFolder,
    GlobalEnvironmentVariableCollection,
    EnvironmentVariableScope,
} from 'vscode';
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
import { traceDecoratorVerbose, traceError, traceVerbose, traceWarn } from '../../logging';
import { IInterpreterService } from '../../interpreter/contracts';
import { defaultShells } from '../../interpreter/activation/service';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { EnvironmentType, PythonEnvironment } from '../../pythonEnvironments/info';
import { getSearchPathEnvVarNames } from '../../common/utils/exec';
import { EnvironmentVariables } from '../../common/variables/types';
import { TerminalShellType } from '../../common/terminal/types';
import { OSType } from '../../common/utils/platform';
import { normCase } from '../../common/platform/fs-paths';
import { PythonEnvType } from '../../pythonEnvironments/base/info';
import { ITerminalEnvVarCollectionService } from '../types';

@injectable()
export class TerminalEnvVarCollectionService implements IExtensionActivationService, ITerminalEnvVarCollectionService {
    public readonly supportedWorkspaceTypes = {
        untrustedWorkspace: false,
        virtualWorkspace: false,
    };

    /**
     * Prompts for these shells cannot be set reliably using variables
     */
    private noPromptVariableShells = [
        TerminalShellType.powershell,
        TerminalShellType.powershellCore,
        TerminalShellType.fish,
    ];

    private deferred: Deferred<void> | undefined;

    private registeredOnce = false;

    /**
     * Carries default environment variables for the currently selected shell.
     */
    private processEnvVars: EnvironmentVariables | undefined;

    private separator: string;

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
    ) {
        this.separator = platform.osType === OSType.Windows ? ';' : ':';
    }

    public async activate(resource: Resource): Promise<void> {
        try {
            if (!inTerminalEnvVarExperiment(this.experimentService)) {
                this.context.environmentVariableCollection.clear();
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
                        await this._applyCollection(r).ignoreErrors();
                    },
                    this,
                    this.disposables,
                );
                this.applicationEnvironment.onDidChangeShell(
                    async (shell: string) => {
                        this.processEnvVars = undefined;
                        // Pass in the shell where known instead of relying on the application environment, because of bug
                        // on VSCode: https://github.com/microsoft/vscode/issues/160694
                        await this._applyCollection(undefined, shell).ignoreErrors();
                    },
                    this,
                    this.disposables,
                );
                this.registeredOnce = true;
            }
            this._applyCollection(resource).ignoreErrors();
        } catch (ex) {
            traceError(`Activating terminal env collection failed`, ex);
        }
    }

    public async _applyCollection(resource: Resource, shell?: string): Promise<void> {
        this.showProgress();
        await this._applyCollectionImpl(resource, shell);
        this.hideProgress();
    }

    private async _applyCollectionImpl(resource: Resource, shell = this.applicationEnvironment.shell): Promise<void> {
        const workspaceFolder = this.getWorkspaceFolder(resource);
        const settings = this.configurationService.getSettings(resource);
        const envVarCollection = this.getEnvironmentVariableCollection({ workspaceFolder });
        if (!settings.terminal.activateEnvironment) {
            envVarCollection.clear();
            traceVerbose('Activating environments in terminal is disabled for', resource?.fsPath);
            return;
        }
        const activatedEnv = await this.environmentActivationService.getActivatedEnvironmentVariables(
            resource,
            undefined,
            undefined,
            shell,
        );
        const env = activatedEnv ? normCaseKeys(activatedEnv) : undefined;
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
            envVarCollection.clear();
            this.processEnvVars = undefined;
            return;
        }
        if (!this.processEnvVars) {
            this.processEnvVars = await this.environmentActivationService.getProcessEnvironmentVariables(
                resource,
                shell,
            );
        }
        const processEnv = normCaseKeys(this.processEnvVars);

        // PS1 in some cases is a shell variable (not an env variable) so "env" might not contain it, calculate it in that case.
        env.PS1 = await this.getPS1(shell, resource, env);

        // Clear any previously set env vars from collection
        envVarCollection.clear();
        Object.keys(env).forEach((key) => {
            if (shouldSkip(key)) {
                return;
            }
            let value = env[key];
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
                    if (key === 'PATH') {
                        if (processEnv.PATH && env.PATH?.endsWith(processEnv.PATH)) {
                            // Prefer prepending to PATH instead of replacing it, as we do not want to replace any
                            // changes to PATH users might have made it in their init scripts (~/.bashrc etc.)
                            const prependedPart = env.PATH.slice(0, -processEnv.PATH.length);
                            value = prependedPart;
                            traceVerbose(`Prepending environment variable ${key} in collection with ${value}`);
                            envVarCollection.prepend(key, value, {
                                applyAtShellIntegration: true,
                                applyAtProcessCreation: true,
                            });
                        } else {
                            if (!value.endsWith(this.separator)) {
                                value = value.concat(this.separator);
                            }
                            traceVerbose(`Prepending environment variable ${key} in collection to ${value}`);
                            envVarCollection.prepend(key, value, {
                                applyAtShellIntegration: true,
                                applyAtProcessCreation: true,
                            });
                        }
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
        const customShellType = identifyShellFromShellPath(shell);
        if (this.noPromptVariableShells.includes(customShellType)) {
            return;
        }
        if (this.platform.osType !== OSType.Windows) {
            // These shells are expected to set PS1 variable for terminal prompt for virtual/conda environments.
            const interpreter = await this.interpreterService.getActiveInterpreter(resource);
            const shouldSetPS1 = shouldPS1BeSet(interpreter?.type, env);
            if (shouldSetPS1 && !env.PS1) {
                // PS1 should be set but no PS1 was set.
                return;
            }
            const config = this.workspaceService
                .getConfiguration('terminal')
                .get<boolean>('integrated.shellIntegration.enabled');
            if (!config) {
                traceVerbose('PS1 is not set when shell integration is disabled.');
                return;
            }
        }
        this.terminalPromptIsCorrect(resource);
    }

    private async getPS1(shell: string, resource: Resource, env: EnvironmentVariables) {
        const customShellType = identifyShellFromShellPath(shell);
        if (this.noPromptVariableShells.includes(customShellType)) {
            return env.PS1;
        }
        if (this.platform.osType !== OSType.Windows) {
            // These shells are expected to set PS1 variable for terminal prompt for virtual/conda environments.
            const interpreter = await this.interpreterService.getActiveInterpreter(resource);
            const shouldSetPS1 = shouldPS1BeSet(interpreter?.type, env);
            if (shouldSetPS1) {
                const prompt = getPromptForEnv(interpreter);
                if (prompt) {
                    return prompt;
                }
            }
        }
        if (env.PS1) {
            // Prefer PS1 set by env vars, as env.PS1 may or may not contain the full PS1: #22056.
            return env.PS1;
        }
        return undefined;
    }

    private async handleMicroVenv(resource: Resource) {
        try {
            const workspaceFolder = this.getWorkspaceFolder(resource);
            const interpreter = await this.interpreterService.getActiveInterpreter(resource);
            if (interpreter?.envType === EnvironmentType.Venv) {
                const activatePath = path.join(path.dirname(interpreter.path), 'activate');
                if (!(await pathExists(activatePath))) {
                    const envVarCollection = this.getEnvironmentVariableCollection({ workspaceFolder });
                    const pathVarName = getSearchPathEnvVarNames()[0];
                    envVarCollection.replace(
                        'PATH',
                        `${path.dirname(interpreter.path)}${path.delimiter}${process.env[pathVarName]}`,
                        { applyAtShellIntegration: true, applyAtProcessCreation: true },
                    );
                    return;
                }
                this.getEnvironmentVariableCollection({ workspaceFolder }).clear();
            }
        } catch (ex) {
            traceWarn(`Microvenv failed as it is using proposed API which is constantly changing`, ex);
        }
    }

    private getEnvironmentVariableCollection(scope: EnvironmentVariableScope = {}) {
        const envVarCollection = this.context.environmentVariableCollection as GlobalEnvironmentVariableCollection;
        return envVarCollection.getScoped(scope);
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

function shouldPS1BeSet(type: PythonEnvType | undefined, env: EnvironmentVariables): boolean {
    if (env.PS1) {
        // Activated variables contain PS1, meaning it was supposed to be set.
        return true;
    }
    if (type === PythonEnvType.Virtual) {
        const promptDisabledVar = env.VIRTUAL_ENV_DISABLE_PROMPT;
        const isPromptDisabled = promptDisabledVar && promptDisabledVar !== undefined;
        return !isPromptDisabled;
    }
    if (type === PythonEnvType.Conda) {
        // Instead of checking config value using `conda config --get changeps1`, simply check
        // `CONDA_PROMPT_MODIFER` to avoid the cost of launching the conda binary.
        const promptEnabledVar = env.CONDA_PROMPT_MODIFIER;
        const isPromptEnabled = promptEnabledVar && promptEnabledVar !== '';
        return !!isPromptEnabled;
    }
    return false;
}

function shouldSkip(env: string) {
    return ['_', 'SHLVL'].includes(env);
}

function getPromptForEnv(interpreter: PythonEnvironment | undefined) {
    if (!interpreter) {
        return undefined;
    }
    if (interpreter.envName) {
        if (interpreter.envName === 'base') {
            // If conda base environment is selected, it can lead to "(base)" appearing twice if we return the env name.
            return undefined;
        }
        return `(${interpreter.envName}) `;
    }
    if (interpreter.envPath) {
        return `(${path.basename(interpreter.envPath)}) `;
    }
    return undefined;
}

function normCaseKeys(env: EnvironmentVariables): EnvironmentVariables {
    const result: EnvironmentVariables = {};
    Object.keys(env).forEach((key) => {
        result[normCase(key)] = env[key];
    });
    return result;
}
