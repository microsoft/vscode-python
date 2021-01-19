// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify, when } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { DiscoveryVariants } from '../../client/common/experiments/groups';
import { ExperimentService } from '../../client/common/experiments/service';
import { IExperimentService } from '../../client/common/types';
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
import { initializeExternalDependencies } from '../../client/pythonEnvironments/common/externalDependencies';
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
    test('Registrations', async function () {
        const serviceManager = mock(ServiceManager);
        const serviceContainer = mock(ServiceContainer);
        const experimentService = mock(ExperimentService);
        when(serviceContainer.get<IExperimentService>(IExperimentService)).thenReturn(instance(experimentService));
        when(experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching)).thenResolve(false);
        initializeExternalDependencies(instance(serviceContainer));
        await registerLegacyDiscoveryForIOC(instance(serviceManager));

        verify(
            serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                PythonInterpreterLocatorService,
                INTERPRETER_LOCATOR_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                CondaEnvFileService,
                CONDA_ENV_FILE_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                CondaEnvService,
                CONDA_ENV_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                GlobalVirtualEnvService,
                GLOBAL_VIRTUAL_ENV_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
                IVirtualEnvironmentsSearchPathProvider,
                GlobalVirtualEnvironmentsSearchPathProvider,
                'global',
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                KnownPathsService,
                KNOWN_PATH_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(
                IKnownSearchPathsForInterpreters,
                KnownSearchPathsForInterpreters,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorProgressService>(
                IInterpreterLocatorProgressService,
                InterpreterLocatorProgressService,
            ),
        ).once();
        verify(serviceManager.addBinding(IInterpreterLocatorProgressService, IExtensionSingleActivationService)).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                CurrentPathService,
                CURRENT_PATH_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IPythonInPathCommandProvider>(
                IPythonInPathCommandProvider,
                PythonInPathCommandProvider,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                WorkspaceVirtualEnvService,
                WORKSPACE_VIRTUAL_ENV_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                PipEnvService,
                PIPENV_SERVICE,
            ),
        ).once();

        verify(
            serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                WindowsRegistryService,
                WINDOWS_REGISTRY_SERVICE,
            ),
        ).once();
        verify(serviceManager.addSingleton<ICondaService>(ICondaService, CondaService)).once();
        verify(serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper)).once();

        verify(
            serviceManager.add<IInterpreterWatcher>(
                IInterpreterWatcher,
                WorkspaceVirtualEnvWatcherService,
                WORKSPACE_VIRTUAL_ENV_SERVICE,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter),
        ).once();
        verify(
            serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
                IVirtualEnvironmentsSearchPathProvider,
                WorkspaceVirtualEnvironmentsSearchPathProvider,
                'workspace',
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IInterpreterWatcherBuilder>(
                IInterpreterWatcherBuilder,
                InterpreterWatcherBuilder,
            ),
        ).once();
    });
});
