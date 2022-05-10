// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable class-methods-use-this */

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
import { ILanguageServer, ILanguageServerProxy } from '../activation/types';
import { ILanguageServerExtensionManager } from './types';

// This LS manager implements ILanguageServer directly
// instead of extending LanguageServerCapabilities because it doesn't need to do anything.
export class NoneLSExtensionManager implements ILanguageServer, ILanguageServerExtensionManager {
    serverProxy: ILanguageServerProxy | undefined;

    constructor() {
        this.serverProxy = undefined;
    }

    dispose(): void {
        // Nothing to do here.
    }

    get(): Promise<ILanguageServer> {
        return Promise.resolve(this);
    }

    startLanguageServer(): Promise<void> {
        return Promise.resolve();
    }

    stopLanguageServer(): Promise<void> {
        return Promise.resolve();
    }

    canStartLanguageServer(): boolean {
        return true;
    }

    languageServerNotAvailable(): Promise<void> {
        // Nothing to do here.
        return Promise.resolve();
    }

    public provideRenameEdits(
        _document: TextDocument,
        _position: Position,
        _newName: string,
        _token: CancellationToken,
    ): ProviderResult<WorkspaceEdit> {
        return null;
    }

    public provideDefinition(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
    ): ProviderResult<Location | Location[] | LocationLink[]> {
        return null;
    }

    public provideHover(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
    ): ProviderResult<Hover> {
        return null;
    }

    public provideReferences(
        _document: TextDocument,
        _position: Position,
        _context: ReferenceContext,
        _token: CancellationToken,
    ): ProviderResult<Location[]> {
        return null;
    }

    public provideCompletionItems(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
        _context: CompletionContext,
    ): ProviderResult<CompletionItem[] | CompletionList> {
        return null;
    }

    public provideCodeLenses(_document: TextDocument, _token: CancellationToken): ProviderResult<CodeLens[]> {
        return null;
    }

    public provideDocumentSymbols(
        _document: TextDocument,
        _token: CancellationToken,
    ): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        return null;
    }

    public provideSignatureHelp(
        _document: TextDocument,
        _position: Position,
        _token: CancellationToken,
        _context: SignatureHelpContext,
    ): ProviderResult<SignatureHelp> {
        return null;
    }
}
