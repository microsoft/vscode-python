// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../common/application/types';
import { UseTerminalToGetActivatedEnvVars } from '../../common/experimentGroups';
import '../../common/extensions';
import { traceError } from '../../common/logger';
import { IDisposableRegistry, IExperimentsManager, Resource } from '../../common/types';
import { createDeferredFromPromise, sleep } from '../../common/utils/async';
import { InMemoryCache } from '../../common/utils/cacheUtils';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IInterpreterService, PythonInterpreter } from '../contracts';
import { cacheDuration, EnvironmentActivationService } from './service';
import { TerminalEnvironmentActivationService } from './terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from './types';

// We have code in terminal activation that waits for a min of 500ms.
// Observed on a Mac that it can take upto 2.5s.
// So, lets give it at least 3s to complete.
const timeToWaitForTerminalActivationToComplete = 3_000;

@injectable()
export class WrapperEnvironmentActivationService implements IEnvironmentActivationService {
    private readonly cachePerResourceAndInterpreter = new Map<string, InMemoryCache<Promise<NodeJS.ProcessEnv | undefined>>>();
    constructor(
        @inject(EnvironmentActivationService) private readonly procActivation: IEnvironmentActivationService,
        @inject(TerminalEnvironmentActivationService) private readonly terminalActivation: IEnvironmentActivationService,
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IEnvironmentVariablesProvider) envVarsProvider: IEnvironmentVariablesProvider,

        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        // Environment variables rely on custom variables defined by the user in `.env` files.
        disposables.push(envVarsProvider.onDidEnvironmentVariablesChange(() => this.cachePerResourceAndInterpreter.clear()));
    }
    @captureTelemetry(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, { failed: false, activatedByWrapper: true }, true)
    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonInterpreter | undefined,
        allowExceptions?: boolean | undefined
    ): Promise<NodeJS.ProcessEnv | undefined> {
        const key = this.getCacheKey(resource, interpreter);
        interpreter = interpreter || (await this.interpreterService.getActiveInterpreter(undefined));
        const procEnvVarsPromise = this.cacheCallback(`${key}_Process`, () => this.getActivatedEnvVarsFromProc(resource, interpreter, allowExceptions));
        const terminalEnvVarsPromise = this.cacheCallback(`${key}_Terminal`, () =>
            this.getActivatedEnvVarsFromTerminal(procEnvVarsPromise, resource, interpreter, allowExceptions)
        );

        const procEnvVars = createDeferredFromPromise(procEnvVarsPromise);
        const terminalEnvVars = createDeferredFromPromise(terminalEnvVarsPromise);

        // If terminal activation didn't complete, wait for some time.
        if (!terminalEnvVars.completed) {
            await sleep(timeToWaitForTerminalActivationToComplete);
        }

        await Promise.race([terminalEnvVars.promise, procEnvVars.promise]);
        // Give preference to the terminal environment variables promise.
        return terminalEnvVars.completed ? terminalEnvVars.promise : procEnvVars.promise;
    }
    /**
     * Cache the implementation so it can be used in the future.
     * If a cached entry already exists, then ignore the implementation.
     *
     * @private
     * @param {string} key
     * @param {(() => Promise<NodeJS.ProcessEnv | undefined>)} implementation
     * @returns {(Promise<NodeJS.ProcessEnv | undefined>)}
     * @memberof WrapperEnvironmentActivationService
     */
    private async cacheCallback(key: string, implementation: () => Promise<NodeJS.ProcessEnv | undefined>): Promise<NodeJS.ProcessEnv | undefined> {
        if (!this.cachePerResourceAndInterpreter.get(key)?.hasData) {
            const cache = new InMemoryCache<Promise<NodeJS.ProcessEnv | undefined>>(cacheDuration);
            cache.data = implementation();
            this.cachePerResourceAndInterpreter.set(key, cache);
        }

        return this.cachePerResourceAndInterpreter.get(key)?.data!;
    }
    /**
     * Get environment variables by spawning a process (old approach).
     *
     * @private
     * @param {Resource} resource
     * @param {PythonInterpreter} [interpreter]
     * @param {boolean} [allowExceptions]
     * @returns {(Promise<NodeJS.ProcessEnv | undefined>)}
     * @memberof WrapperEnvironmentActivationService
     */
    private async getActivatedEnvVarsFromProc(resource: Resource, interpreter?: PythonInterpreter, allowExceptions?: boolean): Promise<NodeJS.ProcessEnv | undefined> {
        return this.procActivation.getActivatedEnvironmentVariables(resource, interpreter, allowExceptions);
    }
    /**
     * Get environment variables by activating a terminal.
     * As a fallback use the `fallback` promise passed in.
     *
     * @private
     * @param {(Promise<NodeJS.ProcessEnv | undefined>)} fallback
     * @param {Resource} resource
     * @param {PythonInterpreter} [interpreter]
     * @param {boolean} [allowExceptions]
     * @returns {(Promise<NodeJS.ProcessEnv | undefined>)}
     * @memberof WrapperEnvironmentActivationService
     */
    private async getActivatedEnvVarsFromTerminal(
        fallback: Promise<NodeJS.ProcessEnv | undefined>,
        resource: Resource,
        interpreter?: PythonInterpreter,
        allowExceptions?: boolean
    ): Promise<NodeJS.ProcessEnv | undefined> {
        if (!this.experiment.inExperiment(UseTerminalToGetActivatedEnvVars.experiment)) {
            return fallback;
        }

        return this.terminalActivation
            .getActivatedEnvironmentVariables(resource, interpreter, allowExceptions)
            .then(vars => {
                // If no variables in terminal, then revert to old approach.
                return vars || fallback;
            })
            .catch(ex => {
                // Swallow exceptions when using terminal env and revert to using old approach.
                traceError('Failed to get variables using Terminal Service', ex);
                return fallback;
            });
    }
    private getCacheKey(resource: Resource, interpreter?: PythonInterpreter | undefined) {
        return `${this.workspaceService.getWorkspaceFolderIdentifier(resource)}${interpreter?.path}`;
    }
}
