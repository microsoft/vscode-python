// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable } from 'vscode';

export interface CreateEnvironmentOptions {
    installPackages?: boolean;
    ignoreSourceControl?: boolean;
}

export interface CreateEnvironmentResult {
    interpreterPath: string;
}

export interface CreateEnvironmentProvider {
    createEnvironment(options?: CreateEnvironmentOptions): Promise<CreateEnvironmentResult>;
    name: string;
    description: string;
}

export function registerCreateEnvironmentProvider(provider: CreateEnvironmentProvider): Disposable {}
