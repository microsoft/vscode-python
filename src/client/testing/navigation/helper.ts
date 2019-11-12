// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { CancellationToken, SymbolInformation, TextDocument, TextEditor, Uri } from 'vscode';
import { IDocumentManager } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IDocumentSymbolProvider } from '../../common/types';
import { ITestNavigatorHelper, SymbolSearch } from './types';

@injectable()
export class TestNavigatorHelper implements ITestNavigatorHelper {
    constructor(
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IDocumentSymbolProvider) @named('test') private readonly symbolProvider: IDocumentSymbolProvider
    ) {}
    public async openFile(file?: Uri): Promise<[TextDocument, TextEditor]> {
        if (!file) {
            throw new Error('Unable to navigate to an undefined test file');
        }
        const doc = await this.documentManager.openTextDocument(file);
        const editor = await this.documentManager.showTextDocument(doc);
        return [doc, editor];
    }
    public async findSymbol(doc: TextDocument, search: SymbolSearch, token: CancellationToken): Promise<SymbolInformation | undefined> {
        const symbols = (await this.symbolProvider.provideDocumentSymbols(doc, token)) as SymbolInformation[];
        if (!Array.isArray(symbols) || symbols.length === 0) {
            traceError('Symbol information not found', new Error('Symbol information not found'));
            return;
        }
        return symbols.find(search);
    }
}
