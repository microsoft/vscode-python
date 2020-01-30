// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { injectable, unmanaged } from 'inversify';
import * as md5 from 'md5';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { traceDecorators, traceVerbose } from '../../../common/logger';
import { IDisposableRegistry, IPersistentStateFactory } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { StopWatch } from '../../../common/utils/stopWatch';
import { IServiceContainer } from '../../../ioc/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { IInterpreterLocatorService, IInterpreterWatcher, PythonInterpreter } from '../../contracts';

@injectable()
export abstract class CacheableLocatorService implements IInterpreterLocatorService {
    protected readonly _hasInterpreters: Deferred<boolean>;
    private readonly promisesPerResource = new Map<string, Deferred<PythonInterpreter[]>>();
    private readonly handlersAddedToResource = new Set<string>();
    private readonly cacheKeyPrefix: string;
    private readonly locating = new EventEmitter<Promise<PythonInterpreter[]>>();
    constructor(
        @unmanaged() private readonly name: string,
        @unmanaged() protected readonly serviceContainer: IServiceContainer,
        @unmanaged() private cachePerWorkspace: boolean = false
    ) {
        this._hasInterpreters = createDeferred<boolean>();
        this.cacheKeyPrefix = `INTERPRETERS_CACHE_v3_${name}`;
    }
    public get onLocating(): Event<Promise<PythonInterpreter[]>> {
        return this.locating.event;
    }
    public get hasInterpreters(): Promise<boolean> {
        return this._hasInterpreters.completed ? this._hasInterpreters.promise : Promise.resolve(false);
    }
    public abstract dispose(): void;
    @traceDecorators.verbose('Get Interpreters in CacheableLocatorService')
    public async getInterpreters(resource?: Uri, ignoreCache?: boolean): Promise<PythonInterpreter[]> {
        const cacheKey = this.getCacheKey(resource);
        let deferred = this.promisesPerResource.get(cacheKey);

        if (!deferred || ignoreCache) {
            deferred = createDeferred<PythonInterpreter[]>();
            this.promisesPerResource.set(cacheKey, deferred);

            this.addHandlersForInterpreterWatchers(cacheKey, resource).ignoreErrors();

            const stopWatch = new StopWatch();
            this.getInterpretersImplementation(resource)
                .then(async items => {
                    await this.cacheInterpreters(items, resource);
                    traceVerbose(`Interpreters returned by ${this.name} are of count ${Array.isArray(items) ? items.length : 0}`);
                    traceVerbose(`Interpreters returned by ${this.name} are ${JSON.stringify(items)}`);
                    sendTelemetryEvent(EventName.PYTHON_INTERPRETER_DISCOVERY, stopWatch.elapsedTime, {
                        locator: this.name,
                        interpreters: Array.isArray(items) ? items.length : 0
                    });
                    deferred!.resolve(items);
                })
                .catch(ex => {
                    sendTelemetryEvent(EventName.PYTHON_INTERPRETER_DISCOVERY, stopWatch.elapsedTime, { locator: this.name }, ex);
                    deferred!.reject(ex);
                });

            this.locating.fire(deferred.promise);
        }
        deferred.promise.then(items => this._hasInterpreters.resolve(items.length > 0)).catch(_ => this._hasInterpreters.resolve(false));

        if (deferred.completed) {
            return deferred.promise;
        }

        const cachedInterpreters = ignoreCache ? undefined : this.getCachedInterpreters(resource);
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
            watcher.onDidCreate(
                () => {
                    traceVerbose(`Interpreter Watcher change handler for ${this.cacheKeyPrefix}`);
                    this.promisesPerResource.delete(cacheKey);
                    this.getInterpreters(resource).ignoreErrors();
                },
                this,
                disposableRegisry
            );
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
