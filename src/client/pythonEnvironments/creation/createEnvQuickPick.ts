// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { traceError } from '../../logging';
import { createEnvironment } from './createEnvironment';
import { CreateEnvironmentProvider } from './types';

async function showCreateEnvironmentQuickPick(providers: readonly CreateEnvironmentProvider[]): Promise<void> {}

export async function handleCreateEnvironmentCommand(providers: readonly CreateEnvironmentProvider[]): Promise<void> {
    if (providers.length === 1) {
        await createEnvironment(providers[0]);
    } else if (providers.length > 1) {
        await showCreateEnvironmentQuickPick(providers);
    } else {
        traceError('No Environment Creation providers were registered.');
    }
}
