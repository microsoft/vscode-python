// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Uri } from 'vscode';

export const ITensorBoardImportTracker = Symbol('ITensorBoardImportTracker');
export interface ITensorBoardImportTracker {
    onDidImportTensorBoard: Event<void>;
}

export interface ITensorboardDependencyChecker {
    ensureDependenciesAreInstalled(resource?: Uri): Promise<boolean>;
}
