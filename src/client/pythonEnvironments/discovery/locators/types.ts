import { Disposable, Event, Uri } from 'vscode';
import { Resource } from '../../../common/types';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { GetInterpreterOptions } from '../../../interpreter/interpreterService';
import { PartialPythonEnvironment } from '../../info';

export type GetInterpreterLocatorOptions = GetInterpreterOptions & { ignoreCache?: boolean };

export type GetEnvironmentLocatorOptions = GetInterpreterOptions & {
    getAllEnvironments?: boolean;
    getCompleteInfoForAllEnvironments?: boolean;
};

export const IEnvironmentLocatorService = Symbol('IEnvironmentLocatorService');
export interface IEnvironmentLocatorService extends Disposable {
    readonly onLocating: Event<Promise<PartialPythonEnvironment[]>>;
    onDidChange: Event<Resource>;
    getEnvironments(resource?: Uri, options?: GetInterpreterOptions): Promise<PartialPythonEnvironment[]>;
}

export interface IEnvironmentsCollectionService {
    /**
     * An event which is fired everytime the collection changes. Also carries resource for which the collection changed.
     */
    readonly onDidChange: Event<Resource>;
    /**
     * Returns the list of Python environments as they are discovered for a resource, does its best to return atleast one environment.
     * Returns empty list only if no environments are discovered.
     */
    getEnvironments(
        resource?: Resource,
        options?: GetEnvironmentLocatorOptions | undefined
    ): Promise<PartialPythonEnvironment[]>;
    /**
     * Add a custom environment path to the collection.
     */
    addPath(interpreterPath: string): Promise<void>;
}
