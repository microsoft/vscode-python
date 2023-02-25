// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ProgressOptions, ProgressLocation } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, IApplicationEnvironment } from '../../common/application/types';
import { inTerminalEnvVarExperiment } from '../../common/experiments/helpers';
import { IPlatformService } from '../../common/platform/types';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import { IExtensionContext, IExperimentService, Resource, IDisposableRegistry } from '../../common/types';
import { Deferred, createDeferred } from '../../common/utils/async';
import { Interpreters } from '../../common/utils/localize';
import { EnvironmentVariables } from '../../common/variables/types';
import { traceDecoratorVerbose, traceVerbose } from '../../logging';
import { IInterpreterService } from '../contracts';
import { defaultShells } from './service';
import { IEnvironmentActivationService } from './types';

@injectable()
export class TerminalEnvVarCollectionService implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes: { untrustedWorkspace: boolean; virtualWorkspace: boolean } = {
        untrustedWorkspace: false,
        virtualWorkspace: false,
    };

    private deferred: Deferred<void> | undefined;

    private previousEnvVars = normCaseKeys(process.env);

    constructor(
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(IApplicationShell) private shell: IApplicationShell,
        @inject(IExperimentService) private experimentService: IExperimentService,
        @inject(IApplicationEnvironment) private applicationEnvironment: IApplicationEnvironment,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IEnvironmentActivationService) private environmentActivationService: IEnvironmentActivationService,
    ) {}

    public async activate(): Promise<void> {
        if (!inTerminalEnvVarExperiment(this.experimentService)) {
            this.context.environmentVariableCollection.clear();
            return;
        }
        this.interpreterService.onDidChangeInterpreter(
            async (resource) => {
                this.showProgress();
                await this.applyCollection(resource);
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
                await this.applyCollection(undefined, shell);
                this.hideProgress();
            },
            this,
            this.disposables,
        );

        this.applyCollection(undefined).ignoreErrors();
    }

    private async applyCollection(resource: Resource, shell = this.applicationEnvironment.shell) {
        const env = await this.environmentActivationService.getActivatedEnvironmentVariables(
            resource,
            undefined,
            undefined,
            shell,
        );
        if (!env) {
            const shellType = identifyShellFromShellPath(shell);
            if (defaultShells[this.platform.osType]?.shellType !== shellType) {
                // Commands to fetch env vars may fail in custom shells due to unknown reasons, in that case
                // fallback to default shells as they are known to work better.
                await this.applyCollection(resource);
                return;
            }
            this.context.environmentVariableCollection.clear();
            this.previousEnvVars = normCaseKeys(process.env);
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

function normCaseKeys(env: EnvironmentVariables): EnvironmentVariables {
    const result: EnvironmentVariables = {};
    Object.keys(env).forEach((key) => {
        // `os.environ` script used to get env vars normalizes keys to upper case:
        // https://github.com/python/cpython/issues/101754
        // So convert `process.env` keys to upper case to match.
        result[key.toUpperCase()] = env[key];
    });
    return result;
}
