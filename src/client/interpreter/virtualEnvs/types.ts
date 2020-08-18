// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { EnvironmentType } from '../../pythonEnvironments/info';
export const IVirtualEnvironmentManager = Symbol('VirtualEnvironmentManager');
export interface IVirtualEnvironmentManager {
    getEnvironmentName(pythonPath: string, resource?: Uri): Promise<string>;
    getEnvironmentType(pythonPath: string, resource?: Uri): Promise<EnvironmentType>;
    getPyEnvRoot(resource?: Uri): Promise<string | undefined>;
}
