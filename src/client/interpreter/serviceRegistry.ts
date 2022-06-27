// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionActivationService, IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { EnvironmentActivationService } from './activation/service';
import { IEnvironmentActivationService } from './activation/types';
import { InterpreterAutoSelectionService } from './autoSelection/index';
import { InterpreterAutoSelectionProxyService } from './autoSelection/proxy';
import { IInterpreterAutoSelectionService, IInterpreterAutoSelectionProxyService } from './autoSelection/types';
import { EnvironmentTypeComparer } from './configuration/environmentTypeComparer';
import { InstallPythonCommand } from './configuration/interpreterSelector/commands/installPython';
import { ResetInterpreterCommand } from './configuration/interpreterSelector/commands/resetInterpreter';
import { SetInterpreterCommand } from './configuration/interpreterSelector/commands/setInterpreter';
import { SetShebangInterpreterCommand } from './configuration/interpreterSelector/commands/setShebangInterpreter';
import { InterpreterSelector } from './configuration/interpreterSelector/interpreterSelector';
import { PythonPathUpdaterService } from './configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from './configuration/pythonPathUpdaterServiceFactory';
import {
    IInterpreterComparer,
    IInterpreterSelector,
    IPythonPathUpdaterServiceFactory,
    IPythonPathUpdaterServiceManager,
} from './configuration/types';
import { IInterpreterDisplay, IInterpreterHelper, IInterpreterService, IShebangCodeLensProvider } from './contracts';
import { InterpreterDisplay } from './display';
import { InterpreterLocatorProgressStatubarHandler } from './display/progressDisplay';
import { ShebangCodeLensProvider } from './display/shebangCodeLensProvider';
import { InterpreterHelper } from './helpers';
import { InterpreterService } from './interpreterService';
import { CondaInheritEnvPrompt } from './virtualEnvs/condaInheritEnvPrompt';
import { VirtualEnvironmentPrompt } from './virtualEnvs/virtualEnvPrompt';

/**
 * Register all the new types inside this method.
 * This method is created for testing purposes. Registers all interpreter types except `IInterpreterAutoSelectionProxyService`, `IEnvironmentActivationService`.
 * See use case in `src\test\serviceRegistry.ts` for details
 * @param serviceManager
 */

export function registerInterpreterTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        InstallPythonCommand,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        SetInterpreterCommand,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        ResetInterpreterCommand,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        SetShebangInterpreterCommand,
    );

    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, VirtualEnvironmentPrompt);

    serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
    serviceManager.addSingleton<IInterpreterDisplay>(IInterpreterDisplay, InterpreterDisplay);
    serviceManager.addBinding(IInterpreterDisplay, IExtensionSingleActivationService);

    serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(
        IPythonPathUpdaterServiceFactory,
        PythonPathUpdaterServiceFactory,
    );
    serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(
        IPythonPathUpdaterServiceManager,
        PythonPathUpdaterService,
    );

    serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
    serviceManager.addSingleton<IShebangCodeLensProvider>(IShebangCodeLensProvider, ShebangCodeLensProvider);
    serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);

    serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, EnvironmentTypeComparer);

    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        InterpreterLocatorProgressStatubarHandler,
    );

    serviceManager.addSingleton<IInterpreterAutoSelectionService>(
        IInterpreterAutoSelectionService,
        InterpreterAutoSelectionService,
    );

    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, CondaInheritEnvPrompt);
}

export function registerTypes(serviceManager: IServiceManager): void {
    registerInterpreterTypes(serviceManager);
    serviceManager.addSingleton<IInterpreterAutoSelectionProxyService>(
        IInterpreterAutoSelectionProxyService,
        InterpreterAutoSelectionProxyService,
    );
    serviceManager.addSingleton<IEnvironmentActivationService>(
        EnvironmentActivationService,
        EnvironmentActivationService,
    );
    serviceManager.addSingleton<IEnvironmentActivationService>(
        IEnvironmentActivationService,
        EnvironmentActivationService,
    );
}
