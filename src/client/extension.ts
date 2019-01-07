'use strict';
// This line should always be right on top.
// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}
const durations: { [key: string]: number } = {};
import { StopWatch } from './common/utils/stopWatch';
// Do not move this line of code (used to measure extension load times).
const stopWatch = new StopWatch();
import { Container } from 'inversify';
import {
    CodeActionKind,
    debug,
    DebugConfigurationProvider,
    Disposable,
    ExtensionContext,
    extensions,
    IndentAction,
    languages,
    Memento,
    OutputChannel,
    ProgressLocation,
    ProgressOptions,
    window
} from 'vscode';

import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry';
import { IExtensionActivationService } from './activation/types';
import { buildApi, IExtensionApi } from './api';
import { registerTypes as appRegisterTypes } from './application/serviceRegistry';
import { IApplicationDiagnostics } from './application/types';
import { DebugService } from './common/application/debugService';
import { IWorkspaceService } from './common/application/types';
import { isTestExecution, PYTHON, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from './common/constants';
import { registerTypes as registerDotNetTypes } from './common/dotnet/serviceRegistry';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import { ITerminalHelper } from './common/terminal/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExtensionContext,
    IFeatureDeprecationManager,
    ILogger,
    IMemento,
    IOutputChannel,
    Resource,
    WORKSPACE_MEMENTO
} from './common/types';
import { createDeferred } from './common/utils/async';
import { Common } from './common/utils/localize';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { registerTypes as dataScienceRegisterTypes } from './datascience/serviceRegistry';
import { IDataScience } from './datascience/types';
import { DebuggerTypeName } from './debugger/constants';
import { DebugSessionEventDispatcher } from './debugger/extension/hooks/eventHandlerDispatcher';
import { IDebugSessionEventHandlers } from './debugger/extension/hooks/types';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/extension/serviceRegistry';
import { IDebugConfigurationService, IDebuggerBanner } from './debugger/extension/types';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import { AutoSelectionRule, IInterpreterAutoSelectionRule, IInterpreterAutoSelectionService } from './interpreter/autoSelection/types';
import { IInterpreterSelector } from './interpreter/configuration/types';
import {
    ICondaService,
    IInterpreterLocatorProgressService,
    IInterpreterService,
    InterpreterLocatorProgressHandler,
    PythonInterpreter
} from './interpreter/contracts';
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer, IServiceManager } from './ioc/types';
import { LinterCommands } from './linters/linterCommands';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { ILintingEngine } from './linters/types';
import { PythonCodeActionProvider } from './providers/codeActionsProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { LinterProvider } from './providers/linterProvider';
import { ReplProvider } from './providers/replProvider';
import { registerTypes as providersRegisterTypes } from './providers/serviceRegistry';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { ISortImportsEditingProvider } from './providers/types';
import { activateUpdateSparkLibraryProvider } from './providers/updateSparkLibraryProvider';
import { sendTelemetryEvent } from './telemetry';
import { EDITOR_LOAD } from './telemetry/constants';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { ICodeExecutionManager, ITerminalAutoActivation } from './terminals/types';
import { TEST_OUTPUT_CHANNEL } from './unittests/common/constants';
import { registerTypes as unitTestsRegisterTypes } from './unittests/serviceRegistry';

durations.codeLoadingTime = stopWatch.elapsedTime;
const activationDeferred = createDeferred<void>();
let activatedServiceContainer: ServiceContainer | undefined;

