// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IsWindows } from '../common/types';
import { IServiceManager } from '../ioc/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    ICondaService,
    IInterpreterLocatorService,
    IInterpreterService,
    IInterpreterVersionService,
    IKnownSearchPathsForInterpreters,
    IKnownSearchPathsForVirtualEnvironments,
    INTERPRETER_LOCATOR_SERVICE,
    KNOWN_PATH_SERVICE,
    VIRTUAL_ENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE
} from './contracts';
import { InterpreterManager } from './index';
import { InterpreterVersionService } from './interpreterVersion';
import { PythonInterpreterLocatorService } from './locators/index';
import { CondaEnvFileService } from './locators/services/condaEnvFileService';
import { CondaEnvService } from './locators/services/condaEnvService';
import { CondaService } from './locators/services/condaService';
import { CurrentPathService } from './locators/services/currentPathService';
import { getKnownSearchPathsForInterpreters, KnownPathsService } from './locators/services/KnownPathsService';
import { getKnownSearchPathsForVirtualEnvs, VirtualEnvService } from './locators/services/virtualEnvService';
import { WindowsRegistryService } from './locators/services/windowsRegistryService';
import { VirtualEnvironmentManager } from './virtualEnvs/index';
import { IVirtualEnvironmentIdentifier, IVirtualEnvironmentManager } from './virtualEnvs/types';
import { VEnv } from './virtualEnvs/venv';
import { VirtualEnv } from './virtualEnvs/virtualEnv';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<string[]>(IKnownSearchPathsForInterpreters, getKnownSearchPathsForInterpreters());
    serviceManager.addSingletonInstance<string[]>(IKnownSearchPathsForVirtualEnvironments, getKnownSearchPathsForVirtualEnvs());

    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingleton<IVirtualEnvironmentIdentifier>(IVirtualEnvironmentIdentifier, VirtualEnv);
    serviceManager.addSingleton<IVirtualEnvironmentIdentifier>(IVirtualEnvironmentIdentifier, VEnv);

    serviceManager.addSingleton<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, VirtualEnvironmentManager);

    serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, VirtualEnvService, VIRTUAL_ENV_SERVICE);

    const isWindows = serviceManager.get<boolean>(IsWindows);
    if (isWindows) {
        serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE);
    } else {
        serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE);
    }
    serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterManager);
}
