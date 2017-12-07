// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InterpreterType } from '../contracts';
export const IVirtualEnvironmentIdentifier = Symbol('IVirtualEnvironment');

export interface IVirtualEnvironmentIdentifier {
    readonly name: string;
    readonly type: InterpreterType.VEnv | InterpreterType.VirtualEnv;
    detect(pythonPath: string): Promise<boolean>;
}
export const IVirtualEnvironmentManager = Symbol('VirtualEnvironmentManager');
export interface IVirtualEnvironmentManager {
    detect(pythonPath: string): Promise<IVirtualEnvironmentIdentifier | void>;
}
