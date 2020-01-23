'use strict';
// tslint:disable:no-var-requires no-require-imports

// This line should always be right on top.
// tslint:disable:no-any
if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

// Initialize source maps (this must never be moved up nor further down).
import { initialize } from './sourceMapSupport';
initialize(require('vscode'));
// Initialize the logger first.
require('./common/logger');

const durations: Record<string, number> = {};
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
    languages,
    Memento,
    OutputChannel,
    ProgressLocation,
    ProgressOptions,
    window
} from 'vscode';

import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry';
import { IExtensionActivationManager, ILanguageServerExtension } from './activation/types';
import { buildApi, IExtensionApi } from './api';
import { registerTypes as appRegisterTypes } from './application/serviceRegistry';
import { IApplicationDiagnostics } from './application/types';
import { DebugService } from './common/application/debugService';
import { IApplicationShell, ICommandManager, IWorkspaceService } from './common/application/types';
import { Commands, isTestExecution, PYTHON, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from './common/constants';
import { registerTypes as registerDotNetTypes } from './common/dotnet/serviceRegistry';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { traceError } from './common/logger';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import { ITerminalHelper } from './common/terminal/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IExtensionContext,
    IFeatureDeprecationManager,
    IMemento,
    IOutputChannel,
    Resource,
    WORKSPACE_MEMENTO
} from './common/types';
import { createDeferred } from './common/utils/async';
import { Common, OutputChannelNames } from './common/utils/localize';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { JUPYTER_OUTPUT_CHANNEL } from './datascience/constants';
import { registerTypes as dataScienceRegisterTypes } from './datascience/serviceRegistry';
import { IDataScience } from './datascience/types';
import { DebuggerTypeName } from './debugger/constants';
import { DebugSessionEventDispatcher } from './debugger/extension/hooks/eventHandlerDispatcher';
import { IDebugSessionEventHandlers } from './debugger/extension/hooks/types';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/extension/serviceRegistry';
import { IDebugAdapterDescriptorFactory, IDebugConfigurationService, IDebuggerBanner } from './debugger/extension/types';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import { AutoSelectionRule, IInterpreterAutoSelectionRule, IInterpreterAutoSelectionService } from './interpreter/autoSelection/types';
import { IInterpreterSelector } from './interpreter/configuration/types';
import { ICondaService, IInterpreterLocatorProgressHandler, IInterpreterLocatorProgressService, IInterpreterService, PythonInterpreter } from './interpreter/contracts';
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer, IServiceManager } from './ioc/types';
import { getLanguageConfiguration } from './language/languageConfiguration';
import { LinterCommands } from './linters/linterCommands';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { PythonCodeActionProvider } from './providers/codeActionsProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { ReplProvider } from './providers/replProvider';
import { registerTypes as providersRegisterTypes } from './providers/serviceRegistry';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { ISortImportsEditingProvider } from './providers/types';
import { sendTelemetryEvent } from './telemetry';
import { EventName } from './telemetry/constants';
import { EditorLoadTelemetry, IImportTracker } from './telemetry/types';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { ICodeExecutionManager, ITerminalAutoActivation } from './terminals/types';
import { TEST_OUTPUT_CHANNEL } from './testing/common/constants';
import { ITestContextService } from './testing/common/types';
import { ITestCodeNavigatorCommandHandler, ITestExplorerCommandHandler } from './testing/navigation/types';
import { registerTypes as unitTestsRegisterTypes } from './testing/serviceRegistry';

durations.codeLoadingTime = stopWatch.elapsedTime;
const activationDeferred = createDeferred<void>();
let activatedServiceContainer: ServiceContainer | undefined;

export async function activate(context: ExtensionContext): Promise<IExtensionApi> {
    try {
        return await activateUnsafe(context);
    } catch (ex) {
        handleError(ex);
        throw ex; // re-raise
    }
}

