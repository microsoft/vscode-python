// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import {
    anything, instance, mock, verify,
} from 'ts-mockito';
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
import { ServiceContainer } from '../../client/ioc/container';
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
import { IEnvironmentInfoService } from '../../client/pythonEnvironments/info/environmentInfoService';
import { registerForIOC } from '../../client/pythonEnvironments/legacyIOC';

suite('Interpreters - Service Registry', () => {
    test('Registrations', () => {
        const serviceManager = mock(ServiceManager);
        const serviceContainer = mock(ServiceContainer);
        registerForIOC(instance(serviceManager), instance(serviceContainer));

        [
            [IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters],
            [IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global'],
            [IVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvironmentsSearchPathProvider, 'workspace'],

            [ICondaService, CondaService],
            [IPipEnvServiceHelper, PipEnvServiceHelper],
            [IPythonInPathCommandProvider, PythonInPathCommandProvider],

            [IInterpreterWatcherBuilder, InterpreterWatcherBuilder],

            [IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE],
            [IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE],
            [IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE],
            [IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE],
            [IInterpreterLocatorService, GlobalVirtualEnvService, GLOBAL_VIRTUAL_ENV_SERVICE],
            [IInterpreterLocatorService, WorkspaceVirtualEnvService, WORKSPACE_VIRTUAL_ENV_SERVICE],
            [IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE],

            [IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE],
            [IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE],

            [IInterpreterLocatorHelper, InterpreterLocatorHelper],
            [IInterpreterLocatorProgressService, InterpreterLocatorProgressService],

            [WindowsStoreInterpreter, WindowsStoreInterpreter],
            [InterpreterHashProvider, InterpreterHashProvider],
            [InterpeterHashProviderFactory, InterpeterHashProviderFactory],
        ].forEach((mapping) => {
            verify(serviceManager.addSingleton.apply(serviceManager, mapping as any)).once();
        });
        verify(
            serviceManager.add<IInterpreterWatcher>(
                IInterpreterWatcher,
                WorkspaceVirtualEnvWatcherService,
                WORKSPACE_VIRTUAL_ENV_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingletonInstance<IEnvironmentInfoService>(IEnvironmentInfoService, anything()),
        ).once();
    });
});
