// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { traceLog } from '../../logging';
import { CreateEnvironmentProvider } from './types';

export async function createEnvironment(provider: CreateEnvironmentProvider): Promise<void> {
    traceLog(`Creating environment using: ${provider.name}`);
    await provider.createEnvironment({
        ignoreSourceControl: true,
        installPackages: true,
    });
}
