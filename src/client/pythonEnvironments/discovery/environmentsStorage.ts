// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { Event, EventEmitter } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IPersistentStateFactory, Resource } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { mergeEnvironments, PartialPythonEnvironment, PythonEnvironment } from '../info';
import { EnvironmentInfoServiceQueuePriority, IEnvironmentInfoService } from '../info/environmentInfoService';
import { isEnvironmentValid, resolvePossibleSymlinkToRealPath } from '../utils';
import { GetEnvironmentLocatorOptions } from './locators/types';

export const partialInfoEnvironmentMapKey = 'PARTIAL_INFO_ENVIRONMENT_MAP_KEY';
export const completeInfoEnvironmentMapKey = 'COMPLETE_INFO_ENVIRONMENT_MAP_KEY';

export class EnvironmentsStorage {
    public get onDidChange(): Event<Resource> {
        return this.didChangeCollectionEmitter.event;
    }
    private readonly partialInfoEnvironmentMap: Map<string, PartialPythonEnvironment>;
    private readonly completeInfoEnvironmentMap: Map<string, PythonEnvironment>;
    /**
     * Promise resolved once the storage contains atleast one environment
     */
    private readonly storageContainsEnvironments: Deferred<void> = createDeferred<void>();
    private readonly didChangeCollectionEmitter = new EventEmitter<Resource>();

    constructor(
        private readonly persistentStateFactory: IPersistentStateFactory,
        private readonly environmentsInfo: IEnvironmentInfoService,
        private readonly fileSystem: IFileSystem
    ) {
        this.partialInfoEnvironmentMap = this.persistentStateFactory.createGlobalPersistentState(
            partialInfoEnvironmentMapKey,
            new Map<string, PartialPythonEnvironment>()
        ).value;
        this.completeInfoEnvironmentMap = this.persistentStateFactory.createGlobalPersistentState(
            completeInfoEnvironmentMapKey,
            new Map<string, PythonEnvironment>()
        ).value;
    }

    /**
     * Returns environments from storage for a resource, does its best to return atleast one environment.
     * Returns empty list only if no environments are discovered which can be stored.
     * @param areAllEnvironmentsStoredPromise A promise which resolves when all environments are discovered and stored
     */
    public async getEnvironments(areAllEnvironmentsStoredPromise: Promise<void[][]>, resource: Resource) {
        await this.removeInvalidEntriesFromStorage();
        if (this.partialInfoEnvironmentMap.size > 0 || this.completeInfoEnvironmentMap.size > 0) {
            this.storageContainsEnvironments.resolve();
        }
        // Wait until storage contains atleast one environment, or if there're no more environments to be added to storage
        await Promise.race([this.storageContainsEnvironments.promise, areAllEnvironmentsStoredPromise]);

        const items = [...this.completeInfoEnvironmentMap.values(), ...this.partialInfoEnvironmentMap.values()].filter(
            (i) => i.resource === undefined || i.resource === resource
        );
        return mergeEnvironments(items, this.fileSystem);
    }

    public async addPartialInfo(
        partialInfo: PartialPythonEnvironment,
        options?: GetEnvironmentLocatorOptions & { priority?: EnvironmentInfoServiceQueuePriority }
    ) {
        partialInfo.path = path.normalize(resolvePossibleSymlinkToRealPath(partialInfo.path));
        if (this.completeInfoEnvironmentMap.has(partialInfo.path)) {
            return;
        }
        if (this.partialInfoEnvironmentMap.has(partialInfo.path)) {
            const storedInfo = this.partialInfoEnvironmentMap.get(partialInfo.path)!;
            // Combine the stored info with the new info
            partialInfo = mergeEnvironments([storedInfo, partialInfo], this.fileSystem)[0];
        }

        const storeCompleteInfoPromise = this.environmentsInfo
            .getEnvironmentInfo(partialInfo.path, options?.priority)
            .then((environmentInfo) => {
                if (this.partialInfoEnvironmentMap.has(partialInfo.path)) {
                    this.partialInfoEnvironmentMap.delete(partialInfo.path);
                }
                if (!environmentInfo) {
                    return;
                }
                // Partial info may contain certain properties like 'pipEnvWorkspaceFolder' which environment info doesn't return
                // Combine the two to create complete info
                const completeEnvironmentInfo = mergeEnvironments(
                    [environmentInfo, partialInfo],
                    this.fileSystem
                )[0] as PythonEnvironment;
                this.completeInfoEnvironmentMap.set(partialInfo.path, completeEnvironmentInfo);
                this.didChangeCollectionEmitter.fire(partialInfo.resource);
            });

        if (options?.getCompleteInfoForAllEnvironments) {
            await storeCompleteInfoPromise;
        } else {
            // Add to partial environment storage only if the option to getCompleteInfo is not set
            this.partialInfoEnvironmentMap.set(partialInfo.path, partialInfo);
            this.didChangeCollectionEmitter.fire(partialInfo.resource);
        }
        // One environment just added to storage, resolve promise
        this.storageContainsEnvironments.resolve();
    }

    private async removeInvalidEntriesFromStorage() {
        return Promise.all(
            [this.partialInfoEnvironmentMap, this.completeInfoEnvironmentMap].map((map) => {
                return [...map.entries()].map(async ([key, environment]) => {
                    const isValid = await isEnvironmentValid(environment, this.fileSystem);
                    if (!isValid) {
                        map.delete(key);
                    }
                });
            })
        );
    }
}
