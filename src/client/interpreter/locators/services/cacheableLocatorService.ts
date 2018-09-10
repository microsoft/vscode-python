// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { injectable, unmanaged } from 'inversify';
import * as md5 from 'md5';
import { Uri } from 'vscode';
import { createDeferred, Deferred } from '../../../../utils/async';
import { IWorkspaceService } from '../../../common/application/types';
import { IPersistentStateFactory } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterLocatorService, PythonInterpreter } from '../../contracts';

@injectable()
export abstract class CacheableLocatorService implements IInterpreterLocatorService {
    private readonly promisesPerResource = new Map<string, Deferred<PythonInterpreter[]>>();
    private readonly cacheKeyPrefix: string;
    constructor(@unmanaged() name: string,
        @unmanaged() protected readonly serviceContainer: IServiceContainer,
        @unmanaged() private cachePerWorkspace: boolean = false) {
        this.cacheKeyPrefix = `INTERPRETERS_CACHE_v1_${name}`;
    }
    public abstract dispose();
    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        const cacheKey = this.getCacheKey(resource);
        let deferred = this.promisesPerResource.get(cacheKey);
        if (!deferred) {
            deferred = createDeferred<PythonInterpreter[]>();
            this.promisesPerResource.set(cacheKey, deferred);
            this.getInterpretersImplementation(resource)
                .then(async items => {
                    await this.cacheInterpreters(items, resource);
                    deferred!.resolve(items);
                })
                .catch(ex => deferred!.reject(ex));
        }
        if (deferred.completed) {
            return deferred.promise;
        }

        const cachedInterpreters = this.getCachedInterpreters(resource);
        return Array.isArray(cachedInterpreters) ? cachedInterpreters : deferred.promise;
    }

    protected abstract getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]>;
    private createPersistenceStore(resource?: Uri) {
        const cacheKey = this.getCacheKey(resource);
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        if (this.cachePerWorkspace) {
            return persistentFactory.createWorkspacePersistentState<PythonInterpreter[]>(cacheKey, undefined as any);
        } else {
            return persistentFactory.createGlobalPersistentState<PythonInterpreter[]>(cacheKey, undefined as any);
        }

    }
    private getCachedInterpreters(resource?: Uri) {
        const persistence = this.createPersistenceStore(resource);
        if (!Array.isArray(persistence.value)) {
            return;
        }
        return persistence.value.map(item => {
            return {
                ...item,
                cachedEntry: true
            };
        });
    }
    private async cacheInterpreters(interpreters: PythonInterpreter[], resource?: Uri) {
        const persistence = this.createPersistenceStore(resource);
        await persistence.updateValue(interpreters);
    }
    private getCacheKey(resource?: Uri) {
        if (!resource || !this.cachePerWorkspace) {
            return this.cacheKeyPrefix;
        }
        // Ensure we have separate caches per workspace where necessary.Î
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (!Array.isArray(workspaceService.workspaceFolders)) {
            return this.cacheKeyPrefix;
        }

        const workspace = workspaceService.getWorkspaceFolder(resource);
        return workspace ? `${this.cacheKeyPrefix}:${md5(workspace.uri.fsPath)}` : this.cacheKeyPrefix;
    }
}
