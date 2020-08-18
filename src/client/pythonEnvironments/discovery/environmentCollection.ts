// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Disposable, Event, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry, IPersistentStateFactory, Resource } from '../../common/types';
import { createDeferredFromPromise, Deferred } from '../../common/utils/async';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { PartialPythonEnvironment } from '../info';
import { EnvironmentInfoServiceQueuePriority, IEnvironmentInfoService } from '../info/environmentInfoService';
import { EnvironmentsStorage } from './environmentsStorage';
import {
    GetEnvironmentLocatorOptions,
    IEnvironmentLocatorService,
    IEnvironmentsCollectionService
} from './locators/types';

/**
 * Facilitates locating Python environments.
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
    private readonly locators: IEnvironmentLocatorService[];

    constructor(
        persistentStateFactory: IPersistentStateFactory,
        fileSystem: IFileSystem,
        environmentsInfo: IEnvironmentInfoService,
        private readonly workspaceService: IWorkspaceService,
        private readonly serviceContainer: IServiceContainer
    ) {
        this.environmentsStorage = new EnvironmentsStorage(persistentStateFactory, environmentsInfo, fileSystem);
        this.locators = this.getLocators();
        const disposables = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.locators.forEach((locator) => {
            disposables.push(
                locator.onDidChange((resource) => this.getEnvironmentsFromLocatorAndStoreIt(locator, resource))
            );
        });
    }

    public async getEnvironments(
        resource?: Uri,
        options?: GetEnvironmentLocatorOptions
    ): Promise<PartialPythonEnvironment[]> {
        resource = this.workspaceService.getWorkspaceFolder(resource)?.uri;
        let areAllEnvironmentsStoredDeferred = this.areAllEnvironmentsStoredForResourceDeferred.get(resource);
        if (!areAllEnvironmentsStoredDeferred || areAllEnvironmentsStoredDeferred.completed) {
            // Do not trigger discovery using locators for resource again if previous promise is still ongoing
            const promise = this.getEnvironmentsAndStoreIt(resource, options);
            areAllEnvironmentsStoredDeferred = createDeferredFromPromise(promise);
            this.areAllEnvironmentsStoredForResourceDeferred.set(resource, areAllEnvironmentsStoredDeferred);
        }
        if (options?.getAllEnvironments) {
            // Wait until all discovered environments are stored into storage
            await areAllEnvironmentsStoredDeferred.promise;
        }
        return this.environmentsStorage.getEnvironments(areAllEnvironmentsStoredDeferred.promise, resource);
    }

    public async addPath(interpreterPath: string) {
        return this.environmentsStorage.addPartialInfo(
            { path: interpreterPath },
            { priority: EnvironmentInfoServiceQueuePriority.High }
        );
    }

    private async getEnvironmentsAndStoreIt(resource?: Uri, options?: GetEnvironmentLocatorOptions) {
        return Promise.all(
            this.locators.map(async (locator) => this.getEnvironmentsFromLocatorAndStoreIt(locator, resource, options))
        );
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

    /**
     * Return the list of applicable interpreter locators.
     */
    private getLocators(): IEnvironmentLocatorService[] {
        const keys = [
            WINDOWS_REGISTRY_SERVICE,
            CONDA_ENV_SERVICE,
            CONDA_ENV_FILE_SERVICE,
            PIPENV_SERVICE,
            GLOBAL_VIRTUAL_ENV_SERVICE,
            WORKSPACE_VIRTUAL_ENV_SERVICE,
            KNOWN_PATH_SERVICE,
            CURRENT_PATH_SERVICE
        ];
        return keys.map((item) =>
            this.serviceContainer.get<IEnvironmentLocatorService>(IEnvironmentLocatorService, item)
        );
    }
}