// tslint:disable-next-line:max-func-body-length
async function activateUnsafe(context: ExtensionContext): Promise<IExtensionApi> {
    displayProgress(activationDeferred.promise);
    durations.startActivateTime = stopWatch.elapsedTime;
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    activatedServiceContainer = serviceContainer;
    registerServices(context, serviceManager, serviceContainer);
    await initializeServices(context, serviceManager, serviceContainer);

    const manager = serviceContainer.get<IExtensionActivationManager>(IExtensionActivationManager);
    context.subscriptions.push(manager);
    const activationPromise = manager.activate();

    serviceManager.get<ITerminalAutoActivation>(ITerminalAutoActivation).register();
    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    const pythonSettings = configuration.getSettings();

    const standardOutputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceContainer);

    const sortImports = serviceContainer.get<ISortImportsEditingProvider>(ISortImportsEditingProvider);
    sortImports.registerCommands();

    serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();

    if (!isTestExecution()) {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Move this down to right before durations.endActivateTime is set.
        sendStartupTelemetry(Promise.all([activationDeferred.promise, activationPromise]), serviceContainer).ignoreErrors();
    }

    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    interpreterManager
        .refresh(workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders![0].uri : undefined)
        .catch(ex => traceError('Python Extension: interpreterManager.refresh', ex));

    // Activate data science features
    const dataScience = serviceManager.get<IDataScience>(IDataScience);
    dataScience.activate().ignoreErrors();

    // Activate import tracking
    const importTracker = serviceManager.get<IImportTracker>(IImportTracker);
    importTracker.activate().ignoreErrors();

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
    await terminalProvider.initialize(window.activeTerminal);
    context.subscriptions.push(terminalProvider);

    context.subscriptions.push(languages.registerCodeActionsProvider(PYTHON, new PythonCodeActionProvider(), { providedCodeActionKinds: [CodeActionKind.SourceOrganizeImports] }));

    serviceContainer.getAll<DebugConfigurationProvider>(IDebugConfigurationService).forEach(debugConfigProvider => {
        context.subscriptions.push(debug.registerDebugConfigurationProvider(DebuggerTypeName, debugConfigProvider));
    });

    serviceContainer.get<IDebuggerBanner>(IDebuggerBanner).initialize();
    durations.endActivateTime = stopWatch.elapsedTime;
    activationDeferred.resolve();

    const api = buildApi(
        Promise.all([activationDeferred.promise, activationPromise]),
        serviceContainer.get<IExperimentsManager>(IExperimentsManager),
        serviceContainer.get<IDebugAdapterDescriptorFactory>(IDebugAdapterDescriptorFactory)
    );
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

    const standardOutputChannel = window.createOutputChannel(OutputChannelNames.python());
    const unitTestOutChannel = window.createOutputChannel(OutputChannelNames.pythonTest());
    const jupyterOutputChannel = window.createOutputChannel(OutputChannelNames.jupyter());
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, jupyterOutputChannel, JUPYTER_OUTPUT_CHANNEL);

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

async function initializeServices(context: ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
    const abExperiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    await abExperiments.activate();
    const selector = serviceContainer.get<IInterpreterSelector>(IInterpreterSelector);
    selector.initialize();
    context.subscriptions.push(selector);

    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    interpreterManager.initialize();

    const handlers = serviceManager.getAll<IDebugSessionEventHandlers>(IDebugSessionEventHandlers);
    const disposables = serviceManager.get<IDisposableRegistry>(IDisposableRegistry);
    const dispatcher = new DebugSessionEventDispatcher(handlers, DebugService.instance, disposables);
    dispatcher.registerEventHandlers();

    const cmdManager = serviceContainer.get<ICommandManager>(ICommandManager);
    const outputChannel = serviceManager.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    disposables.push(cmdManager.registerCommand(Commands.ViewOutput, () => outputChannel.show()));

    // Display progress of interpreter refreshes only after extension has activated.
    serviceContainer.get<IInterpreterLocatorProgressHandler>(IInterpreterLocatorProgressHandler).register();
    serviceContainer.get<IInterpreterLocatorProgressService>(IInterpreterLocatorProgressService).register();
    serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics).register();
    serviceContainer.get<ITestCodeNavigatorCommandHandler>(ITestCodeNavigatorCommandHandler).register();
    serviceContainer.get<ITestExplorerCommandHandler>(ITestExplorerCommandHandler).register();
    serviceContainer.get<ILanguageServerExtension>(ILanguageServerExtension).register();
    serviceContainer.get<ITestContextService>(ITestContextService).register();
}

// tslint:disable-next-line:no-any
async function sendStartupTelemetry(activatedPromise: Promise<any>, serviceContainer: IServiceContainer) {
    try {
        await activatedPromise;
        durations.totalActivateTime = stopWatch.elapsedTime;
        const props = await getActivationTelemetryProps(serviceContainer);
        sendTelemetryEvent(EventName.EDITOR_LOAD, durations, props);
    } catch (ex) {
        traceError('sendStartupTelemetry() failed.', ex);
    }
}
function isUsingGlobalInterpreterInWorkspace(currentPythonPath: string, serviceContainer: IServiceContainer): boolean {
    const service = serviceContainer.get<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService);
    const globalInterpreter = service.getAutoSelectedInterpreter(undefined);
    if (!globalInterpreter) {
        return false;
    }
    return currentPythonPath === globalInterpreter.path;
}
function hasUserDefinedPythonPath(resource: Resource, serviceContainer: IServiceContainer) {
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const settings = workspaceService.getConfiguration('python', resource)!.inspect<string>('pythonPath')!;
    return (settings.workspaceFolderValue && settings.workspaceFolderValue !== 'python') ||
        (settings.workspaceValue && settings.workspaceValue !== 'python') ||
        (settings.globalValue && settings.globalValue !== 'python')
        ? true
        : false;
}

