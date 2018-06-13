'use strict';

import { CancellationToken, DocumentSymbolProvider, Location, Range, SymbolInformation, TextDocument, Uri } from 'vscode';
import { IFileSystem } from '../common/platform/types';
import { IServiceContainer } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { SYMBOL } from '../telemetry/constants';
import * as proxy from './jediProxy';

export class PythonSymbolProvider implements DocumentSymbolProvider {
    protected readonly fs: IFileSystem;
    public constructor(serviceContainer: IServiceContainer, protected readonly jediFactory: JediFactory) {
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }
    @captureTelemetry(SYMBOL)
    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
        const filename = document.fileName;

        const cmd: proxy.ICommand<proxy.ISymbolResult> = {
            command: proxy.CommandType.Symbols,
            fileName: filename,
            columnIndex: 0,
            lineIndex: 0
        };

        if (document.isDirty) {
            cmd.source = document.getText();
        }

        return this.jediFactory.getJediProxyHandler<proxy.ISymbolResult>(document.uri).sendCommandNonCancellableCommand(cmd, token)
            .then(data => this.parseData(document, data));
    }
    protected parseData(document: TextDocument, data?: proxy.ISymbolResult): SymbolInformation[] {
        if (data) {
            const symbols = data.definitions.filter(sym => this.fs.arePathsSame(sym.fileName, document.fileName));
            return symbols.map(sym => {
                const symbol = sym.kind;
                const range = new Range(
                    sym.range.startLine, sym.range.startColumn,
                    sym.range.endLine, sym.range.endColumn);
                const uri = Uri.file(sym.fileName);
                const location = new Location(uri, range);
                return new SymbolInformation(sym.text, symbol, sym.container, location);
            });
        }
        return [];
    }
}
