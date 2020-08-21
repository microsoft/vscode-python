// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Disposable, Event, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IPersistentStateFactory, Resource } from '../../common/types';
import { createDeferredFromPromise, Deferred } from '../../common/utils/async';
import { PartialPythonEnvironment } from '../info';
import { EnvironmentInfoServiceQueuePriority, IEnvironmentInfoService } from '../info/environmentInfoService';
import { EnvironmentsStorage } from './environmentsStorage';
import {
    GetEnvironmentLocatorOptions,
    IEnvironmentLocatorService,
    IEnvironmentsCollectionService
} from './locators/types';

/**
 * Collects environments from locators and maintains environment storage.
 */
export class EnvironmentsCollectionService implements IEnvironmentsCollectionService {
    public get onDidChange(): Event<Resource> {
        return this.environmentsStorage.onDidChange;
    }

    private readonly environmentsStorage: EnvironmentsStorage;
    private areAllEnvironmentsStoredForResourceDeferred: Map<Resource, Deferred<void[][]> | undefined> = new Map<
        Resource,
        Deferred<void[][]> | undefined
    >();
    private disposables: Disposable[] = [];

    constructor(
        persistentStateFactory: IPersistentStateFactory,
        fileSystem: IFileSystem,
        environmentsInfo: IEnvironmentInfoService,
        private readonly workspaceService: IWorkspaceService,
        private readonly locators: IEnvironmentLocatorService[]
    ) {
        this.environmentsStorage = new EnvironmentsStorage(persistentStateFactory, environmentsInfo, fileSystem);
        this.locators.forEach((locator) => {
            this.disposables.push(
                locator.onDidChange((resource) => this.getEnvironmentsFromLocatorAndStoreIt(locator, resource))
            );
        });
    }

    public dispose() {
        while (this.disposables.length > 0) {
            const disposable = this.disposables.shift()!;
            disposable.dispose();
        }
    }

    public async getEnvironments(
        resource?: Uri,
        options?: GetEnvironmentLocatorOptions
    ): Promise<PartialPythonEnvironment[]> {
        resource = this.workspaceService.getWorkspaceFolder(resource)?.uri;
        const areAllEnvironmentsStoredPromise = this.getEnvironmentsAndStoreIt(resource, options);
        if (options?.getAllEnvironmentsForResource) {
            // Wait until all discovered environments are stored into storage
            await areAllEnvironmentsStoredPromise;
        }
        return this.environmentsStorage.getEnvironments(areAllEnvironmentsStoredPromise, resource);
    }

    public async addPath(interpreterPath: string) {
        return this.environmentsStorage.addPartialInfo(
            { path: interpreterPath },
            { priority: EnvironmentInfoServiceQueuePriority.High }
        );
    }

    /**
     * Calls into locators to upgrade storage cache, can be used to refresh storage.
     * Returns a promise which resolves when all environments are discovered and stored and storage is upto date.
     */
    private async getEnvironmentsAndStoreIt(resource?: Uri, options?: GetEnvironmentLocatorOptions) {
        const deferred = this.areAllEnvironmentsStoredForResourceDeferred.get(resource);
        if (deferred && !deferred.completed) {
            // If previous promise to this method is still ongoing, do not initiate a new promise & return previous promise
            return deferred.promise;
        }
        const promise = Promise.all(
            this.locators.map(async (locator) => this.getEnvironmentsFromLocatorAndStoreIt(locator, resource, options))
        );
        this.areAllEnvironmentsStoredForResourceDeferred.set(resource, createDeferredFromPromise(promise));
        return promise;
    }

    private async getEnvironmentsFromLocatorAndStoreIt(
        locator: IEnvironmentLocatorService,
        resource?: Uri,
        options?: GetEnvironmentLocatorOptions
    ) {
        const environments = await locator.getEnvironments(resource, options);
        return Promise.all(
            environments.map((interpreter) => this.environmentsStorage.addPartialInfo(interpreter, options))
        );
    }
}
