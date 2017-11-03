'use strict';
import { EDITOR_LOAD } from './common/telemetry/constants';

import * as os from 'os';
import * as vscode from 'vscode';
import * as settings from './common/configSettings';
import { Commands } from './common/constants';
import { createDeferred } from './common/helpers';
import { sendTelemetryEvent } from './common/telemetry';
import { StopWatch } from './common/telemetry/stopWatch';
import { SimpleConfigurationProvider } from './debugger';
import { InterpreterManager } from './interpreter';
import { SetInterpreterProvider } from './interpreter/configuration/setInterpreterProvider';
import { ShebangCodeLensProvider } from './interpreter/display/shebangCodeLensProvider';
import { getCondaVersion } from './interpreter/helpers';
import { InterpreterVersionService } from './interpreter/interpreterVersion';
import * as jup from './jupyter/main';
import { JupyterProvider } from './jupyter/provider';
import { JediFactory } from './languageServices/jediProxyFactory';
import { PythonCompletionItemProvider } from './providers/completionProvider';
import { PythonDefinitionProvider } from './providers/definitionProvider';
import { activateExecInTerminalProvider } from './providers/execInTerminalProvider';
import { activateFormatOnSaveProvider } from './providers/formatOnSaveProvider';
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
import { BlockFormatProviders } from './typeFormatters/blockFormatProvider';
import * as tests from './unittests/main';
import { WorkspaceSymbols } from './workspaceSymbols/main';

const PYTHON: vscode.DocumentFilter = { language: 'python' };
let unitTestOutChannel: vscode.OutputChannel;
let formatOutChannel: vscode.OutputChannel;
let lintingOutChannel: vscode.OutputChannel;
let jupMain: jup.Jupyter;
const activationDeferred = createDeferred<void>();
export const activated = activationDeferred.promise;
// tslint:disable-next-line:max-func-body-length
export async function activate(context: vscode.ExtensionContext) {
    const pythonSettings = settings.PythonSettings.getInstance();
    sendStartupTelemetry(activated);

    lintingOutChannel = vscode.window.createOutputChannel(pythonSettings.linting.outputWindow);
    formatOutChannel = lintingOutChannel;
    if (pythonSettings.linting.outputWindow !== pythonSettings.formatting.outputWindow) {
        formatOutChannel = vscode.window.createOutputChannel(pythonSettings.formatting.outputWindow);
        formatOutChannel.clear();
    }
    if (pythonSettings.linting.outputWindow !== pythonSettings.unitTest.outputWindow) {
        unitTestOutChannel = vscode.window.createOutputChannel(pythonSettings.unitTest.outputWindow);
        unitTestOutChannel.clear();
    }

    sortImports.activate(context, formatOutChannel);
    const interpreterManager = new InterpreterManager();
    await interpreterManager.autoSetInterpreter();
    await interpreterManager.refresh();
    context.subscriptions.push(interpreterManager);
    const interpreterVersionService = new InterpreterVersionService();
    context.subscriptions.push(new SetInterpreterProvider(interpreterManager, interpreterVersionService));
    context.subscriptions.push(...activateExecInTerminalProvider());
    context.subscriptions.push(activateUpdateSparkLibraryProvider());
    activateSimplePythonRefactorProvider(context, formatOutChannel);
    context.subscriptions.push(activateFormatOnSaveProvider(PYTHON, formatOutChannel));
    const jediFactory = new JediFactory(context.asAbsolutePath('.'));
    context.subscriptions.push(...activateGoToObjectDefinitionProvider(jediFactory));

    context.subscriptions.push(new ReplProvider());

    // Enable indentAction
    vscode.languages.setLanguageConfiguration(PYTHON.language, {
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
    context.subscriptions.push(vscode.languages.registerRenameProvider(PYTHON, new PythonRenameProvider(formatOutChannel)));
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
        const formatProvider = new PythonFormattingEditProvider(context, formatOutChannel);
        context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
    }

    const jupyterExtInstalled = vscode.extensions.getExtension('donjayamanne.jupyter');
    const linterProvider = new LintProvider(context, lintingOutChannel, (a, b) => Promise.resolve(false));
    context.subscriptions.push();
    if (jupyterExtInstalled) {
        if (jupyterExtInstalled.isActive) {
            jupyterExtInstalled.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider());
            linterProvider.documentHasJupyterCodeCells = jupyterExtInstalled.exports.hasCodeCells;
        }

        jupyterExtInstalled.activate().then(() => {
            jupyterExtInstalled.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider());
            linterProvider.documentHasJupyterCodeCells = jupyterExtInstalled.exports.hasCodeCells;
        });
    } else {
        jupMain = new jup.Jupyter(lintingOutChannel);
        const documentHasJupyterCodeCells = jupMain.hasCodeCells.bind(jupMain);
        jupMain.activate();
        context.subscriptions.push(jupMain);
        linterProvider.documentHasJupyterCodeCells = documentHasJupyterCodeCells;
    }
    tests.activate(context, unitTestOutChannel, symbolProvider);

    context.subscriptions.push(new WorkspaceSymbols(lintingOutChannel));

    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new BlockFormatProviders(), ':'));
    // In case we have CR LF
    const triggerCharacters: string[] = os.EOL.split('');
    triggerCharacters.shift();

    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('python', new SimpleConfigurationProvider()));
    activationDeferred.resolve();
}

async function sendStartupTelemetry(activatedPromise: Promise<void>) {
    const stopWatch = new StopWatch();
    activatedPromise.then(async () => {
        const duration = stopWatch.elapsedTime;
        let condaVersion: string | undefined;
        try {
            condaVersion = await getCondaVersion();
            // tslint:disable-next-line:no-empty
        } catch { }
        sendTelemetryEvent(EDITOR_LOAD, duration, { condaVersion });
    });
}
