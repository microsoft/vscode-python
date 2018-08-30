'use strict';

import { CancellationToken, DocumentSymbolProvider, Location, Range, SymbolInformation, SymbolKind, TextDocument, Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { createDeferred, Deferred } from '../common/helpers';
import { IFileSystem } from '../common/platform/types';
import { IServiceContainer } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { SYMBOL } from '../telemetry/constants';
import * as proxy from './jediProxy';

/**
 * A representation of the symbol data the language server provides.
 */
interface ILSSymbolTree {
    name: string;
    kind: SymbolKind;
    range: IRange;
    children?: ILSSymbolTree[];
    // We don't care about the rest.
    selectionRange?: IRange;
    _functionKind?: string;
    deprecated?: boolean;
    detail?: string;
}
interface IRange {
    start: IPosition;
    end: IPosition;
}
interface IPosition {
    line: number;
    character: number;
}

function flattenSymbolTree(tree: ILSSymbolTree, uri: Uri, containerName: string = ''): SymbolInformation[] {
    const flattened: SymbolInformation[] = [];

    const range = new Range(
        tree.range.start.line,
        tree.range.start.character,
        tree.range.end.line,
        tree.range.end.character
    );
    const info = new SymbolInformation(
        tree.name,
        // For whatever reason, the values of VS Code's SymbolKind enum
        // are off-by-one relative to the LSP:
        //  https://microsoft.github.io/language-server-protocol/specification#document-symbols-request-leftwards_arrow_with_hook
        tree.kind - 1,
        containerName,
        new Location(uri, range)
    );
    flattened.push(info);

    if (tree.children && tree.children.length > 0) {
        // FYI: Jedi doesn't fully-qualify the container name so we
        // don't bother here either.
        //const fullName = `${containerName}.${tree.name}`;
        for (const child of tree.children) {
            const flattenedChild = flattenSymbolTree(child, uri, tree.name);
            flattened.push(...flattenedChild);
        }
    }

    return flattened;
}

/**
 * Provides Python symbols to VS Code (from the language server).
 *
 * See:
 *   https://code.visualstudio.com/docs/extensionAPI/vscode-api#DocumentSymbolProvider
 */
export class LanguageServerSymbolProvider implements DocumentSymbolProvider {
    constructor(
        private readonly languageClient: LanguageClient
    ) { }

    public async provideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<SymbolInformation[]> {
        const uri = document.uri;
        const args = { textDocument: { uri: uri.toString() } };
        const raw = await this.languageClient.sendRequest<ILSSymbolTree[]>(
            'textDocument/documentSymbol',
            args,
            token
        );
        const symbols: SymbolInformation[] = [];
        for (const tree of raw) {
            const flattened = flattenSymbolTree(tree, uri);
            symbols.push(...flattened);
        }
        return Promise.resolve(symbols);
    }
}

/**
 * Provides Python symbols to VS Code (from Jedi).
 *
 * See:
 *   https://code.visualstudio.com/docs/extensionAPI/vscode-api#DocumentSymbolProvider
 */
export class JediSymbolProvider implements DocumentSymbolProvider {
    private debounceRequest: Map<string, { timer: NodeJS.Timer; deferred: Deferred<SymbolInformation[]> }>;
    private readonly fs: IFileSystem;

    public constructor(serviceContainer: IServiceContainer, private jediFactory: JediFactory, private readonly debounceTimeoutMs = 500) {
        this.debounceRequest = new Map<string, { timer: NodeJS.Timer; deferred: Deferred<SymbolInformation[]> }>();
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
    }

    @captureTelemetry(SYMBOL)
    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
        return this.provideDocumentSymbolsThrottled(document, token);
    }

    private provideDocumentSymbolsThrottled(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
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

    // This does not appear to be used anywhere currently...
    // tslint:disable-next-line:no-unused-variable
    private provideDocumentSymbolsUnthrottled(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
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
