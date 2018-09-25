'use strict';
// This line should always be right on top.
// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}
import { StopWatch } from '../utils/stopWatch';
// Do not move this linne of code (used to measure extension load times).
const stopWatch = new StopWatch();

import { Container } from 'inversify';
import { CodeActionKind, debug, Disposable, ExtensionContext, extensions, IndentAction, languages, Memento, OutputChannel, window } from 'vscode';
import { createDeferred } from '../utils/async';
import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry';
import { IExtensionActivationService } from './activation/types';
import { IExtensionApi } from './api';
import { registerTypes as appRegisterTypes } from './application/serviceRegistry';
import { IApplicationDiagnostics } from './application/types';
import { IWorkspaceService } from './common/application/types';
import { isTestExecution, PYTHON, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from './common/constants';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import { ITerminalHelper } from './common/terminal/types';
import {
    GLOBAL_MEMENTO, IConfigurationService, IDisposableRegistry,
    IExtensionContext, IFeatureDeprecationManager, ILogger,
    IMemento, IOutputChannel, WORKSPACE_MEMENTO
} from './common/types';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { registerTypes as dataScienceRegisterTypes } from './datascience/serviceRegistry';
import { IDataScience } from './datascience/types';
import { AttachRequestArguments, LaunchRequestArguments } from './debugger/Common/Contracts';
import { BaseConfigurationProvider } from './debugger/configProviders/baseProvider';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/configProviders/serviceRegistry';
import { registerTypes as debuggerRegisterTypes } from './debugger/serviceRegistry';
import { IDebugConfigurationProvider, IDebuggerBanner } from './debugger/types';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import { IInterpreterSelector } from './interpreter/configuration/types';
import { ICondaService, IInterpreterService, PythonInterpreter } from './interpreter/contracts';
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
import { BlockFormatProviders } from './typeFormatters/blockFormatProvider';
import { OnEnterFormatter } from './typeFormatters/onEnterFormatter';
import { TEST_OUTPUT_CHANNEL } from './unittests/common/constants';
import { registerTypes as unitTestsRegisterTypes } from './unittests/serviceRegistry';

const activationDeferred = createDeferred<void>();

// tslint:disable-next-line:max-func-body-length
export async function activate(context: ExtensionContext): Promise<IExtensionApi> {
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    registerServices(context, serviceManager, serviceContainer);
    initializeServices(context, serviceManager, serviceContainer);

    // When testing, do not perform health checks, as modal dialogs can be displayed.
    if (!isTestExecution()) {
        const appDiagnostics = serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics);
        await appDiagnostics.performPreStartupHealthCheck();
    }

    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    await interpreterManager.autoSetInterpreter();

    serviceManager.get<ITerminalAutoActivation>(ITerminalAutoActivation).register();
    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    const pythonSettings = configuration.getSettings();

    const standardOutputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceContainer);

    const activationService = serviceContainer.get<IExtensionActivationService>(IExtensionActivationService);
    await activationService.activate();

    const sortImports = serviceContainer.get<ISortImportsEditingProvider>(ISortImportsEditingProvider);
    sortImports.registerCommands();

    serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();
    sendStartupTelemetry(activationDeferred.promise, serviceContainer).ignoreErrors();

    interpreterManager.refresh()
        .catch(ex => console.error('Python Extension: interpreterManager.refresh', ex));

    const jupyterExtension = extensions.getExtension('donjayamanne.jupyter');
    const lintingEngine = serviceManager.get<ILintingEngine>(ILintingEngine);
    lintingEngine.linkJupiterExtension(jupyterExtension).ignoreErrors();

    // Activate the data science features
    const dataScience = serviceManager.get<IDataScience>(IDataScience);
    await dataScience.activate();

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

    context.subscriptions.push(languages.registerOnTypeFormattingEditProvider(PYTHON, new BlockFormatProviders(), ':'));
    context.subscriptions.push(languages.registerOnTypeFormattingEditProvider(PYTHON, new OnEnterFormatter(), '\n'));

    const deprecationMgr = serviceContainer.get<IFeatureDeprecationManager>(IFeatureDeprecationManager);
    deprecationMgr.initialize();
    context.subscriptions.push(deprecationMgr);

    context.subscriptions.push(activateUpdateSparkLibraryProvider());

    context.subscriptions.push(new ReplProvider(serviceContainer));
    context.subscriptions.push(new TerminalProvider(serviceContainer));

    context.subscriptions.push(languages.registerCodeActionsProvider(PYTHON, new PythonCodeActionProvider(), { providedCodeActionKinds: [CodeActionKind.SourceOrganizeImports] }));

    type ConfigurationProvider = BaseConfigurationProvider<LaunchRequestArguments, AttachRequestArguments>;
    serviceContainer.getAll<ConfigurationProvider>(IDebugConfigurationProvider).forEach(debugConfig => {
        context.subscriptions.push(debug.registerDebugConfigurationProvider(debugConfig.debugType, debugConfig));
    });

    serviceContainer.get<IDebuggerBanner>(IDebuggerBanner).initialize();
    activationDeferred.resolve();

    return { ready: activationDeferred.promise };
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
    debuggerRegisterTypes(serviceManager);
    appRegisterTypes(serviceManager);
    providersRegisterTypes(serviceManager);
}

function initializeServices(context: ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
    const selector = serviceContainer.get<IInterpreterSelector>(IInterpreterSelector);
    selector.initialize();
    context.subscriptions.push(selector);

    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    interpreterManager.initialize();
}

async function sendStartupTelemetry(activatedPromise: Promise<void>, serviceContainer: IServiceContainer) {
    const logger = serviceContainer.get<ILogger>(ILogger);
    try {
        await activatedPromise;
        const terminalHelper = serviceContainer.get<ITerminalHelper>(ITerminalHelper);
        const terminalShellType = terminalHelper.identifyTerminalShell(terminalHelper.getTerminalShellPath());
        const duration = stopWatch.elapsedTime;
        const condaLocator = serviceContainer.get<ICondaService>(ICondaService);
        const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
        const [condaVersion, interpreter, interpreters] = await Promise.all([
            condaLocator.getCondaVersion().catch(() => undefined),
            interpreterService.getActiveInterpreter().catch<PythonInterpreter | undefined>(() => undefined),
            interpreterService.getInterpreters().catch<PythonInterpreter[]>(() => [])
        ]);
        const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const workspaceFolderCount = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders!.length : 0;
        const pythonVersion = interpreter ? interpreter.version_info.join('.') : undefined;
        const interpreterType = interpreter ? interpreter.type : undefined;
        const hasPython3 = interpreters
            .filter(item => item && Array.isArray(item.version_info) ? item.version_info[0] === 3 : false)
            .length > 0;

        const props = { condaVersion, terminal: terminalShellType, pythonVersion, interpreterType, workspaceFolderCount, hasPython3 };
        sendTelemetryEvent(EDITOR_LOAD, duration, props);
    } catch (ex) {
        logger.logError('sendStartupTelemetry failed.', ex);
    }
}
