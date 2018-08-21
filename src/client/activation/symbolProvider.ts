// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, DocumentSymbolProvider, SymbolInformation, TextDocument } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';

export class SymbolProvider implements DocumentSymbolProvider {
    constructor(private readonly languageClient: LanguageClient) {
    }
    public async provideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<SymbolInformation[]> {
        const args = { textDocument: { uri: document.uri.toString() } };
        return this.languageClient.sendRequest<SymbolInformation[]>('textDocument/documentSymbol', args, token);
    }
}
