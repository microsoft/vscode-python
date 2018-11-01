// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { injectable, unmanaged } from 'inversify';
import * as md5 from 'md5';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { Logger } from '../../../common/logger';
import { IDisposableRegistry, IPersistentStateFactory } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterLocatorService, IInterpreterWatcher, PythonInterpreter } from '../../contracts';

@injectable()
export abstract class CacheableLocatorService implements IInterpreterLocatorService {
    private readonly promisesPerResource = new Map<string, Deferred<PythonInterpreter[]>>();
    private readonly handlersAddedToResource = new Set<string>();
    private readonly cacheKeyPrefix: string;
    private readonly locating = new EventEmitter<Promise<PythonInterpreter[]>>();
    constructor(@unmanaged() name: string,
        @unmanaged() protected readonly serviceContainer: IServiceContainer,
        @unmanaged() private cachePerWorkspace: boolean = false) {
        this.cacheKeyPrefix = `INTERPRETERS_CACHE_v2_${name}`;
    }
    public get onLocating(): Event<Promise<PythonInterpreter[]>> {
        return this.locating.event;
    }
    public abstract dispose();
    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        const cacheKey = this.getCacheKey(resource);
        let deferred = this.promisesPerResource.get(cacheKey);

        if (!deferred) {
            deferred = createDeferred<PythonInterpreter[]>();
            this.promisesPerResource.set(cacheKey, deferred);

            this.addHandlersForInterpreterWatchers(cacheKey, resource)
                .ignoreErrors();

            this.getInterpretersImplementation(resource)
                .then(async items => {
                    await this.cacheInterpreters(items, resource);
                    deferred!.resolve(items);
                })
                .catch(ex => deferred!.reject(ex));

            this.locating.fire(deferred.promise);
        }
        if (deferred.completed) {
            return deferred.promise;
        }

        const cachedInterpreters = this.getCachedInterpreters(resource);
        return Array.isArray(cachedInterpreters) ? cachedInterpreters : deferred.promise;
    }
    protected async addHandlersForInterpreterWatchers(cacheKey: string, resource: Uri | undefined): Promise<void> {
        if (this.handlersAddedToResource.has(cacheKey)) {
            return;
        }
        this.handlersAddedToResource.add(cacheKey);
        const watchers = await this.getInterpreterWatchers(resource);
        const disposableRegisry = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        watchers.forEach(watcher => {
            watcher.onDidCreate(() => {
                Logger.verbose(`Interpreter Watcher change handler for ${this.cacheKeyPrefix}`);
                this.promisesPerResource.delete(cacheKey);
                this.getInterpreters(resource).ignoreErrors();
            }, this, disposableRegisry);
        });
    }
    protected async getInterpreterWatchers(_resource: Uri | undefined): Promise<IInterpreterWatcher[]> {
        return [];
    }

    protected abstract getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]>;
    protected createPersistenceStore(resource?: Uri) {
        const cacheKey = this.getCacheKey(resource);
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        if (this.cachePerWorkspace) {
            return persistentFactory.createWorkspacePersistentState<PythonInterpreter[]>(cacheKey, undefined as any);
        } else {
            return persistentFactory.createGlobalPersistentState<PythonInterpreter[]>(cacheKey, undefined as any);
        }

    }
    protected getCachedInterpreters(resource?: Uri): PythonInterpreter[] | undefined {
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
    protected async cacheInterpreters(interpreters: PythonInterpreter[], resource?: Uri) {
        const persistence = this.createPersistenceStore(resource);
        await persistence.updateValue(interpreters);
    }
    protected getCacheKey(resource?: Uri) {
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
