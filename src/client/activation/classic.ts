// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { FeatureDeprecationManager } from '../common/featureDeprecationManager';
import { IOutputChannel, IPersistentStateFactory, IPythonSettings } from '../common/types';
import { registerTypes as formattersRegisterTypes } from '../formatters/serviceRegistry';
import { IShebangCodeLensProvider } from '../interpreter/contracts';
import { IServiceManager } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { LinterCommands } from '../linters/linterCommands';
import { registerTypes as lintersRegisterTypes } from '../linters/serviceRegistry';
import { ILintingEngine } from '../linters/types';
import { PythonCompletionItemProvider } from '../providers/completionProvider';
import { PythonDefinitionProvider } from '../providers/definitionProvider';
import { PythonFormattingEditProvider } from '../providers/formatProvider';
import { PythonHoverProvider } from '../providers/hoverProvider';
import { LinterProvider } from '../providers/linterProvider';
import { activateGoToObjectDefinitionProvider } from '../providers/objectDefinitionProvider';
import { PythonReferenceProvider } from '../providers/referenceProvider';
import { PythonRenameProvider } from '../providers/renameProvider';
import { PythonSignatureProvider } from '../providers/signatureProvider';
import { activateSimplePythonRefactorProvider } from '../providers/simpleRefactorProvider';
import { PythonSymbolProvider } from '../providers/symbolProvider';
import * as sortImports from '../sortImports';
import { BlockFormatProviders } from '../typeFormatters/blockFormatProvider';
import { OnEnterFormatter } from '../typeFormatters/onEnterFormatter';
import { TEST_OUTPUT_CHANNEL } from '../unittests/common/constants';
import * as tests from '../unittests/main';
import { WorkspaceSymbols } from '../workspaceSymbols/main';
import { IExtensionActivator } from './types';

const PYTHON: vscode.DocumentFilter = { language: 'python' };

export class ClassicExtensionActivator implements IExtensionActivator {

  public async activate(context: vscode.ExtensionContext, serviceManager: IServiceManager, pythonSettings: IPythonSettings): Promise<boolean> {
    lintersRegisterTypes(serviceManager);
    formattersRegisterTypes(serviceManager);

    const standardOutputChannel = serviceManager.get<vscode.OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
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

    const unitTestOutChannel = serviceManager.get<vscode.OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
    tests.activate(context, unitTestOutChannel, symbolProvider, serviceManager);

    context.subscriptions.push(new WorkspaceSymbols(serviceManager));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new BlockFormatProviders(), ':'));
    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new OnEnterFormatter(), '\n'));

    const persistentStateFactory = serviceManager.get<IPersistentStateFactory>(IPersistentStateFactory);
    const deprecationMgr = new FeatureDeprecationManager(persistentStateFactory, !!jupyterExtension);
    deprecationMgr.initialize();
    context.subscriptions.push(new FeatureDeprecationManager(persistentStateFactory, !!jupyterExtension));

    return true;
  }

  // tslint:disable-next-line:no-empty
  public async deactivate(): Promise<void> { }
}
