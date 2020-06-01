// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { UseTerminalToGetActivatedEnvVars } from '../../common/experiments/groups';
import '../../common/extensions';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import {
    ICryptoUtils,
    IDisposableRegistry,
    IExperimentsManager,
    IExtensionContext,
    Resource
} from '../../common/types';
import { createDeferredFromPromise } from '../../common/utils/async';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { captureTelemetry } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IInterpreterService, PythonInterpreter } from '../contracts';
import { EnvironmentActivationService } from './service';
import { TerminalEnvironmentActivationService } from './terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from './types';

// We have code in terminal activation that waits for a min of 500ms.
// Observed on a Mac that it can take up to 2.5s (the delay is caused by initialization scripts running in the shell).
// On some other machines (windows) with Conda, this could take up to 40s.
// To get around this we will:
// 1. Load the variables when extension loads
// 2. Cache variables in a file (so its available when VSC re-loads).

type EnvVariablesInCachedFile = { env?: NodeJS.ProcessEnv };
@injectable()
export class WrapperEnvironmentActivationService implements IEnvironmentActivationService {
    private readonly cachePerResourceAndInterpreter = new Map<string, Promise<NodeJS.ProcessEnv | undefined>>();
    constructor(
        @inject(EnvironmentActivationService) private readonly procActivation: IEnvironmentActivationService,
        @inject(TerminalEnvironmentActivationService)
        private readonly terminalActivation: IEnvironmentActivationService,
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsProvider: IEnvironmentVariablesProvider,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,

        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        // Environment variables rely on custom variables defined by the user in `.env` files.
        disposables.push(
            envVarsProvider.onDidEnvironmentVariablesChange(() => this.cachePerResourceAndInterpreter.clear())
        );
    }
    @captureTelemetry(
        EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES,
        { failed: false, activatedByWrapper: true },
        true
    )
    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonInterpreter | undefined,
        allowExceptions?: boolean | undefined
    ): Promise<NodeJS.ProcessEnv | undefined> {
        let key: string;
        [key, interpreter] = await Promise.all([
            this.getCacheKey(resource, interpreter),
            interpreter || (await this.interpreterService.getActiveInterpreter(undefined))
        ]);

        const procCacheKey = `Process${key}`;
        const terminalCacheKey = `Terminal${key}`;
        const procEnvVarsPromise = this.cacheCallback(procCacheKey, () =>
            this.getActivatedEnvVarsFromProc(resource, interpreter, allowExceptions)
        );
        const terminalEnvVarsPromise = this.cacheCallback(terminalCacheKey, () =>
            this.getActivatedEnvVarsFromTerminal(procEnvVarsPromise, resource, interpreter, allowExceptions)
        );

        const procEnvVars = createDeferredFromPromise(procEnvVarsPromise);
        const terminalEnvVars = createDeferredFromPromise(terminalEnvVarsPromise);

        // Do not return this value, its possible both complete almost at the same time.
        // Hence wait for another tick, then check and return.
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
    private async cacheCallback(
        cacheKey: string,
        implementation: () => Promise<NodeJS.ProcessEnv | undefined>
    ): Promise<NodeJS.ProcessEnv | undefined> {
        const contents = await this.getDataCachedInFile(cacheKey);
        if (contents) {
            // If we have it in file cache, then blow away in memory cache, we don't need that anymore.
            this.cachePerResourceAndInterpreter.delete(cacheKey);
            return contents.env;
        }

        // If we don't have this cached in file, we need to ensure the request is cached in memory.
        // This way if two different parts of the extension request variables for the same resource + interpreter, they get the same result (promise).
        if (!this.cachePerResourceAndInterpreter.get(cacheKey)) {
            const promise = implementation();
            this.cachePerResourceAndInterpreter.set(cacheKey, promise);

            // What ever result we get back, store that in file (cache it for other VSC sessions).
            promise
                .then((env) => this.writeDataToCacheFile(cacheKey, { env }))
                .catch((ex) => traceError('Failed to write Env Vars to disc', ex));
        }

        return this.cachePerResourceAndInterpreter.get(cacheKey)!;
    }
    private getCacheFile(cacheKey: string): string | undefined {
        return this.context.storagePath
            ? path.join(this.context.storagePath, `pvscEnvVariables${cacheKey}.json`)
            : undefined;
    }
    private async getDataCachedInFile(cacheKey: string): Promise<EnvVariablesInCachedFile | undefined> {
        const cacheFile = this.getCacheFile(cacheKey);
        if (!cacheFile) {
            return;
        }
        return this.fs
            .readFile(cacheFile)
            .then((data) => JSON.parse(data) as EnvVariablesInCachedFile)
            .catch(() => undefined);
    }
    /**
     * Writes the environment variables to disc.
     * This way it is available to other VSC Sessions (between VSC reloads).
     */
    private async writeDataToCacheFile(cacheKey: string, data: EnvVariablesInCachedFile): Promise<void> {
        const cacheFile = this.getCacheFile(cacheKey);
        if (!cacheFile || !this.context.storagePath) {
            return;
        }
        if (!(await this.fs.directoryExists(this.context.storagePath))) {
            await this.fs.createDirectory(this.context.storagePath);
        }
        await this.fs.writeFile(cacheFile, JSON.stringify(data));
    }
    /**
     * Get environment variables by spawning a process (old approach).
     */
    private async getActivatedEnvVarsFromProc(
        resource: Resource,
        interpreter?: PythonInterpreter,
        allowExceptions?: boolean
    ): Promise<NodeJS.ProcessEnv | undefined> {
        return this.procActivation.getActivatedEnvironmentVariables(resource, interpreter, allowExceptions);
    }
    /**
     * Get environment variables by activating a terminal.
     * As a fallback use the `fallback` promise passed in (old approach).
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
            .then((vars) => {
                // If no variables in terminal, then revert to old approach.
                return vars || fallback;
            })
            .catch((ex) => {
                // Swallow exceptions when using terminal env and revert to using old approach.
                traceError('Failed to get variables using Terminal Service', ex);
                return fallback;
            });
    }
    /**
     * Computes a key used to cache environment variables.
     * 1. If resource changes, then environment variables could be different, as user could have `.env` files or similar.
     * (this might not be necessary, if there are no custom variables, but paths such as PYTHONPATH, PATH might be different too when computed).
     * 2. If interpreter changes, then environment variables could be different (conda has its own env variables).
     * 3. Similarly, each workspace could have its own env variables defined in `.env` files, and these could change as well.
     * Hence the key is computed based off of these three.
     */
    private async getCacheKey(resource: Resource, interpreter?: PythonInterpreter | undefined): Promise<string> {
        // Get the custom environment variables as a string (if any errors, ignore and use empty string).
        const customEnvVariables = await this.envVarsProvider
            .getCustomEnvironmentVariables(resource)
            .then((item) => (item ? JSON.stringify(item) : ''))
            .catch(() => '');

        return this.crypto.createHash(
            `${customEnvVariables}${interpreter?.path}${interpreter?.version?.raw}`,
            'string',
            'SHA256'
        );
    }
}
