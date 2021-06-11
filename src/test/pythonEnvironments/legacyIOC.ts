// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { instance, mock } from 'ts-mockito';
import { IServiceContainer, IServiceManager } from '../../client/ioc/types';
import { PythonEnvironments } from '../../client/pythonEnvironments/api';
import { initializeExternalDependencies } from '../../client/pythonEnvironments/common/externalDependencies';
import { registerLegacyDiscoveryForIOC, registerNewDiscoveryForIOC } from '../../client/pythonEnvironments/legacyIOC';

/**
 * This is here to support old tests.
 * @deprecated
 */
export async function registerForIOC(
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer,
): Promise<void> {
    initializeExternalDependencies(serviceContainer);
    // The old tests do not need real instances, directly pass in mocks.
    registerNewDiscoveryForIOC(serviceManager, instance(mock(PythonEnvironments)));
    await registerLegacyDiscoveryForIOC(serviceManager);
}
