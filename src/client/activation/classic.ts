// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { DocumentFilter, ExtensionContext, languages, OutputChannel } from 'vscode';
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
import { IExtensionActivator } from './types';

export class ClassicExtensionActivator implements IExtensionActivator {
    constructor(private serviceManager: IServiceManager, private pythonSettings: IPythonSettings, private documentSelector: DocumentFilter[]) {
    }

    public async activate(context: ExtensionContext): Promise<boolean> {
        const standardOutputChannel = this.serviceManager.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        activateSimplePythonRefactorProvider(context, standardOutputChannel, this.serviceManager);

        const jediFactory = new JediFactory(context.asAbsolutePath('.'), this.serviceManager);
        context.subscriptions.push(jediFactory);
        context.subscriptions.push(...activateGoToObjectDefinitionProvider(jediFactory));

        context.subscriptions.push(jediFactory);
        context.subscriptions.push(languages.registerRenameProvider(this.documentSelector, new PythonRenameProvider(this.serviceManager)));
        const definitionProvider = new PythonDefinitionProvider(jediFactory);

        context.subscriptions.push(languages.registerDefinitionProvider(this.documentSelector, definitionProvider));
        context.subscriptions.push(languages.registerHoverProvider(this.documentSelector, new PythonHoverProvider(jediFactory)));
        context.subscriptions.push(languages.registerReferenceProvider(this.documentSelector, new PythonReferenceProvider(jediFactory)));
        context.subscriptions.push(languages.registerCompletionItemProvider(this.documentSelector, new PythonCompletionItemProvider(jediFactory, this.serviceManager), '.'));
        context.subscriptions.push(languages.registerCodeLensProvider(this.documentSelector, this.serviceManager.get<IShebangCodeLensProvider>(IShebangCodeLensProvider)));

        const symbolProvider = new PythonSymbolProvider(jediFactory);
        context.subscriptions.push(languages.registerDocumentSymbolProvider(this.documentSelector, symbolProvider));

        if (this.pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
            context.subscriptions.push(languages.registerSignatureHelpProvider(this.documentSelector, new PythonSignatureProvider(jediFactory), '(', ','));
        }

        const unitTestOutChannel = this.serviceManager.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        tests.activate(context, unitTestOutChannel, symbolProvider, this.serviceManager);

        return true;
    }

    // tslint:disable-next-line:no-empty
    public async deactivate(): Promise<void> { }
}
