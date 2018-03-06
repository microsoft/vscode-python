'use strict';
// This line should always be right on top.
// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}
import { Container } from 'inversify';
import * as path from 'path';
import { Disposable, Memento, OutputChannel, window } from 'vscode';
import * as vscode from 'vscode';
import * as languageClient from 'vscode-languageclient';
import * as settings from './common/configSettings';
import { PythonSettings } from './common/configSettings';
import { STANDARD_OUTPUT_CHANNEL } from './common/constants';
import { FeatureDeprecationManager } from './common/featureDeprecationManager';
import { createDeferred } from './common/helpers';
import { PythonInstaller } from './common/installer/pythonInstallation';
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry';
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import { GLOBAL_MEMENTO, IConfigurationService, IDisposableRegistry, ILogger, IMemento, IOutputChannel, IPersistentStateFactory, IPythonSettings, WORKSPACE_MEMENTO } from './common/types';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { BaseConfigurationProvider } from './debugger/configProviders/baseProvider';
import { registerTypes as debugConfigurationRegisterTypes } from './debugger/configProviders/serviceRegistry';
import { IDebugConfigurationProvider } from './debugger/types';
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry';
import { IInterpreterSelector } from './interpreter/configuration/types';
import { ICondaService, IInterpreterService, IShebangCodeLensProvider } from './interpreter/contracts';
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer } from './ioc/types';
import { JediFactory } from './languageServices/jediProxyFactory';
import { LinterCommands } from './linters/linterCommands';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { ILintingEngine } from './linters/types';
import { PythonCompletionItemProvider } from './providers/completionProvider';
import { PythonDefinitionProvider } from './providers/definitionProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { PythonHoverProvider } from './providers/hoverProvider';
import { LinterProvider } from './providers/linterProvider';
import { activateGoToObjectDefinitionProvider } from './providers/objectDefinitionProvider';
import { PythonReferenceProvider } from './providers/referenceProvider';
import { PythonRenameProvider } from './providers/renameProvider';
import { ReplProvider } from './providers/replProvider';
import { PythonSignatureProvider } from './providers/signatureProvider';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { PythonSymbolProvider } from './providers/symbolProvider';
import { TerminalProvider } from './providers/terminalProvider';
import { activateUpdateSparkLibraryProvider } from './providers/updateSparkLibraryProvider';
import * as sortImports from './sortImports';
import { sendTelemetryEvent } from './telemetry';
import { EDITOR_LOAD } from './telemetry/constants';
import { StopWatch } from './telemetry/stopWatch';
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry';
import { ICodeExecutionManager } from './terminals/types';
import { BlockFormatProviders } from './typeFormatters/blockFormatProvider';
import { OnEnterFormatter } from './typeFormatters/onEnterFormatter';
import { TEST_OUTPUT_CHANNEL } from './unittests/common/constants';
import * as tests from './unittests/main';
import { registerTypes as unitTestsRegisterTypes } from './unittests/serviceRegistry';
import { WorkspaceSymbols } from './workspaceSymbols/main';

const PYTHON: vscode.DocumentFilter = { language: 'python' };
const activationDeferred = createDeferred<void>();
let languageClent: languageClient.LanguageClient;
export const activated = activationDeferred.promise;

// tslint:disable-next-line:max-func-body-length
export async function activate(context: vscode.ExtensionContext) {
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    registerServices(context, serviceManager, serviceContainer);

    const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
    // This must be completed before we can continue as language server needs the interpreter path.
    interpreterManager.initialize();
    await interpreterManager.autoSetInterpreter();

    const configuration = serviceManager.get<IConfigurationService>(IConfigurationService);
    const pythonSettings = configuration.getSettings();
    if (pythonSettings.usePtvs) {
        await activatePtvsLanguageServer(context, serviceContainer, pythonSettings);
    } else {
        activateClassicLanguageSupport(context, serviceManager, pythonSettings);
    }

    serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands();
    // tslint:disable-next-line:no-floating-promises
    sendStartupTelemetry(activated, serviceContainer);

    const pythonInstaller = new PythonInstaller(serviceContainer);
    pythonInstaller.checkPythonInstallation(PythonSettings.getInstance())
        .catch(ex => console.error('Python Extension: pythonInstaller.checkPythonInstallation', ex));

    interpreterManager.refresh()
        .catch(ex => console.error('Python Extension: interpreterManager.refresh', ex));

    context.subscriptions.push(serviceContainer.get<IInterpreterSelector>(IInterpreterSelector));
    context.subscriptions.push(activateUpdateSparkLibraryProvider());

    context.subscriptions.push(new ReplProvider(serviceContainer));
    context.subscriptions.push(new TerminalProvider(serviceContainer));

    serviceContainer.getAll<BaseConfigurationProvider>(IDebugConfigurationProvider).forEach(debugConfig => {
        context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(debugConfig.debugType, debugConfig));
    });
    activationDeferred.resolve();
}

function registerServices(context: vscode.ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, context.subscriptions);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO);

    const standardOutputChannel = window.createOutputChannel('Python');
    const unitTestOutChannel = window.createOutputChannel('Python Test Log');
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL);

    const pythonSettings = settings.PythonSettings.getInstance();

    commonRegisterTypes(serviceManager);
    processRegisterTypes(serviceManager);
    variableRegisterTypes(serviceManager);
    unitTestsRegisterTypes(serviceManager);
    interpretersRegisterTypes(serviceManager);
    platformRegisterTypes(serviceManager);
    installerRegisterTypes(serviceManager);
    commonRegisterTerminalTypes(serviceManager);
    debugConfigurationRegisterTypes(serviceManager);
}

