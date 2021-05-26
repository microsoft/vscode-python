// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

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
import { IFileSystem } from './common/platform/types';
import { StartPage } from './common/startPage/startPage';
import { IStartPage } from './common/startPage/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IExperimentsManager,
    IExtensions,
    IOutputChannel,
} from './common/types';
import { noop } from './common/utils/misc';
import { DebuggerTypeName } from './debugger/constants';
import { DebugSessionEventDispatcher } from './debugger/extension/hooks/eventHandlerDispatcher';
import { IDebugSessionEventHandlers } from './debugger/extension/hooks/types';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/extension/serviceRegistry';
import { IDebugConfigurationService, IDebuggerBanner } from './debugger/extension/types';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import { IInterpreterService } from './interpreter/contracts';
import { getLanguageConfiguration } from './language/languageConfiguration';
import { LinterCommands } from './linters/linterCommands';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { setLoggingLevel } from './logging';
import { PythonCodeActionProvider } from './providers/codeActionProvider/pythonCodeActionProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { ReplProvider } from './providers/replProvider';
import { registerTypes as providersRegisterTypes } from './providers/serviceRegistry';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { ISortImportsEditingProvider } from './providers/types';
import { setExtensionInstallTelemetryProperties } from './telemetry/extensionInstallTelemetry';
import { registerTypes as tensorBoardRegisterTypes } from './tensorBoard/serviceRegistry';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { ICodeExecutionManager, ITerminalAutoActivation } from './terminals/types';
import { ITestCodeNavigatorCommandHandler, ITestExplorerCommandHandler } from './testing/navigation/types';
import { registerTypes as unitTestsRegisterTypes } from './testing/serviceRegistry';
import { ITestingService } from './testing/types';
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry';

// components
import * as pythonEnvironments from './pythonEnvironments';

import { ActivationResult, ExtensionState } from './components';
import { Components } from './extensionInit';
import { setDefaultLanguageServer } from './activation/common/defaultlanguageServer';

export async function activateComponents(
    // `ext` is passed to any extra activation funcs.
    ext: ExtensionState,
    components: Components,
): Promise<ActivationResult[]> {
    // Note that each activation returns a promise that resolves
    // when that activation completes.  However, it might have started
    // some non-critical background operations that do not block
    // extension activation but do block use of the extension "API".
    // Each component activation can't just resolve an "inner" promise
    // for those non-critical operations because `await` (and
    // `Promise.all()`, etc.) will flatten nested promises.  Thus
    // activation resolves `ActivationResult`, which can safely wrap
    // the "inner" promise.

    // TODO: As of now activateLegacy() registers various classes which might
    // be required while activating components. Once registration from
    // activateLegacy() are moved before we activate other components, we can
    // activate them parallelly with the other components.
    // https://github.com/microsoft/vscode-python/issues/15380
    // These will go away eventually once everything is refactored into components.
    const legacyActivationResult = await activateLegacy(ext);
    const promises: Promise<ActivationResult>[] = [
        // More component activations will go here
        pythonEnvironments.activate(components.pythonEnvs),
    ];
    return Promise.all([legacyActivationResult, ...promises]);
}

/// //////////////////////////
// old activation code

// TODO: Gradually move simple initialization
// and DI registration currently in this function over
// to initializeComponents().  Likewise with complex
// init and activation: move them to activateComponents().
// See https://github.com/microsoft/vscode-python/issues/10454.

