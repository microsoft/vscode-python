// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { Progress, Uri } from 'vscode';

export interface CreateEnvironmentProgress extends Progress<{ message?: string; increment?: number }> {}

export interface CreateEnvironmentOptions {
    installPackages?: boolean;
    ignoreSourceControl?: boolean;
    showBackButton?: boolean;
}

export interface CreateEnvironmentResult {
    path: string | undefined;
    uri: Uri | undefined;
    action?: 'Back' | 'Cancel';
}

export interface CreateEnvironmentProvider {
    createEnvironment(options?: CreateEnvironmentOptions): Promise<CreateEnvironmentResult | undefined>;
    name: string;
    description: string;
    id: string;
}