function getPreferredWorkspaceInterpreter(resource: Resource, serviceContainer: IServiceContainer) {
    const workspaceInterpreterSelector = serviceContainer.get<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, AutoSelectionRule.workspaceVirtualEnvs);
    const interpreter = workspaceInterpreterSelector.getPreviouslyAutoSelectedInterpreter(resource);
    return interpreter ? interpreter.path : undefined;
}

/////////////////////////////
// telemetry

// tslint:disable-next-line:no-any
async function getActivationTelemetryProps(serviceContainer: IServiceContainer): Promise<EditorLoadTelemetry> {
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Not all of this data is showing up in the database...
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: If any one of these parts fails we send no info.  We should
    // be able to partially populate as much as possible instead
    // (through granular try-catch statements).
    const terminalHelper = serviceContainer.get<ITerminalHelper>(ITerminalHelper);
    const terminalShellType = terminalHelper.identifyTerminalShell();
    const condaLocator = serviceContainer.get<ICondaService>(ICondaService);
    const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
    const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    const configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    const mainWorkspaceUri = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders![0].uri : undefined;
    const settings = configurationService.getSettings(mainWorkspaceUri);
    const [condaVersion, interpreter, interpreters] = await Promise.all([
        condaLocator
            .getCondaVersion()
            .then(ver => (ver ? ver.raw : ''))
            .catch<string>(() => ''),
        interpreterService.getActiveInterpreter().catch<PythonInterpreter | undefined>(() => undefined),
        interpreterService.getInterpreters(mainWorkspaceUri).catch<PythonInterpreter[]>(() => [])
    ]);
    const workspaceFolderCount = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders!.length : 0;
    const pythonVersion = interpreter && interpreter.version ? interpreter.version.raw : undefined;
    const interpreterType = interpreter ? interpreter.type : undefined;
    const usingUserDefinedInterpreter = hasUserDefinedPythonPath(mainWorkspaceUri, serviceContainer);
    const preferredWorkspaceInterpreter = getPreferredWorkspaceInterpreter(mainWorkspaceUri, serviceContainer);
    const usingGlobalInterpreter = isUsingGlobalInterpreterInWorkspace(settings.pythonPath, serviceContainer);
    const usingAutoSelectedWorkspaceInterpreter = preferredWorkspaceInterpreter
        ? settings.pythonPath === getPreferredWorkspaceInterpreter(mainWorkspaceUri, serviceContainer)
        : false;
    const hasPython3 = interpreters!.filter(item => (item && item.version ? item.version.major === 3 : false)).length > 0;

    return {
        condaVersion,
        terminal: terminalShellType,
        pythonVersion,
        interpreterType,
        workspaceFolderCount,
        hasPython3,
        usingUserDefinedInterpreter,
        usingAutoSelectedWorkspaceInterpreter,
        usingGlobalInterpreter
    };
}

/////////////////////////////
// error handling

function handleError(ex: Error) {
    notifyUser("Extension activation failed, run the 'Developer: Toggle Developer Tools' command for more information.");
    traceError('extension activation failed', ex);
    sendErrorTelemetry(ex).ignoreErrors();
}

interface IAppShell {
    showErrorMessage(string: string): Promise<void>;
}

function notifyUser(msg: string) {
    try {
        // tslint:disable-next-line:no-any
        let appShell: IAppShell = (window as any) as IAppShell;
        if (activatedServiceContainer) {
            // tslint:disable-next-line:no-any
            appShell = (activatedServiceContainer.get<IApplicationShell>(IApplicationShell) as any) as IAppShell;
        }
        appShell.showErrorMessage(msg).ignoreErrors();
    } catch (ex) {
        // ignore
    }
}

async function sendErrorTelemetry(ex: Error) {
    try {
        // tslint:disable-next-line:no-any
        let props: any = {};
        if (activatedServiceContainer) {
            try {
                props = await getActivationTelemetryProps(activatedServiceContainer);
            } catch (ex) {
                // ignore
            }
        }
        sendTelemetryEvent(EventName.EDITOR_LOAD, durations, props, ex);
    } catch (exc2) {
        traceError('sendErrorTelemetry() failed.', exc2);
    }
}
