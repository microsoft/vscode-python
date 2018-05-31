'use strict';

import { CancellationToken, DocumentSymbolProvider, Location, Range, SymbolInformation, TextDocument, Uri } from 'vscode';
import { createDeferred, Deferred } from '../common/helpers';
import { IFileSystem } from '../common/platform/types';
import { IServiceContainer } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { SYMBOL } from '../telemetry/constants';
import * as proxy from './jediProxy';

export class PythonSymbolProvider implements DocumentSymbolProvider {
    private debounceRequest: Map<string, { timer: NodeJS.Timer; deferred: Deferred<SymbolInformation[]> }>;
    private readonly fs: IFileSystem;
    public constructor(serviceContainer: IServiceContainer, private jediFactory: JediFactory, private readonly debounceTimeoutMs = 500) {
        this.debounceRequest = new Map<string, { timer: NodeJS.Timer; deferred: Deferred<SymbolInformation[]> }>();
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }
    @captureTelemetry(SYMBOL)
    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
        const key = `${document.uri.fsPath}`;
        if (this.debounceRequest.has(key)) {
            const item = this.debounceRequest.get(key)!;
            clearTimeout(item.timer);
            item.deferred.resolve([]);
        }

        const deferred = createDeferred<SymbolInformation[]>();
        const timer = setTimeout(() => {
            if (token.isCancellationRequested) {
                return deferred.resolve([]);
            }

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

            this.jediFactory.getJediProxyHandler<proxy.ISymbolResult>(document.uri).sendCommand(cmd, token)
                .then(data => this.parseData(document, data))
                .then(items => deferred.resolve(items))
                .catch(ex => deferred.reject(ex));

        }, this.debounceTimeoutMs);

        token.onCancellationRequested(() => {
            clearTimeout(timer);
            deferred.resolve([]);
            this.debounceRequest.delete(key);
        });

        // When a document is not saved on FS, we cannot uniquely identify it, so lets not debounce, but delay the symbol provider.
        if (!document.isUntitled) {
            this.debounceRequest.set(key, { timer, deferred });
        }

        return deferred.promise;
    }
    public provideDocumentSymbolsForInternalUse(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
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
    private parseData(document: TextDocument, data?: proxy.ISymbolResult): SymbolInformation[] {
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
