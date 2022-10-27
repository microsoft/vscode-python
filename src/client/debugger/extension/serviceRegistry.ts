// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../types';
import { DebugAdapterActivator } from './adapter/activator';
import { DebugAdapterDescriptorFactory } from './adapter/factory';
import { DebugSessionLoggingFactory } from './adapter/logging';
import { OutdatedDebuggerPromptFactory } from './adapter/outdatedDebuggerPrompt';
import { AttachProcessProviderFactory } from './attachQuickPick/factory';
import { IAttachProcessProviderFactory } from './attachQuickPick/types';
import { PythonDebugConfigurationService } from './configuration/debugConfigurationService';
import { DynamicPythonDebugConfigurationService } from './configuration/dynamicdebugConfigurationService';
import { LaunchJsonCompletionProvider } from './configuration/launch.json/completionProvider';
import { InterpreterPathCommand } from './configuration/launch.json/interpreterPathCommand';
import { LaunchJsonReader } from './configuration/launch.json/launchJsonReader';
import { LaunchJsonUpdaterService } from './configuration/launch.json/updaterService';
import { AttachConfigurationResolver } from './configuration/resolvers/attach';
import { DebugEnvironmentVariablesHelper, IDebugEnvironmentVariablesService } from './configuration/resolvers/helper';
import { LaunchConfigurationResolver } from './configuration/resolvers/launch';
import { IDebugConfigurationResolver, ILaunchJsonReader } from './configuration/types';
import { DebugCommands } from './debugCommands';
import { ChildProcessAttachEventHandler } from './hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from './hooks/childProcessAttachService';
import { IChildProcessAttachService, IDebugSessionEventHandlers } from './hooks/types';
import {
    IDebugAdapterDescriptorFactory,
    IDebugConfigurationService,
    IDebugSessionLoggingFactory,
    IDynamicDebugConfigurationService,
    IOutdatedDebuggerPromptFactory,
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        LaunchJsonCompletionProvider,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        InterpreterPathCommand,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        LaunchJsonUpdaterService,
    );
    serviceManager.addSingleton<IDebugConfigurationService>(
        IDebugConfigurationService,
        PythonDebugConfigurationService,
    );
    serviceManager.addSingleton<IDynamicDebugConfigurationService>(
        IDynamicDebugConfigurationService,
        DynamicPythonDebugConfigurationService,
    );
    serviceManager.addSingleton<IChildProcessAttachService>(IChildProcessAttachService, ChildProcessAttachService);
    serviceManager.addSingleton<IDebugSessionEventHandlers>(IDebugSessionEventHandlers, ChildProcessAttachEventHandler);
    serviceManager.addSingleton<IDebugConfigurationResolver<LaunchRequestArguments>>(
        IDebugConfigurationResolver,
        LaunchConfigurationResolver,
        'launch',
    );
    serviceManager.addSingleton<IDebugConfigurationResolver<AttachRequestArguments>>(
        IDebugConfigurationResolver,
        AttachConfigurationResolver,
        'attach',
    );
    serviceManager.addSingleton<IDebugEnvironmentVariablesService>(
        IDebugEnvironmentVariablesService,
        DebugEnvironmentVariablesHelper,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        DebugAdapterActivator,
    );
    serviceManager.addSingleton<IDebugAdapterDescriptorFactory>(
        IDebugAdapterDescriptorFactory,
        DebugAdapterDescriptorFactory,
    );
    serviceManager.addSingleton<IDebugSessionLoggingFactory>(IDebugSessionLoggingFactory, DebugSessionLoggingFactory);
    serviceManager.addSingleton<IOutdatedDebuggerPromptFactory>(
        IOutdatedDebuggerPromptFactory,
        OutdatedDebuggerPromptFactory,
    );
    serviceManager.addSingleton<IAttachProcessProviderFactory>(
        IAttachProcessProviderFactory,
        AttachProcessProviderFactory,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, DebugCommands);
    serviceManager.addSingleton<ILaunchJsonReader>(ILaunchJsonReader, LaunchJsonReader);
}
