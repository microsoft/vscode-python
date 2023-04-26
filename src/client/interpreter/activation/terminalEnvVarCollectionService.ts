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
import { IEnvironmentActivationService } from './types';
import { EnvironmentType } from '../../pythonEnvironments/info';

@injectable()
export class TerminalEnvVarCollectionService implements IExtensionActivationService {
    public readonly supportedWorkspaceTypes = {
        untrustedWorkspace: false,
        virtualWorkspace: false,
    };

    private deferred: Deferred<void> | undefined;

    private registeredOnce = false;

    private previousEnvVars = _normCaseKeys(process.env);

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
            this.context.environmentVariableCollection.clear({ workspaceFolder });
            this.previousEnvVars = _normCaseKeys(process.env);
            return;
        }
        const previousEnv = this.previousEnvVars;
        this.previousEnvVars = env;
        Object.keys(env).forEach((key) => {
            const value = env[key];
            const prevValue = previousEnv[key];
            if (prevValue !== value) {
                if (value !== undefined) {
                    traceVerbose(`Setting environment variable ${key} in collection to ${value}`);
                    this.context.environmentVariableCollection.replace(key, value, { workspaceFolder });
                } else {
                    traceVerbose(`Clearing environment variable ${key} from collection`);
                    this.context.environmentVariableCollection.delete(key, { workspaceFolder });
                }
            }
        });
        Object.keys(previousEnv).forEach((key) => {
            // If the previous env var is not in the current env, clear it from collection.
            if (!(key in env)) {
                traceVerbose(`Clearing environment variable ${key} from collection`);
                this.context.environmentVariableCollection.delete(key, { workspaceFolder });
            }
        });
        const displayPath = this.pathUtils.getDisplayName(settings.pythonPath, workspaceFolder?.uri.fsPath);
        const description = new MarkdownString(`${Interpreters.activateTerminalDescription} \`${displayPath}\``);
        this.context.environmentVariableCollection.setDescription(description, {
            workspaceFolder,
        });
    }

    private async handleMicroVenv(resource: Resource) {
        const workspaceFolder = this.getWorkspaceFolder(resource);
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        if (interpreter?.envType === EnvironmentType.Venv) {
            const activatePath = path.join(path.dirname(interpreter.path), 'activate');
            if (!(await pathExists(activatePath))) {
                this.context.environmentVariableCollection.replace(
                    'PATH',
                    `${path.dirname(interpreter.path)}${path.delimiter}${process.env.Path}`,
                    {
                        workspaceFolder,
                    },
                );
                return;
            }
        }
        this.context.environmentVariableCollection.clear();
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

export function _normCaseKeys(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const result: NodeJS.ProcessEnv = {};
    Object.keys(env).forEach((key) => {
        // `os.environ` script used to get env vars normalizes keys to upper case:
        // https://github.com/python/cpython/issues/101754
        // So convert `process.env` keys to upper case to match.
        result[key.toUpperCase()] = env[key];
    });
    return result;
}
