// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Container } from 'inversify';
import { Disposable, Memento, OutputChannel, window } from 'vscode';

import { IApplicationEnvironment } from './common/application/types';
import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry';
import { registerTypes as appRegisterTypes } from './application/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import {
    GLOBAL_MEMENTO,
    IDisposableRegistry,
    IConfigurationService,
    IExtensionContext,
    IOutputChannel,
    IMemento,
    WORKSPACE_MEMENTO,
} from './common/types';
import { ExtensionState } from './components';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer, IServiceManager } from './ioc/types';
import * as pythonEnvironments from './pythonEnvironments';
import { PythonEnvironments } from './pythonEnvironments/api';
import { OutputChannelNames } from './common/utils/localize';
import { registerTypes as providersRegisterTypes } from './providers/serviceRegistry';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/extension/serviceRegistry';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { registerTypes as tensorBoardRegisterTypes } from './tensorBoard/serviceRegistry';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { TEST_OUTPUT_CHANNEL } from './testing/common/constants';
import { registerTypes as unitTestsRegisterTypes } from './testing/serviceRegistry';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { addOutputChannelLogging } from './logging';
import { STANDARD_OUTPUT_CHANNEL, UseProposedApi } from './common/constants';

// The code in this module should do nothing more complex than register
// objects to DI and simple init (e.g. no side effects).  That implies
// that constructors are likewise simple and do no work.  It also means
// that it is inherently synchronous.

export function initializeGlobals(
    // This is stored in ExtensionState.
    context: IExtensionContext,
): ExtensionState {
    const cont = new Container({ skipBaseClassChecks: true });
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    const disposables: IDisposableRegistry = context.subscriptions;

    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance<IServiceManager>(IServiceManager, serviceManager);

    serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, disposables);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO);
    serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, context);

    return {
        context,
        disposables,
        legacyIOC: { serviceManager, serviceContainer },
    };
}

/**
 * TODO: As we start refactoring things into components, gradually move simple initialization
 * and DI registration currently in this function over to initializeComponents().
 * See https://github.com/microsoft/vscode-python/issues/10454.
 */
export function initializeLegacy(ext: ExtensionState): void {
    const { serviceManager } = ext.legacyIOC;

    // Core registrations (non-feature specific).
    commonRegisterTypes(ext.legacyIOC.serviceManager);
    platformRegisterTypes(serviceManager);
    processRegisterTypes(serviceManager);

    // register "services"

    const standardOutputChannel = window.createOutputChannel(OutputChannelNames.python());
    addOutputChannelLogging(standardOutputChannel);
    const unitTestOutChannel = window.createOutputChannel(OutputChannelNames.pythonTest());
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL);

    const applicationEnv = serviceManager.get<IApplicationEnvironment>(IApplicationEnvironment);
    const { enableProposedApi } = applicationEnv.packageJson;
    serviceManager.addSingletonInstance<boolean>(UseProposedApi, enableProposedApi);
    // Feature specific registrations.
    variableRegisterTypes(serviceManager);
    unitTestsRegisterTypes(serviceManager);
    lintersRegisterTypes(serviceManager);
    interpretersRegisterTypes(serviceManager);
    formattersRegisterTypes(serviceManager);
    installerRegisterTypes(serviceManager);
    commonRegisterTerminalTypes(serviceManager);
    debugConfigurationRegisterTypes(serviceManager);
    tensorBoardRegisterTypes(serviceManager);

    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    const languageServerType = configuration.getSettings().languageServer;

    // Language feature registrations.
    appRegisterTypes(serviceManager, languageServerType);
    providersRegisterTypes(serviceManager);
    activationRegisterTypes(serviceManager, languageServerType);
}

/**
 * The set of public APIs from initialized components.
 */
export type Components = {
    pythonEnvs: PythonEnvironments;
};

/**
 * Initialize all components in the extension.
 */
export function initializeComponents(ext: ExtensionState): Components {
    const pythonEnvs = pythonEnvironments.initialize(ext);

    // Other component initializers go here.
    // We will be factoring them out of activateLegacy().

    return {
        pythonEnvs,
    };
}
