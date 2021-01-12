// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, DebugConfiguration, WorkspaceFolder } from 'vscode';
import { DebugConfigurationType, IDebugConfigurationProvider } from '../types';

export const IDebugConfigurationResolver = Symbol('IDebugConfigurationResolver');
export interface IDebugConfigurationResolver<T extends DebugConfiguration> {
    resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: T,
        token?: CancellationToken,
    ): Promise<T | undefined>;

    resolveDebugConfigurationWithSubstitutedVariables(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: T,
        token?: CancellationToken,
    ): Promise<T | undefined>;
}

export const IDebugConfigurationProviderFactory = Symbol('IDebugConfigurationProviderFactory');
export interface IDebugConfigurationProviderFactory {
    create(configurationType: DebugConfigurationType): IDebugConfigurationProvider;
}
