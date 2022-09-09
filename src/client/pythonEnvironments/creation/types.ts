// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

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
