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
import { IInterpreterService, PythonInterpreter } from '../contracts';
import { cacheDuration, EnvironmentActivationService } from './service';
import { TerminalEnvironmentActivationService } from './terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from './types';

@injectable()
export class WrapperEnvironmentActivationService implements IEnvironmentActivationService {
    private readonly cachePerResourceAndInterpreter = new Map<string, InMemoryCache<Promise<NodeJS.ProcessEnv | undefined>>>();
    // Give preference to env variables provided by proc vars.
    constructor(
        @inject(EnvironmentActivationService) private readonly procActivation: IEnvironmentActivationService,
        @inject(TerminalEnvironmentActivationService) private readonly terminalActivation: IEnvironmentActivationService,
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        disposables.push(interpreterService.onDidChangeInterpreter(() => this.cachePerResourceAndInterpreter.clear()));
    }

    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonInterpreter | undefined,
        allowExceptions?: boolean | undefined
    ): Promise<NodeJS.ProcessEnv | undefined> {
        const key = `${this.workspaceService.getWorkspaceFolderIdentifier(resource)}${interpreter?.path}${allowExceptions}`;
        if (this.cachePerResourceAndInterpreter.get(key)?.hasData) {
            return this.cachePerResourceAndInterpreter.get(key)?.data;
        }

        const promise = this.getActivatedEnvironmentVariablesImpl(resource, interpreter, allowExceptions);
        const cache = new InMemoryCache<Promise<NodeJS.ProcessEnv | undefined>>(cacheDuration);
        cache.data = promise;
        this.cachePerResourceAndInterpreter.set(key, cache);

        return promise;
    }
    private async getActivatedEnvironmentVariablesImpl(resource: Resource, interpreter?: PythonInterpreter, allowExceptions?: boolean): Promise<NodeJS.ProcessEnv | undefined> {
        const procEnvVars = this.procActivation.getActivatedEnvironmentVariables(resource, interpreter, allowExceptions);

        // if (!this.experiment.inExperiment(UseTerminalToGetActivatedEnvVars.experiment)) {
        //     return procEnvVars;
        // }

        const terminalEnvVars = createDeferredFromPromise(
            this.terminalActivation
                .getActivatedEnvironmentVariables(resource, interpreter, allowExceptions)
                .then(vars => {
                    // If no variables in terminal, then revert to old approach.
                    return vars || procEnvVars;
                })
                .catch(ex => {
                    // Swallow exceptions when using terminal env and revert to using old approach.
                    traceError('Failed to get variables using Terminal Service', ex);
                    return procEnvVars;
                })
        );

        await Promise.race([terminalEnvVars.promise, procEnvVars]);

        // If terminal activation didn't complete, wait for 1.5s.
        // We have code in terminal activation that waits for a min of 500ms. Lets wait for 1.5s.
        if (!terminalEnvVars.completed) {
            await sleep(1_500);
        }

        return Promise.race([terminalEnvVars.promise, procEnvVars]);
    }
}
