// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, DocumentSymbolProvider, SymbolInformation, TextDocument } from 'vscode';
import { createDeferred, Deferred } from '../common/helpers';
import { IServiceContainer } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { SYMBOL } from '../telemetry/constants';
import * as proxy from './jediProxy';
import { PythonSymbolProvider } from './symbolProvider';

export class ThrottledPythonSymbolProvider extends PythonSymbolProvider implements DocumentSymbolProvider {
    private readonly debounceRequest: Map<string, { timer: NodeJS.Timer; deferred: Deferred<SymbolInformation[]> }>;
    public constructor(serviceContainer: IServiceContainer, jediFactory: JediFactory, private readonly debounceTimeoutMs = 500) {
        super(serviceContainer, jediFactory);
        this.debounceRequest = new Map<string, { timer: NodeJS.Timer; deferred: Deferred<SymbolInformation[]> }>();
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
}