async function activateLegacy(ext: ExtensionState): Promise<ActivationResult> {
    const { context, legacyIOC } = ext;
    const { serviceManager, serviceContainer } = legacyIOC;

    // register "services"

    const standardOutputChannel = serviceManager.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);

    // We need to setup this property before any telemetry is sent
    const fs = serviceManager.get<IFileSystem>(IFileSystem);
    await setExtensionInstallTelemetryProperties(fs);

    const applicationEnv = serviceManager.get<IApplicationEnvironment>(IApplicationEnvironment);
    const { enableProposedApi } = applicationEnv.packageJson;
    serviceManager.addSingletonInstance<boolean>(UseProposedApi, enableProposedApi);
    // Feature specific registrations.
    unitTestsRegisterTypes(serviceManager);
    lintersRegisterTypes(serviceManager);
    interpretersRegisterTypes(serviceManager);
    formattersRegisterTypes(serviceManager);
    installerRegisterTypes(serviceManager);
    commonRegisterTerminalTypes(serviceManager);
    debugConfigurationRegisterTypes(serviceManager);
    tensorBoardRegisterTypes(serviceManager);

    const experimentService = serviceContainer.get<IExperimentService>(IExperimentService);
    // This guarantees that all experiment information has loaded & all telemetry will contain experiment info.
    await experimentService.activate();

    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const extensions = serviceContainer.get<IExtensions>(IExtensions);
    await setDefaultLanguageServer(experimentService, extensions, serviceManager);

    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    // We should start logging using the log level as soon as possible, so set it as soon as we can access the level.
    // `IConfigurationService` may depend any of the registered types, so doing it after all registrations are finished.
    // XXX Move this *after* abExperiments is activated?
    setLoggingLevel(configuration.getSettings().logging.level);

    const abExperiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    await abExperiments.activate();

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
    const startPage = serviceManager.get<StartPage>(IStartPage);
    cmdManager.registerCommand(Commands.OpenStartPage, () => startPage.open());
    cmdManager.executeCommand('setContext', 'python.vscode.channel', applicationEnv.channel).then(noop, noop);

    serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics).register();
    serviceContainer.get<ITestCodeNavigatorCommandHandler>(ITestCodeNavigatorCommandHandler).register();
    serviceContainer.get<ITestExplorerCommandHandler>(ITestExplorerCommandHandler).register();
    serviceContainer.get<ILanguageServerExtension>(ILanguageServerExtension).register();
    serviceContainer.get<ITestingService>(ITestingService).register();

    // "activate" everything else

    const manager = serviceContainer.get<IExtensionActivationManager>(IExtensionActivationManager);
    context.subscriptions.push(manager);

    await interpreterManager
        .refresh(workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders![0].uri : undefined)
        .catch((ex) => traceError('Python Extension: interpreterManager.refresh', ex));

    const activationPromise = manager.activate();

    serviceManager.get<ITerminalAutoActivation>(ITerminalAutoActivation).register();
    const pythonSettings = configuration.getSettings();

    activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceContainer);

    const sortImports = serviceContainer.get<ISortImportsEditingProvider>(ISortImportsEditingProvider);
    sortImports.registerCommands();

    serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();

    context.subscriptions.push(new LinterCommands(serviceManager));

    languages.setLanguageConfiguration(PYTHON_LANGUAGE, getLanguageConfiguration());

    if (pythonSettings && pythonSettings.formatting && pythonSettings.formatting.provider !== 'internalConsole') {
        const formatProvider = new PythonFormattingEditProvider(context, serviceContainer);
        context.subscriptions.push(languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
        context.subscriptions.push(languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
    }

    context.subscriptions.push(new ReplProvider(serviceContainer));

    const terminalProvider = new TerminalProvider(serviceContainer);
    terminalProvider.initialize(window.activeTerminal).ignoreErrors();
    context.subscriptions.push(terminalProvider);

    context.subscriptions.push(
        languages.registerCodeActionsProvider(PYTHON, new PythonCodeActionProvider(), {
            providedCodeActionKinds: [CodeActionKind.SourceOrganizeImports],
        }),
    );

    serviceContainer.getAll<DebugConfigurationProvider>(IDebugConfigurationService).forEach((debugConfigProvider) => {
        context.subscriptions.push(debug.registerDebugConfigurationProvider(DebuggerTypeName, debugConfigProvider));
    });

    serviceContainer.get<IDebuggerBanner>(IDebuggerBanner).initialize();

    return { fullyReady: activationPromise };
}
