// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { CodeActionKind, debug, DebugConfigurationProvider, languages, OutputChannel, window } from 'vscode';

import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry';
import { IExtensionActivationManager, ILanguageServerExtension } from './activation/types';
import { registerTypes as appRegisterTypes } from './application/serviceRegistry';
import { IApplicationDiagnostics } from './application/types';
import { DebugService } from './common/application/debugService';
import { IApplicationEnvironment, ICommandManager, IWorkspaceService } from './common/application/types';
import { Commands, PYTHON, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL, UseProposedApi } from './common/constants';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { traceError } from './common/logger';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { IFileSystem } from './common/platform/types';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IExtensionContext,
    IFeatureDeprecationManager,
    IOutputChannel
} from './common/types';
import { OutputChannelNames } from './common/utils/localize';
import { noop } from './common/utils/misc';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { JUPYTER_OUTPUT_CHANNEL } from './datascience/constants';
import { registerTypes as dataScienceRegisterTypes } from './datascience/serviceRegistry';
import { IDataScience } from './datascience/types';
import { DebuggerTypeName } from './debugger/constants';
import { DebugSessionEventDispatcher } from './debugger/extension/hooks/eventHandlerDispatcher';
import { IDebugSessionEventHandlers } from './debugger/extension/hooks/types';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/extension/serviceRegistry';
import { IDebugConfigurationService, IDebuggerBanner } from './debugger/extension/types';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import {
    IInterpreterLocatorProgressHandler,
    IInterpreterLocatorProgressService,
    IInterpreterService
} from './interpreter/contracts';
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry';
import { IServiceContainer, IServiceManager } from './ioc/types';
import { getLanguageConfiguration } from './language/languageConfiguration';
import { LinterCommands } from './linters/linterCommands';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { addOutputChannelLogging, setLoggingLevel } from './logging';
import { PythonCodeActionProvider } from './providers/codeActionProvider/pythonCodeActionProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { ReplProvider } from './providers/replProvider';
import { registerTypes as providersRegisterTypes } from './providers/serviceRegistry';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { ISortImportsEditingProvider } from './providers/types';
import { setExtensionInstallTelemetryProperties } from './telemetry/extensionInstallTelemetry';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { ICodeExecutionManager, ITerminalAutoActivation } from './terminals/types';
import { TEST_OUTPUT_CHANNEL } from './testing/common/constants';
import { ITestContextService } from './testing/common/types';
import { ITestCodeNavigatorCommandHandler, ITestExplorerCommandHandler } from './testing/navigation/types';
import { registerTypes as unitTestsRegisterTypes } from './testing/serviceRegistry';

export async function activateComponents(
    context: IExtensionContext,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
) {
    // We will be pulling code over from activateLegacy().

    return activateLegacy(context, serviceManager, serviceContainer);
}

/////////////////////////////
// old activation code

// tslint:disable-next-line:no-suspicious-comment
// TODO: Gradually move simple initialization
// and DI registration currently in this function over
// to initializeComponents().  Likewise with complex
// init and activation: move them to activateComponents().
// See https://github.com/microsoft/vscode-python/issues/10454.