// tslint:disable-next-line:max-func-body-length
export async function activate(context: ExtensionContext): Promise<IExtensionApi> {
    displayProgress(activationDeferred.promise);
    durations.startActivateTime = stopWatch.elapsedTime;
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    activatedServiceContainer = serviceContainer;
    registerServices(context, serviceManager, serviceContainer);
    initializeServices(context, serviceManager, serviceContainer);

    const autoSelection = serviceContainer.get<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService);
    await autoSelection.autoSelectInterpreter(undefined);

    // When testing, do not perform health checks, as modal dialogs can be displayed.
    if (!isTestExecution()) {
        const appDiagnostics = serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics);
        await appDiagnostics.performPreStartupHealthCheck();
    }

    serviceManager.get<ITerminalAutoActivation>(ITerminalAutoActivation).register();
    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    const pythonSettings = configuration.getSettings();

    const standardOutputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceContainer);

    const activationService = serviceContainer.get<IExtensionActivationService>(IExtensionActivationService);
    const lsActivationPromise = activationService.activate();
    displayProgress(lsActivationPromise);

    const sortImports = serviceContainer.get<ISortImportsEditingProvider>(ISortImportsEditingProvider);
    sortImports.registerCommands();

    serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();
    sendStartupTelemetry(Promise.all([activationDeferred.promise, lsActivationPromise]), serviceContainer).ignoreErrors();

    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    interpreterManager.refresh(workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders![0].uri : undefined)
        .catch(ex => console.error('Python Extension: interpreterManager.refresh', ex));

    const jupyterExtension = extensions.getExtension('donjayamanne.jupyter');
    const lintingEngine = serviceManager.get<ILintingEngine>(ILintingEngine);
    lintingEngine.linkJupyterExtension(jupyterExtension).ignoreErrors();

    // Activate data science features
    const dataScience = serviceManager.get<IDataScience>(IDataScience);
    dataScience.activate().ignoreErrors();

    context.subscriptions.push(new LinterCommands(serviceManager));
    const linterProvider = new LinterProvider(context, serviceManager);
    context.subscriptions.push(linterProvider);

    // Enable indentAction
    // tslint:disable-next-line:no-non-null-assertion
    languages.setLanguageConfiguration(PYTHON_LANGUAGE, {
        onEnterRules: [
            {
                beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async)\b.*:\s*/,
                action: { indentAction: IndentAction.Indent }
            },
            {
                beforeText: /^(?!\s+\\)[^#\n]+\\\s*/,
                action: { indentAction: IndentAction.Indent }
            },
            {
                beforeText: /^\s*#.*/,
                afterText: /.+$/,
                action: { indentAction: IndentAction.None, appendText: '# ' }
            },
            {
                beforeText: /^\s+(continue|break|return)\b.*/,
                afterText: /\s+$/,
                action: { indentAction: IndentAction.Outdent }
            }
        ]
    });

    if (pythonSettings && pythonSettings.formatting && pythonSettings.formatting.provider !== 'none') {
        const formatProvider = new PythonFormattingEditProvider(context, serviceContainer);
        context.subscriptions.push(languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
        context.subscriptions.push(languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
    }

    const deprecationMgr = serviceContainer.get<IFeatureDeprecationManager>(IFeatureDeprecationManager);
    deprecationMgr.initialize();
    context.subscriptions.push(deprecationMgr);

    context.subscriptions.push(activateUpdateSparkLibraryProvider());

    context.subscriptions.push(new ReplProvider(serviceContainer));
    context.subscriptions.push(new TerminalProvider(serviceContainer));

    context.subscriptions.push(languages.registerCodeActionsProvider(PYTHON, new PythonCodeActionProvider(), { providedCodeActionKinds: [CodeActionKind.SourceOrganizeImports] }));

    serviceContainer.getAll<DebugConfigurationProvider>(IDebugConfigurationService).forEach(debugConfigProvider => {
        context.subscriptions.push(debug.registerDebugConfigurationProvider(DebuggerTypeName, debugConfigProvider));
    });

    serviceContainer.get<IDebuggerBanner>(IDebuggerBanner).initialize();
    durations.endActivateTime = stopWatch.elapsedTime;
    activationDeferred.resolve();

    const api = buildApi(Promise.all([activationDeferred.promise, lsActivationPromise]));
    // In test environment return the DI Container.
    if (isTestExecution()) {
        // tslint:disable:no-any
        (api as any).serviceContainer = serviceContainer;
        (api as any).serviceManager = serviceManager;
        // tslint:enable:no-any
    }
    return api;
}

export function deactivate(): Thenable<void> {
    // Make sure to shutdown anybody who needs it.
    if (activatedServiceContainer) {
        const registry = activatedServiceContainer.get<IAsyncDisposableRegistry>(IAsyncDisposableRegistry);
        if (registry) {
            return registry.dispose();
        }
    }

    return Promise.resolve();
}

// tslint:disable-next-line:no-any
function displayProgress(promise: Promise<any>) {
    const progressOptions: ProgressOptions = { location: ProgressLocation.Window, title: Common.loadingExtension() };
    window.withProgress(progressOptions, () => promise);
}

function registerServices(context: ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance<IServiceManager>(IServiceManager, serviceManager);
    serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, context.subscriptions);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO);
    serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, context);

    const standardOutputChannel = window.createOutputChannel('Python');
    const unitTestOutChannel = window.createOutputChannel('Python Test Log');
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL);

    activationRegisterTypes(serviceManager);
    commonRegisterTypes(serviceManager);
    registerDotNetTypes(serviceManager);
    processRegisterTypes(serviceManager);
    variableRegisterTypes(serviceManager);
    unitTestsRegisterTypes(serviceManager);
    lintersRegisterTypes(serviceManager);
    interpretersRegisterTypes(serviceManager);
    formattersRegisterTypes(serviceManager);
    platformRegisterTypes(serviceManager);
    installerRegisterTypes(serviceManager);
    commonRegisterTerminalTypes(serviceManager);
    dataScienceRegisterTypes(serviceManager);
    debugConfigurationRegisterTypes(serviceManager);
    appRegisterTypes(serviceManager);
    providersRegisterTypes(serviceManager);
}

