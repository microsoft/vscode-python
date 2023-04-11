// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ProgressOptions, ProgressLocation } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, IApplicationEnvironment } from '../../common/application/types';
import { inTerminalEnvVarExperiment } from '../../common/experiments/helpers';
import { IPlatformService } from '../../common/platform/types';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import {
    IExtensionContext,
    IExperimentService,
    Resource,
    IDisposableRegistry,
    IConfigurationService,
} from '../../common/types';
import { Deferred, createDeferred } from '../../common/utils/async';
import { Interpreters } from '../../common/utils/localize';
import { traceDecoratorVerbose, traceVerbose } from '../../logging';
import { IInterpreterService } from '../contracts';
import { defaultShells } from './service';
import { IEnvironmentActivationService } from './types';

@injectable()
export class TerminalEnvVarCollectionService implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = {
        untrustedWorkspace: false,
        virtualWorkspace: false,
    };

    private deferred: Deferred<void> | undefined;

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
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    ) {}

    public async activate(): Promise<void> {
        if (!inTerminalEnvVarExperiment(this.experimentService)) {
            this.context.environmentVariableCollection.clear();
            return;
        }
        this.interpreterService.onDidChangeInterpreter(
            async (resource) => {
                this.showProgress();
                await this._applyCollection(resource);
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
                await this._applyCollection(undefined, shell);
                this.hideProgress();
            },
            this,
            this.disposables,
        );

        this._applyCollection(undefined).ignoreErrors();
    }

    public async _applyCollection(resource: Resource, shell = this.applicationEnvironment.shell): Promise<void> {
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
            this.context.environmentVariableCollection.clear();
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
                    this.context.environmentVariableCollection.replace(key, value);
                } else {
                    traceVerbose(`Clearing environment variable ${key} from collection`);
                    this.context.environmentVariableCollection.delete(key);
                }
            }
        });
        Object.keys(previousEnv).forEach((key) => {
            // If the previous env var is not in the current env, clear it from collection.
            if (!(key in env)) {
                traceVerbose(`Clearing environment variable ${key} from collection`);
                this.context.environmentVariableCollection.delete(key);
            }
        });
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