async function activateClassicLanguageSupport(context: vscode.ExtensionContext, serviceManager: ServiceManager, pythonSettings: IPythonSettings) {
    lintersRegisterTypes(serviceManager);
    formattersRegisterTypes(serviceManager);

    const standardOutputChannel = serviceManager.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    sortImports.activate(context, standardOutputChannel, serviceManager);

    activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceManager);
    const jediFactory = new JediFactory(context.asAbsolutePath('.'), serviceManager);
    context.subscriptions.push(...activateGoToObjectDefinitionProvider(jediFactory));
    context.subscriptions.push(new LinterCommands(serviceManager));

    // Enable indentAction
    // tslint:disable-next-line:no-non-null-assertion
    vscode.languages.setLanguageConfiguration(PYTHON.language!, {
        onEnterRules: [
            {
                beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async)\b.*/,
                action: { indentAction: vscode.IndentAction.Indent }
            },
            {
                beforeText: /^\s*#.*/,
                afterText: /.+$/,
                action: { indentAction: vscode.IndentAction.None, appendText: '# ' }
            },
            {
                beforeText: /^\s+(continue|break|return)\b.*/,
                afterText: /\s+$/,
                action: { indentAction: vscode.IndentAction.Outdent }
            }
        ]
    });

    context.subscriptions.push(jediFactory);
    context.subscriptions.push(vscode.languages.registerRenameProvider(PYTHON, new PythonRenameProvider(serviceManager)));
    const definitionProvider = new PythonDefinitionProvider(jediFactory);
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(PYTHON, definitionProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(PYTHON, new PythonHoverProvider(jediFactory)));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(PYTHON, new PythonReferenceProvider(jediFactory)));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(PYTHON, new PythonCompletionItemProvider(jediFactory, serviceManager), '.'));
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(PYTHON, serviceManager.get<IShebangCodeLensProvider>(IShebangCodeLensProvider)));

    const symbolProvider = new PythonSymbolProvider(jediFactory);
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(PYTHON, symbolProvider));

    if (pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
        context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(PYTHON, new PythonSignatureProvider(jediFactory), '(', ','));
    }
    if (pythonSettings.formatting.provider !== 'none') {
        const formatProvider = new PythonFormattingEditProvider(context, serviceManager);
        context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
    }

    const linterProvider = new LinterProvider(context, serviceManager);
    context.subscriptions.push(linterProvider);

    const jupyterExtension = vscode.extensions.getExtension('donjayamanne.jupyter');
    const lintingEngine = serviceManager.get<ILintingEngine>(ILintingEngine);
    lintingEngine.linkJupiterExtension(jupyterExtension).ignoreErrors();

    const unitTestOutChannel = serviceManager.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
    tests.activate(context, unitTestOutChannel, symbolProvider, serviceManager);

    context.subscriptions.push(new WorkspaceSymbols(serviceManager));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new BlockFormatProviders(), ':'));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new OnEnterFormatter(), '\n'));

    const persistentStateFactory = serviceManager.get<IPersistentStateFactory>(IPersistentStateFactory);
    const deprecationMgr = new FeatureDeprecationManager(persistentStateFactory, !!jupyterExtension);
    deprecationMgr.initialize();
    context.subscriptions.push(new FeatureDeprecationManager(persistentStateFactory, !!jupyterExtension));
}

async function activatePtvsLanguageServer(context: vscode.ExtensionContext, services: IServiceContainer, pythonSettings: IPythonSettings) {
    const configuration = services.get<IConfigurationService>(IConfigurationService);
    if (! await configuration.checkDependencies()) {
        throw new Error('.NET Runtime is not installed.');
    }

    // The server is implemented in C#
    const commandOptions = { stdio: 'pipe' };
    const serverModule = path.join(context.extensionPath, 'ptvs', 'Microsoft.PythonTools.VsCode.dll');

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: languageClient.ServerOptions = {
        run: { command: 'dotnet', args: [serverModule], options: commandOptions },
        debug: { command: 'dotnet', args: [serverModule, '--debug'], options: commandOptions }
    };

    // Options to control the language client
    const clientOptions: languageClient.LanguageClientOptions = {
        // Register the server for Python documents
        documentSelector: [PYTHON.language],
        synchronize: {
            configurationSection: PYTHON.language
        }
    };

    // Create the language client and start the client.
    languageClent = new languageClient.LanguageClient(PYTHON.language, 'Python Tools', serverOptions, clientOptions);
    context.subscriptions.push(languageClent.start());

    await languageClent.onReady();
}

export async function deactivate() {
    if (languageClent) {
        await languageClent.stop();
    }
}

async function sendStartupTelemetry(activatedPromise: Promise<void>, serviceContainer: IServiceContainer) {
    const stopWatch = new StopWatch();
    const logger = serviceContainer.get<ILogger>(ILogger);
    try {
        await activatedPromise;
        const duration = stopWatch.elapsedTime;
        const condaLocator = serviceContainer.get<ICondaService>(ICondaService);
        const condaVersion = await condaLocator.getCondaVersion().catch(() => undefined);
        const props = condaVersion ? { condaVersion } : undefined;
        sendTelemetryEvent(EDITOR_LOAD, duration, props);
    } catch (ex) {
        logger.logError('sendStartupTelemetry failed.', ex);
    }
}