function initializeServices(context: ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
    const selector = serviceContainer.get<IInterpreterSelector>(IInterpreterSelector);
    selector.initialize();
    context.subscriptions.push(selector);

    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    interpreterManager.initialize();

    const handlers = serviceManager.getAll<IDebugSessionEventHandlers>(IDebugSessionEventHandlers);
    const disposables = serviceManager.get<IDisposableRegistry>(IDisposableRegistry);
    const dispatcher = new DebugSessionEventDispatcher(handlers, DebugService.instance, disposables);
    dispatcher.registerEventHandlers();

    // Display progress of interpreter refreshes only after extension has activated.
    serviceContainer.get<InterpreterLocatorProgressHandler>(InterpreterLocatorProgressHandler).register();
    serviceContainer.get<IInterpreterLocatorProgressService>(IInterpreterLocatorProgressService).register();
    serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics).register();

    // Get latest interpreter list.
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const mainWorkspaceUri = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders![0].uri : undefined;
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    interpreterService.getInterpreters(mainWorkspaceUri).ignoreErrors();
}

// tslint:disable-next-line:no-any
async function sendStartupTelemetry(activatedPromise: Promise<any>, serviceContainer: IServiceContainer) {
    const logger = serviceContainer.get<ILogger>(ILogger);
    try {
        await activatedPromise;
        const terminalHelper = serviceContainer.get<ITerminalHelper>(ITerminalHelper);
        const terminalShellType = terminalHelper.identifyTerminalShell(terminalHelper.getTerminalShellPath());
        const condaLocator = serviceContainer.get<ICondaService>(ICondaService);
        const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
        const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        const mainWorkspaceUri = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders![0].uri : undefined;
        const settings = configurationService.getSettings(mainWorkspaceUri);
        const [condaVersion, interpreter, interpreters] = await Promise.all([
            condaLocator.getCondaVersion().then(ver => ver ? ver.raw : '').catch<string>(() => ''),
            interpreterService.getActiveInterpreter().catch<PythonInterpreter | undefined>(() => undefined),
            interpreterService.getInterpreters(mainWorkspaceUri).catch<PythonInterpreter[]>(() => [])
        ]);
        const workspaceFolderCount = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders!.length : 0;
        const pythonVersion = interpreter && interpreter.version ? interpreter.version.raw : undefined;
        const interpreterType = interpreter ? interpreter.type : undefined;
        const hasUserDefinedInterpreter = hasUserDefinedPythonPath(mainWorkspaceUri, serviceContainer);
        const preferredWorkspaceInterpreter = getPreferredWorkspaceInterpreter(mainWorkspaceUri, serviceContainer);
        const isAutoSelectedWorkspaceInterpreterUsed = preferredWorkspaceInterpreter ? settings.pythonPath === getPreferredWorkspaceInterpreter(mainWorkspaceUri, serviceContainer) : undefined;
        const hasPython3 = interpreters
            .filter(item => item && item.version ? item.version.major === 3 : false)
            .length > 0;

        const props = {
            condaVersion, terminal: terminalShellType, pythonVersion, interpreterType, workspaceFolderCount, hasPython3,
            hasUserDefinedInterpreter, isAutoSelectedWorkspaceInterpreterUsed
        };
        sendTelemetryEvent(EDITOR_LOAD, durations, props);
    } catch (ex) {
        logger.logError('sendStartupTelemetry failed.', ex);
    }
}
function hasUserDefinedPythonPath(resource: Resource, serviceContainer: IServiceContainer) {
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const settings = workspaceService.getConfiguration('python', resource)!.inspect<string>('pyhontPath')!;
    return (settings.workspaceFolderValue && settings.workspaceFolderValue !== 'python') ||
        (settings.workspaceValue && settings.workspaceValue !== 'python') ||
        (settings.globalValue && settings.globalValue !== 'python');
}
function getPreferredWorkspaceInterpreter(resource: Resource, serviceContainer: IServiceContainer) {
    const workspaceInterpreterSelector = serviceContainer.get<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, AutoSelectionRule.workspaceVirtualEnvs);
    const interpreter = workspaceInterpreterSelector.getPreviouslyAutoSelectedInterpreter(resource);
    return interpreter ? interpreter.path : undefined;
}
