// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { IOutputChannel, IPythonSettings } from '../common/types';
import { IShebangCodeLensProvider } from '../interpreter/contracts';
import { IServiceManager } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { PythonCompletionItemProvider } from '../providers/completionProvider';
import { PythonDefinitionProvider } from '../providers/definitionProvider';
import { PythonHoverProvider } from '../providers/hoverProvider';
import { activateGoToObjectDefinitionProvider } from '../providers/objectDefinitionProvider';
import { PythonReferenceProvider } from '../providers/referenceProvider';
import { PythonRenameProvider } from '../providers/renameProvider';
import { PythonSignatureProvider } from '../providers/signatureProvider';
import { activateSimplePythonRefactorProvider } from '../providers/simpleRefactorProvider';
import { PythonSymbolProvider } from '../providers/symbolProvider';
import { TEST_OUTPUT_CHANNEL } from '../unittests/common/constants';
import * as tests from '../unittests/main';
import { WorkspaceSymbols } from '../workspaceSymbols/main';
import { IExtensionActivator } from './types';

const PYTHON: vscode.DocumentFilter = { language: 'python' };

export class ClassicExtensionActivator implements IExtensionActivator {
  constructor(private serviceManager: IServiceManager, private pythonSettings: IPythonSettings) {
  }

  public async activate(context: vscode.ExtensionContext): Promise<boolean> {
    const standardOutputChannel = this.serviceManager.get<vscode.OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    activateSimplePythonRefactorProvider(context, standardOutputChannel, this.serviceManager);

    const jediFactory = new JediFactory(context.asAbsolutePath('.'), this.serviceManager);
    context.subscriptions.push(jediFactory);
    context.subscriptions.push(...activateGoToObjectDefinitionProvider(jediFactory));

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
    context.subscriptions.push(vscode.languages.registerRenameProvider(PYTHON, new PythonRenameProvider(this.serviceManager)));
    const definitionProvider = new PythonDefinitionProvider(jediFactory);

    context.subscriptions.push(vscode.languages.registerDefinitionProvider(PYTHON, definitionProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(PYTHON, new PythonHoverProvider(jediFactory)));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(PYTHON, new PythonReferenceProvider(jediFactory)));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(PYTHON, new PythonCompletionItemProvider(jediFactory, this.serviceManager), '.'));
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(PYTHON, this.serviceManager.get<IShebangCodeLensProvider>(IShebangCodeLensProvider)));

    const symbolProvider = new PythonSymbolProvider(jediFactory);
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(PYTHON, symbolProvider));

    if (this.pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
      context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(PYTHON, new PythonSignatureProvider(jediFactory), '(', ','));
    }

    const unitTestOutChannel = this.serviceManager.get<vscode.OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
    tests.activate(context, unitTestOutChannel, symbolProvider, this.serviceManager);

    context.subscriptions.push(new WorkspaceSymbols(this.serviceManager));
    return true;
  }

  // tslint:disable-next-line:no-empty
  public async deactivate(): Promise<void> { }
}
