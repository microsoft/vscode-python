// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import { instance, mock, verify } from 'ts-mockito';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
    IInterpreterLocatorHelper,
    IInterpreterLocatorProgressService,
    IInterpreterLocatorService,
    IInterpreterWatcher,
    IInterpreterWatcherBuilder,
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../../client/interpreter/contracts';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../../client/interpreter/locators/types';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { PythonInterpreterLocatorService } from '../../client/pythonEnvironments/discovery/locators';
import { InterpreterLocatorHelper } from '../../client/pythonEnvironments/discovery/locators/helpers';
import { InterpreterLocatorProgressService } from '../../client/pythonEnvironments/discovery/locators/progressService';
import { CondaEnvFileService } from '../../client/pythonEnvironments/discovery/locators/services/condaEnvFileService';
import { CondaEnvService } from '../../client/pythonEnvironments/discovery/locators/services/condaEnvService';
import { CondaService } from '../../client/pythonEnvironments/discovery/locators/services/condaService';
import {
    CurrentPathService,
    PythonInPathCommandProvider,
} from '../../client/pythonEnvironments/discovery/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService,
} from '../../client/pythonEnvironments/discovery/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from '../../client/pythonEnvironments/discovery/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../client/pythonEnvironments/discovery/locators/services/hashProviderFactory';
import { InterpreterWatcherBuilder } from '../../client/pythonEnvironments/discovery/locators/services/interpreterWatcherBuilder';
import {
    KnownPathsService,
    KnownSearchPathsForInterpreters,
} from '../../client/pythonEnvironments/discovery/locators/services/KnownPathsService';
import { PipEnvService } from '../../client/pythonEnvironments/discovery/locators/services/pipEnvService';
import { PipEnvServiceHelper } from '../../client/pythonEnvironments/discovery/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from '../../client/pythonEnvironments/discovery/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from '../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService,
} from '../../client/pythonEnvironments/discovery/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from '../../client/pythonEnvironments/discovery/locators/services/workspaceVirtualEnvWatcherService';
import { registerLegacyDiscoveryForIOC } from '../../client/pythonEnvironments/legacyIOC';

suite('Interpreters - Service Registry', () => {
    test('Registrations', () => {
        const serviceManager = mock(ServiceManager);
        registerLegacyDiscoveryForIOC(instance(serviceManager));
        verify(serviceManager.addSingleton(IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters)).once();
        verify(
            serviceManager.addSingleton(
                IVirtualEnvironmentsSearchPathProvider,
                GlobalVirtualEnvironmentsSearchPathProvider,
                'global',
            ),
        ).once();
        verify(
            serviceManager.addSingleton(
                IVirtualEnvironmentsSearchPathProvider,
                WorkspaceVirtualEnvironmentsSearchPathProvider,
                'workspace',
            ),
        ).once();

        verify(serviceManager.addSingleton(ICondaService, CondaService)).once();
        verify(serviceManager.addSingleton(IPipEnvServiceHelper, PipEnvServiceHelper)).once();
        verify(serviceManager.addSingleton(IPythonInPathCommandProvider, PythonInPathCommandProvider)).once();

        verify(serviceManager.addSingleton(IInterpreterWatcherBuilder, InterpreterWatcherBuilder)).once();

        verify(
            serviceManager.addSingleton(
                IInterpreterLocatorService,
                PythonInterpreterLocatorService,
                INTERPRETER_LOCATOR_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton(IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE),
        ).once();
        verify(serviceManager.addSingleton(IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE)).once();
        verify(
            serviceManager.addSingleton(IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE),
        ).once();
        verify(
            serviceManager.addSingleton(
                IInterpreterLocatorService,
                GlobalVirtualEnvService,
                GLOBAL_VIRTUAL_ENV_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton(
                IInterpreterLocatorService,
                WorkspaceVirtualEnvService,
                WORKSPACE_VIRTUAL_ENV_SERVICE,
            ),
        ).once();
        verify(serviceManager.addSingleton(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE)).once();

        verify(
            serviceManager.addSingleton(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE),
        ).once();
        verify(serviceManager.addSingleton(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE)).once();

        verify(serviceManager.addSingleton(IInterpreterLocatorHelper, InterpreterLocatorHelper)).once();
        verify(
            serviceManager.addSingleton(IInterpreterLocatorProgressService, InterpreterLocatorProgressService),
        ).once();

        verify(serviceManager.addSingleton(WindowsStoreInterpreter, WindowsStoreInterpreter)).once();
        verify(serviceManager.addSingleton(InterpreterHashProvider, InterpreterHashProvider)).once();
        verify(serviceManager.addSingleton(InterpeterHashProviderFactory, InterpeterHashProviderFactory)).once();

        verify(
            serviceManager.add<IInterpreterWatcher>(
                IInterpreterWatcher,
                WorkspaceVirtualEnvWatcherService,
                WORKSPACE_VIRTUAL_ENV_SERVICE,
            ),
        ).once();
    });
});
