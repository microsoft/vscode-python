'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import { JediFactory } from '../languageServices/jediProxyFactory';

export class PythonSymbolProvider implements vscode.DocumentSymbolProvider {
    public constructor(private jediFactory: JediFactory) { }
    private static parseData(document: vscode.TextDocument, data: proxy.ISymbolResult): vscode.SymbolInformation[] {
        if (data) {
            let symbols = data.definitions.filter(sym => sym.fileName === document.fileName);
            return symbols.map(sym => {
                const symbol = sym.kind;
                const range = new vscode.Range(
                    sym.range.startLine, sym.range.startColumn,
                    sym.range.endLine, sym.range.endColumn);
                const uri = vscode.Uri.file(sym.fileName);
                const location = new vscode.Location(uri, range);
                return new vscode.SymbolInformation(sym.text, symbol, sym.container, location);
            });
        }
        return [];
    }
    public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        var filename = document.fileName;

        var cmd: proxy.ICommand<proxy.ISymbolResult> = {
            command: proxy.CommandType.Symbols,
            fileName: filename,
            columnIndex: 0,
            lineIndex: 0
        };

        if (document.isDirty) {
            cmd.source = document.getText();
        }

        return this.jediFactory.getJediProxyHandler<proxy.ISymbolResult>(document.uri).sendCommand(cmd, token).then(data => {
            return PythonSymbolProvider.parseData(document, data);
        });
    }
    public provideDocumentSymbolsForInternalUse(document: vscode.TextDocument, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        var filename = document.fileName;

        var cmd: proxy.ICommand<proxy.ISymbolResult> = {
            command: proxy.CommandType.Symbols,
            fileName: filename,
            columnIndex: 0,
            lineIndex: 0
        };

        if (document.isDirty) {
            cmd.source = document.getText();
        }

        return this.jediFactory.getJediProxyHandler<proxy.ISymbolResult>(document.uri).sendCommandNonCancellableCommand(cmd, token).then(data => {
            return PythonSymbolProvider.parseData(document, data);
        });
    }
}