async function activateLegacy(
    context: IExtensionContext,
    serviceManager: IServiceManager,
    serviceContainer: IServiceContainer
) {
    // register "services"

    const standardOutputChannel = window.createOutputChannel(OutputChannelNames.python());
    addOutputChannelLogging(standardOutputChannel);
    const unitTestOutChannel = window.createOutputChannel(OutputChannelNames.pythonTest());
    const jupyterOutputChannel = window.createOutputChannel(OutputChannelNames.jupyter());
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, jupyterOutputChannel, JUPYTER_OUTPUT_CHANNEL);

    // Core registrations (non-feature specific).
    platformRegisterTypes(serviceManager);
    processRegisterTypes(serviceManager);

    // We need to setup this property before any telemetry is sent
    const fs = serviceManager.get<IFileSystem>(IFileSystem);
    await setExtensionInstallTelemetryProperties(fs);

    const applicationEnv = serviceManager.get<IApplicationEnvironment>(IApplicationEnvironment);
    const enableProposedApi = applicationEnv.packageJson.enableProposedApi;
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

    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    // We should start logging using the log level as soon as possible, so set it as soon as we can access the level.
    // `IConfigurationService` may depend any of the registered types, so doing it after all registrations are finished.
    // XXX Move this *after* abExperiments is activated?
    setLoggingLevel(configuration.getSettings().logging.level);

    const abExperiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    await abExperiments.activate();

    // Register datascience types after experiments have loaded.
    // To ensure we can register types based on experiments.
    dataScienceRegisterTypes(serviceManager);

    const languageServerType = configuration.getSettings().languageServer;

    // Language feature registrations.
    appRegisterTypes(serviceManager, languageServerType);
    providersRegisterTypes(serviceManager);
    activationRegisterTypes(serviceManager, languageServerType);

    // "initialize" "services"

    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    interpreterManager.initialize();

    const handlers = serviceManager.getAll<IDebugSessionEventHandlers>(IDebugSessionEventHandlers);
    const disposables = serviceManager.get<IDisposableRegistry>(IDisposableRegistry);
    const dispatcher = new DebugSessionEventDispatcher(handlers, DebugService.instance, disposables);
    dispatcher.registerEventHandlers();

    const cmdManager = serviceContainer.get<ICommandManager>(ICommandManager);
    const outputChannel = serviceManager.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    disposables.push(cmdManager.registerCommand(Commands.ViewOutput, () => outputChannel.show()));
    cmdManager.executeCommand('setContext', 'python.vscode.channel', applicationEnv.channel).then(noop, noop);

    // Display progress of interpreter refreshes only after extension has activated.
    serviceContainer.get<IInterpreterLocatorProgressHandler>(IInterpreterLocatorProgressHandler).register();
    serviceContainer.get<IInterpreterLocatorProgressService>(IInterpreterLocatorProgressService).register();
    serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics).register();
    serviceContainer.get<ITestCodeNavigatorCommandHandler>(ITestCodeNavigatorCommandHandler).register();
    serviceContainer.get<ITestExplorerCommandHandler>(ITestExplorerCommandHandler).register();
    serviceContainer.get<ILanguageServerExtension>(ILanguageServerExtension).register();
    serviceContainer.get<ITestContextService>(ITestContextService).register();

    // "activate" everything else

    const manager = serviceContainer.get<IExtensionActivationManager>(IExtensionActivationManager);
    context.subscriptions.push(manager);
    const activationPromise = manager.activate();

    serviceManager.get<ITerminalAutoActivation>(ITerminalAutoActivation).register();
    const pythonSettings = configuration.getSettings();

    activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceContainer);

    const sortImports = serviceContainer.get<ISortImportsEditingProvider>(ISortImportsEditingProvider);
    sortImports.registerCommands();

    serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();

    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    interpreterManager
        .refresh(workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders![0].uri : undefined)
        .catch((ex) => traceError('Python Extension: interpreterManager.refresh', ex));

    // Activate data science features
    const dataScience = serviceManager.get<IDataScience>(IDataScience);
    dataScience.activate().ignoreErrors();

    context.subscriptions.push(new LinterCommands(serviceManager));

    languages.setLanguageConfiguration(PYTHON_LANGUAGE, getLanguageConfiguration());

    if (pythonSettings && pythonSettings.formatting && pythonSettings.formatting.provider !== 'internalConsole') {
        const formatProvider = new PythonFormattingEditProvider(context, serviceContainer);
        context.subscriptions.push(languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
        context.subscriptions.push(languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
    }

    const deprecationMgr = serviceContainer.get<IFeatureDeprecationManager>(IFeatureDeprecationManager);
    deprecationMgr.initialize();
    context.subscriptions.push(deprecationMgr);

    context.subscriptions.push(new ReplProvider(serviceContainer));

    const terminalProvider = new TerminalProvider(serviceContainer);
    terminalProvider.initialize(window.activeTerminal).ignoreErrors();
    context.subscriptions.push(terminalProvider);

    context.subscriptions.push(
        languages.registerCodeActionsProvider(PYTHON, new PythonCodeActionProvider(), {
            providedCodeActionKinds: [CodeActionKind.SourceOrganizeImports]
        })
    );

    serviceContainer.getAll<DebugConfigurationProvider>(IDebugConfigurationService).forEach((debugConfigProvider) => {
        context.subscriptions.push(debug.registerDebugConfigurationProvider(DebuggerTypeName, debugConfigProvider));
    });

    serviceContainer.get<IDebuggerBanner>(IDebuggerBanner).initialize();

    return { activationPromise };
}
