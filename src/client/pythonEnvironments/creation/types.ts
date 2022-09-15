// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { CancellationToken, Progress } from 'vscode';

export interface CreateEnvironmentProgress extends Progress<{ message?: string; increment?: number }> {}

export interface CreateEnvironmentOptions {
    installPackages?: boolean;
    ignoreSourceControl?: boolean;
}

export interface CreateEnvironmentProvider {
    createEnvironment(
        options?: CreateEnvironmentOptions,
        progress?: CreateEnvironmentProgress,
        token?: CancellationToken,
    ): Promise<string | undefined>;
    name: string;
    description: string;
    id: string;
}
