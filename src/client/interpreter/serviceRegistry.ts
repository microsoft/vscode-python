// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IsWindows } from '../common/types';
import { IServiceManager } from '../ioc/types';
import { InterpreterSelector } from './configuration/interpreterSelector';
import { PythonPathUpdaterService } from './configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from './configuration/pythonPathUpdaterServiceFactory';
import { IInterpreterSelector, IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from './configuration/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    IInterpreterService,
    IInterpreterVersionService,
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
    IPipEnvService,
    IShebangCodeLensProvider,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from './contracts';
import { InterpreterDisplay } from './display';
import { ShebangCodeLensProvider } from './display/shebangCodeLensProvider';
import { InterpreterHelper } from './helpers';
import { InterpreterService } from './interpreterService';
import { InterpreterVersionService } from './interpreterVersion';
import { InterpreterLocatorHelper } from './locators/helpers';
import { PythonInterpreterLocatorService } from './locators/index';
import { CondaEnvFileService } from './locators/services/condaEnvFileService';
import { CondaEnvService } from './locators/services/condaEnvService';
import { CondaService } from './locators/services/condaService';
import { CurrentPathService } from './locators/services/currentPathService';
import { GlobalVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvService } from './locators/services/globalVirtualEnvService';
import { getKnownSearchPathsForInterpreters, KnownPathsService } from './locators/services/KnownPathsService';
import { PipEnvService } from './locators/services/pipEnvService';
import { WindowsRegistryService } from './locators/services/windowsRegistryService';
import { WorkspaceVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvService } from './locators/services/workspaceVirtualEnvService';
import { VirtualEnvironmentManager } from './virtualEnvs/index';
import { IVirtualEnvironmentManager } from './virtualEnvs/types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<string[]>(IKnownSearchPathsForInterpreters, getKnownSearchPathsForInterpreters());
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global');
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvironmentsSearchPathProvider, 'workspace');

    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingleton<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, VirtualEnvironmentManager);

    serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, GlobalVirtualEnvService, GLOBAL_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WorkspaceVirtualEnvService, WORKSPACE_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IPipEnvService, PipEnvService);

    const isWindows = serviceManager.get<boolean>(IsWindows);
    if (isWindows) {
        serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE);
    } else {
        serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE);
    }
    serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
    serviceManager.addSingleton<IInterpreterDisplay>(IInterpreterDisplay, InterpreterDisplay);

    serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory);
    serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, PythonPathUpdaterService);

    serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
    serviceManager.addSingleton<IShebangCodeLensProvider>(IShebangCodeLensProvider, ShebangCodeLensProvider);
    serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
    serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
}
