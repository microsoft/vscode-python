// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken, DocumentSymbolProvider, Location, Range, SymbolInformation, SymbolKind, TextDocument, Uri } from 'vscode';
import { traceError } from '../../common/logger';
import { IProcessServiceFactory } from '../../common/process/types';
import { IConfigurationService } from '../../common/types';
import { EXTENSION_ROOT_DIR } from '../../constants';

type RawSymbol = { namespace: string; name: string; range: Range };
type Symbols = {
    classes: RawSymbol[];
    methods: RawSymbol[];
    functions: RawSymbol[];
};

@injectable()
export class TestFileSymbolProvider implements DocumentSymbolProvider {
    constructor(
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory
    ) {}
    public async provideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<SymbolInformation[]> {
        const rawSymbols = await this.getSymbols(document, token);
        if (!rawSymbols) {
            return [];
        }
        return [
            ...rawSymbols.classes.map(item => this.parseRawSymbol(document.uri, item, SymbolKind.Class)),
            ...rawSymbols.methods.map(item => this.parseRawSymbol(document.uri, item, SymbolKind.Method)),
            ...rawSymbols.functions.map(item => this.parseRawSymbol(document.uri, item, SymbolKind.Function))
        ];
    }
    private parseRawSymbol(uri: Uri, symbol: RawSymbol, kind: SymbolKind): SymbolInformation {
        const range = new Range(symbol.range.start.line, symbol.range.start.character, symbol.range.end.line, symbol.range.end.character);
        return {
            containerName: symbol.namespace,
            kind,
            name: symbol.name,
            location: new Location(uri, range)
        };
    }
    private async getSymbols(document: TextDocument, token: CancellationToken): Promise<Symbols | undefined> {
        try {
            if (document.isUntitled) {
                return;
            }
            const scriptArgs: string[] = [document.uri.fsPath];
            if (document.isDirty) {
                scriptArgs.push(document.getText());
            }
            const pythonPath = this.configurationService.getSettings(document.uri).pythonPath;
            const args = [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'symbolProvider.py'), ...scriptArgs];
            const processService = await this.processServiceFactory.create(document.uri);
            const proc = await processService.exec(pythonPath, args, { throwOnStdErr: true, token });

            return JSON.parse(proc.stdout);
        } catch (ex) {
            traceError('Python: Failed to get symbols', ex);
            return;
        }
    }
}
