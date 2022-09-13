// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

export interface CreateEnvironmentOptions {
    installPackages?: boolean;
    ignoreSourceControl?: boolean;
}

export interface CreateEnvironmentProvider {
    createEnvironment(options?: CreateEnvironmentOptions): Promise<void>;
    name: string;
    description: string;
    id: string;
}
