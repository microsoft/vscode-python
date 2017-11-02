'use strict';
import {CancellationToken, DocumentSymbolProvider, SymbolInformation, SymbolKind, TextDocument} from 'vscode';
import {CellHelper} from '../common/cellHelper';

export class JupyterSymbolProvider implements DocumentSymbolProvider {
    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
        const cells = CellHelper.getCells(document);
        if (cells.length === 0) {
            return Promise.resolve([]);
        }

        const symbols = cells.map(cell => {
            const title = 'Jupyter Cell' + (cell.title.length === 0 ? '' : ': ' + cell.title);
            return new SymbolInformation(title, SymbolKind.Namespace, cell.range);
        });

        return Promise.resolve(symbols);
    }
}
