// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { Progress, Uri } from 'vscode';

export interface CreateEnvironmentProgress extends Progress<{ message?: string; increment?: number }> {}

export interface CreateEnvironmentOptions {
    /**
     * Default `true`. If `true`, the environment creation handler is expected to install packages.
     */
    installPackages?: boolean;

    /**
     * Default `true`. If `true`, the environment creation provider is expected to add the environment to ignore list
     * for the source control.
     */
    ignoreSourceControl?: boolean;

    /**
     * Default `false`. If `true` the creation provider should show back button when showing QuickPick or QuickInput.
     */
    showBackButton?: boolean;

    /**
     * Default `true`. If `true`, the environment will be selected as the environment to be used for the workspace.
     */
    selectEnvironment?: boolean;
}

export interface CreateEnvironmentResult {
    path: string | undefined;
    uri: Uri | undefined;
    action?: 'Back' | 'Cancel';
}

export interface CreateEnvironmentStartedEventArgs {
    options: CreateEnvironmentOptions | undefined;
}

export interface CreateEnvironmentExitedEventArgs {
    result: CreateEnvironmentResult | undefined;
    error?: unknown;
    options: CreateEnvironmentOptions | undefined;
}

export interface CreateEnvironmentProvider {
    createEnvironment(options?: CreateEnvironmentOptions): Promise<CreateEnvironmentResult | undefined>;
    name: string;
    description: string;
    id: string;
}
