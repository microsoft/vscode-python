'use strict';
import { Container } from 'inversify';
import * as os from 'os';
import * as vscode from 'vscode';
import { Disposable, Memento, OutputChannel, window } from 'vscode';
import { BannerService } from './banner';
import * as settings from './common/configSettings';
import { STANDARD_OUTPUT_CHANNEL } from './common/constants';
import { FeatureDeprecationManager } from './common/featureDeprecationManager';
import { createDeferred } from './common/helpers';
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry';
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry';
import { GLOBAL_MEMENTO, IDiposableRegistry, IMemento, IOutputChannel, IPersistentStateFactory, WORKSPACE_MEMENTO } from './common/types';
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry';
import { SimpleConfigurationProvider } from './debugger';
import { InterpreterManager } from './interpreter';
import { SetInterpreterProvider } from './interpreter/configuration/setInterpreterProvider';
import { ShebangCodeLensProvider } from './interpreter/display/shebangCodeLensProvider';
import { getCondaVersion } from './interpreter/helpers';
import { InterpreterVersionService } from './interpreter/interpreterVersion';
import { ServiceContainer } from './ioc/container';
import { ServiceManager } from './ioc/serviceManager';
import { IServiceContainer } from './ioc/types';
import { JupyterProvider } from './jupyter/provider';
import { JediFactory } from './languageServices/jediProxyFactory';
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry';
import { PythonCompletionItemProvider } from './providers/completionProvider';
import { PythonDefinitionProvider } from './providers/definitionProvider';
import { activateExecInTerminalProvider } from './providers/execInTerminalProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { PythonHoverProvider } from './providers/hoverProvider';
import { LintProvider } from './providers/lintProvider';
import { activateGoToObjectDefinitionProvider } from './providers/objectDefinitionProvider';
import { PythonReferenceProvider } from './providers/referenceProvider';
import { PythonRenameProvider } from './providers/renameProvider';
import { ReplProvider } from './providers/replProvider';
import { PythonSignatureProvider } from './providers/signatureProvider';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { PythonSymbolProvider } from './providers/symbolProvider';
import { activateUpdateSparkLibraryProvider } from './providers/updateSparkLibraryProvider';
import * as sortImports from './sortImports';
import { sendTelemetryEvent } from './telemetry';
import { EDITOR_LOAD } from './telemetry/constants';
import { StopWatch } from './telemetry/stopWatch';
import { BlockFormatProviders } from './typeFormatters/blockFormatProvider';
import { TEST_OUTPUT_CHANNEL } from './unittests/common/constants';
import * as tests from './unittests/main';
import { registerTypes as unitTestsRegisterTypes } from './unittests/serviceRegistry';
import { WorkspaceSymbols } from './workspaceSymbols/main';

const PYTHON: vscode.DocumentFilter = { language: 'python' };
const activationDeferred = createDeferred<void>();
export const activated = activationDeferred.promise;

let cont: Container;
let serviceManager: ServiceManager;
let serviceContainer: ServiceContainer;

