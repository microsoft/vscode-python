// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any no-require-imports no-var-requires

import { expect, use } from 'chai';
import * as TypeMoq from 'typemoq';
import { CancellationToken, CancellationTokenSource, CompletionItemKind, DocumentSymbolProvider, SymbolKind, TextDocument, Uri } from 'vscode';
import { JediFactory } from '../../client/languageServices/jediProxyFactory';
import { IDefinition, ISymbolResult, JediProxyHandler } from '../../client/providers/jediProxy';
import { PythonSymbolProvider } from '../../client/providers/symbolProvider';
const assertArrays = require('chai-arrays');
use(assertArrays);

suite('Symbol Provider', () => {
    let symbolProvider: DocumentSymbolProvider;
    let jediHandler: TypeMoq.IMock<JediProxyHandler<ISymbolResult>>;
    let jediFactory: TypeMoq.IMock<JediFactory>;
    setup(() => {
        jediFactory = TypeMoq.Mock.ofType(JediFactory);
        jediHandler = TypeMoq.Mock.ofType<JediProxyHandler<ISymbolResult>>();

        jediFactory.setup(j => j.getJediProxyHandler(TypeMoq.It.isAny()))
            .returns(() => jediHandler.object);
    });

    async function testDocumentation(requestId: number, fileName: string, expectedSize: number, token?: CancellationToken, isUntitled = false) {
        const doc = TypeMoq.Mock.ofType<TextDocument>();
        token = token ? token : new CancellationTokenSource().token;
        const symbolResult = TypeMoq.Mock.ofType<ISymbolResult>();

        const definitions: IDefinition[] = [
            {
                container: '', fileName: fileName, kind: SymbolKind.Array,
                range: { endColumn: 0, endLine: 0, startColumn: 0, startLine: 0 },
                rawType: '', text: '', type: CompletionItemKind.Class
            }
        ];

        doc.setup(d => d.fileName).returns(() => fileName);
        doc.setup(d => d.isUntitled).returns(() => isUntitled);
        doc.setup(d => d.uri).returns(() => Uri.file(fileName));
        doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => '');
        symbolResult.setup(c => c.requestId).returns(() => requestId);
        symbolResult.setup(c => c.definitions).returns(() => definitions);
        symbolResult.setup((c: any) => c.then).returns(() => undefined);
        jediHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(symbolResult.object));

        const items = await symbolProvider.provideDocumentSymbols(doc.object, token);
        expect(items).to.be.array();
        expect(items).to.be.ofSize(expectedSize);
    }

    test('Ensure symbols are returned', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        await testDocumentation(1, __filename, 1);
    });
    test('Ensure symbols are returned (for untitled documents)', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        await testDocumentation(1, __filename, 1, undefined, true);
    });
    test('Ensure symbols are returned with a debounce of 100ms', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        await testDocumentation(1, __filename, 1);
    });
    test('Ensure symbols are returned with a debounce of 100ms (for untitled documents)', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        await testDocumentation(1, __filename, 1, undefined, true);
    });
    test('Ensure symbols are not returned when cancelled', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        const tokenSource = new CancellationTokenSource();
        tokenSource.cancel();
        await testDocumentation(1, __filename, 0, tokenSource.token);
    });
    test('Ensure symbols are not returned when cancelled (for untitled documents)', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        const tokenSource = new CancellationTokenSource();
        tokenSource.cancel();
        await testDocumentation(1, __filename, 0, tokenSource.token, true);
    });
    test('Ensure symbols are returned only for the last request', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, __filename, 0),
            testDocumentation(2, __filename, 0),
            testDocumentation(3, __filename, 1)
        ]);
    });
    test('Ensure symbols are returned for all the requests when the doc is untitled', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, __filename, 1, undefined, true),
            testDocumentation(2, __filename, 1, undefined, true),
            testDocumentation(3, __filename, 1, undefined, true)
        ]);
    });
    test('Ensure symbols are returned for multiple documents', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        await Promise.all([
            testDocumentation(1, 'file1', 1),
            testDocumentation(2, 'file2', 1)
        ]);
    });
    test('Ensure symbols are returned for multiple untitled documents ', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 0);
        await Promise.all([
            testDocumentation(1, 'file1', 1, undefined, true),
            testDocumentation(2, 'file2', 1, undefined, true)
        ]);
    });
    test('Ensure symbols are returned for multiple documents with a debounce of 100ms', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, 'file1', 1),
            testDocumentation(2, 'file2', 1)
        ]);
    });
    test('Ensure symbols are returned for multiple untitled documents with a debounce of 100ms', async () => {
        symbolProvider = new PythonSymbolProvider(jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, 'file1', 1, undefined, true),
            testDocumentation(2, 'file2', 1, undefined, true)
        ]);
    });
});
