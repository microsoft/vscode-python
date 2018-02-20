// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const IVirtualEnvironmentManager = Symbol('VirtualEnvironmentManager');
export interface IVirtualEnvironmentManager {
    getEnvironmentName(pythonPath: string): Promise<string>;
}