// tslint:disable-next-line:max-func-body-length
export async function activate(context: vscode.ExtensionContext) {
    cont = new Container();
    serviceManager = new ServiceManager(cont);
    serviceContainer = new ServiceContainer(cont);
    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    serviceManager.addSingletonInstance<Disposable[]>(IDiposableRegistry, context.subscriptions);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO);
    serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO);

    const standardOutputChannel = window.createOutputChannel('Python');
    const unitTestOutChannel = window.createOutputChannel('Python Test Log');
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL);
    serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL);

    commonRegisterTypes(serviceManager);
    processRegisterTypes(serviceManager);
    variableRegisterTypes(serviceManager);
    unitTestsRegisterTypes(serviceManager);
    lintersRegisterTypes(serviceManager);

    const persistentStateFactory = serviceManager.get<IPersistentStateFactory>(IPersistentStateFactory);
    const pythonSettings = settings.PythonSettings.getInstance();
    sendStartupTelemetry(activated);

    sortImports.activate(context, standardOutputChannel);
    const interpreterManager = new InterpreterManager();
    await interpreterManager.autoSetInterpreter();
    interpreterManager.refresh()
        .catch(ex => console.error('Python Extension: interpreterManager.refresh', ex));
    context.subscriptions.push(interpreterManager);
    const interpreterVersionService = new InterpreterVersionService();
    context.subscriptions.push(new SetInterpreterProvider(interpreterManager, interpreterVersionService));
    context.subscriptions.push(...activateExecInTerminalProvider());
    context.subscriptions.push(activateUpdateSparkLibraryProvider());
    activateSimplePythonRefactorProvider(context, standardOutputChannel);
    const jediFactory = new JediFactory(context.asAbsolutePath('.'));
    context.subscriptions.push(...activateGoToObjectDefinitionProvider(jediFactory));

    context.subscriptions.push(new ReplProvider());

    // Enable indentAction
    // tslint:disable-next-line:no-non-null-assertion
    vscode.languages.setLanguageConfiguration(PYTHON.language!, {
        onEnterRules: [
            {
                beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async).*?:\s*$/,
                action: { indentAction: vscode.IndentAction.Indent }
            },
            {
                beforeText: /^ *#.*$/,
                afterText: /.+$/,
                action: { indentAction: vscode.IndentAction.None, appendText: '# ' }
            },
            {
                beforeText: /^\s+(continue|break|return)\b.*$/,
                action: { indentAction: vscode.IndentAction.Outdent }
            }
        ]
    });

    context.subscriptions.push(jediFactory);
    context.subscriptions.push(vscode.languages.registerRenameProvider(PYTHON, new PythonRenameProvider(standardOutputChannel)));
    const definitionProvider = new PythonDefinitionProvider(jediFactory);
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(PYTHON, definitionProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(PYTHON, new PythonHoverProvider(jediFactory)));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(PYTHON, new PythonReferenceProvider(jediFactory)));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(PYTHON, new PythonCompletionItemProvider(jediFactory), '.'));
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(PYTHON, new ShebangCodeLensProvider()));

    const symbolProvider = new PythonSymbolProvider(jediFactory);
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(PYTHON, symbolProvider));
    if (pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
        context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(PYTHON, new PythonSignatureProvider(jediFactory), '(', ','));
    }
    if (pythonSettings.formatting.provider !== 'none') {
        const formatProvider = new PythonFormattingEditProvider(context, standardOutputChannel);
        context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
    }

    // tslint:disable-next-line:promise-function-async
    const linterProvider = new LintProvider(context, standardOutputChannel, (a, b) => Promise.resolve(false), serviceContainer);
    context.subscriptions.push(linterProvider);
    const jupyterExtInstalled = vscode.extensions.getExtension('donjayamanne.jupyter');
    if (jupyterExtInstalled) {
        if (jupyterExtInstalled.isActive) {
            // tslint:disable-next-line:no-unsafe-any
            jupyterExtInstalled.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider());
            // tslint:disable-next-line:no-unsafe-any
            linterProvider.documentHasJupyterCodeCells = jupyterExtInstalled.exports.hasCodeCells;
        }

        jupyterExtInstalled.activate().then(() => {
            // tslint:disable-next-line:no-unsafe-any
            jupyterExtInstalled.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider());
            // tslint:disable-next-line:no-unsafe-any
            linterProvider.documentHasJupyterCodeCells = jupyterExtInstalled.exports.hasCodeCells;
        });
    }
    tests.activate(context, unitTestOutChannel, symbolProvider, serviceContainer);

    context.subscriptions.push(new WorkspaceSymbols(standardOutputChannel));

    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new BlockFormatProviders(), ':'));
    // In case we have CR LF
    const triggerCharacters: string[] = os.EOL.split('');
    triggerCharacters.shift();

    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('python', new SimpleConfigurationProvider()));
    activationDeferred.resolve();

    // tslint:disable-next-line:no-unused-expression
    new BannerService(persistentStateFactory);

    const deprecationMgr = new FeatureDeprecationManager(persistentStateFactory, !!jupyterExtInstalled);
    deprecationMgr.initialize();
    context.subscriptions.push(new FeatureDeprecationManager(persistentStateFactory, !!jupyterExtInstalled));
}

function sendStartupTelemetry(activatedPromise: Promise<void>) {
    const stopWatch = new StopWatch();
    activatedPromise
        .then(async () => {
            const duration = stopWatch.elapsedTime;
            let condaVersion: string | undefined;
            try {
                condaVersion = await getCondaVersion();
                // tslint:disable-next-line:no-empty
            } catch { }
            const props = condaVersion ? { condaVersion } : undefined;
            sendTelemetryEvent(EDITOR_LOAD, duration, props);
        })
        .catch(ex => console.error('Python Extension: sendStartupTelemetry', ex));
}
