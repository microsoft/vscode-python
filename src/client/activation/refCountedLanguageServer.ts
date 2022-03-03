// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {
    CancellationToken,
    CodeLens,
    CompletionContext,
    CompletionItem,
    CompletionList,
    DocumentSymbol,
    Hover,
    Location,
    LocationLink,
    Position,
    ProviderResult,
    ReferenceContext,
    SignatureHelp,
    SignatureHelpContext,
    SymbolInformation,
    TextDocument,
    WorkspaceEdit,
} from 'vscode';

import { Resource } from '../common/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { ILanguageServerActivator, LanguageServerType } from './types';

export class RefCountedLanguageServer implements ILanguageServerActivator {
    private refCount = 1;
    constructor(
        private impl: ILanguageServerActivator,
        private _type: LanguageServerType,
        private disposeCallback: () => void,
    ) {}

    public increment = () => {
        this.refCount += 1;
    };

    public get type() {
        return this._type;
    }

    public dispose() {
        this.refCount = Math.max(0, this.refCount - 1);
        if (this.refCount === 0) {
            this.disposeCallback();
        }
    }

    public start(_resource: Resource, _interpreter: PythonEnvironment | undefined): Promise<void> {
        throw new Error('Server should have already been started. Do not start the wrapper.');
    }

    public activate() {
        this.impl.activate();
    }

    public deactivate() {
        this.impl.deactivate();
    }

    public get connection() {
        return this.impl.connection;
    }

    public get capabilities() {
        return this.impl.capabilities;
    }

    public provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        token: CancellationToken,
    ): ProviderResult<WorkspaceEdit> {
        return this.impl.provideRenameEdits(document, position, newName, token);
    }
    public provideDefinition(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): ProviderResult<Location | Location[] | LocationLink[]> {
        return this.impl.provideDefinition(document, position, token);
    }
    public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        return this.impl.provideHover(document, position, token);
    }
    public provideReferences(
        document: TextDocument,
        position: Position,
        context: ReferenceContext,
        token: CancellationToken,
    ): ProviderResult<Location[]> {
        return this.impl.provideReferences(document, position, context, token);
    }
    public provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext,
    ): ProviderResult<CompletionItem[] | CompletionList> {
        return this.impl.provideCompletionItems(document, position, token, context);
    }
    public resolveCompletionItem(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        if (this.impl.resolveCompletionItem) {
            return this.impl.resolveCompletionItem(item, token);
        }
    }
    public provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
        return this.impl.provideCodeLenses(document, token);
    }
    public provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken,
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        return this.impl.provideDocumentSymbols(document, token);
    }
    public provideSignatureHelp(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: SignatureHelpContext,
    ): ProviderResult<SignatureHelp> {
        return this.impl.provideSignatureHelp(document, position, token, context);
    }
}
