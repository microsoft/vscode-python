// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any no-require-imports no-var-requires

import { expect, use } from 'chai';
import * as TypeMoq from 'typemoq';
import { CancellationToken, CancellationTokenSource, CompletionItemKind, DocumentSymbolProvider, Location, SymbolInformation, SymbolKind, TextDocument, Uri } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { IFileSystem } from '../../client/common/platform/types';
import { parseRange, splitFullName } from '../../client/common/utils';
import { IServiceContainer } from '../../client/ioc/types';
import { JediFactory } from '../../client/languageServices/jediProxyFactory';
import { IDefinition, ISymbolResult, JediProxyHandler } from '../../client/providers/jediProxy';
import { JediSymbolProvider, LanguageServerSymbolProvider } from '../../client/providers/symbolProvider';

const assertArrays = require('chai-arrays');
use(assertArrays);

suite('Jedi Symbol Provider', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let jediHandler: TypeMoq.IMock<JediProxyHandler<ISymbolResult>>;
    let jediFactory: TypeMoq.IMock<JediFactory>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let provider: DocumentSymbolProvider;
    let uri: Uri;
    let doc: TypeMoq.IMock<TextDocument>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        jediFactory = TypeMoq.Mock.ofType(JediFactory);
        jediHandler = TypeMoq.Mock.ofType<JediProxyHandler<ISymbolResult>>();

        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        doc = TypeMoq.Mock.ofType<TextDocument>();
        jediFactory.setup(j => j.getJediProxyHandler(TypeMoq.It.isAny()))
            .returns(() => jediHandler.object);

        serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);
    });

    async function testDocumentation(requestId: number, fileName: string, expectedSize: number, token?: CancellationToken, isUntitled = false) {
        fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => true);
        token = token ? token : new CancellationTokenSource().token;
        const symbolResult = TypeMoq.Mock.ofType<ISymbolResult>();

        const definitions: IDefinition[] = [
            {
                container: '', fileName: fileName, kind: SymbolKind.Array,
                range: { endColumn: 0, endLine: 0, startColumn: 0, startLine: 0 },
                rawType: '', text: '', type: CompletionItemKind.Class
            }
        ];

        uri = Uri.file(fileName);
        doc.setup(d => d.uri).returns(() => uri);
        doc.setup(d => d.fileName).returns(() => fileName);
        doc.setup(d => d.isUntitled).returns(() => isUntitled);
        doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => '');
        symbolResult.setup(c => c.requestId).returns(() => requestId);
        symbolResult.setup(c => c.definitions).returns(() => definitions);
        symbolResult.setup((c: any) => c.then).returns(() => undefined);
        jediHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(symbolResult.object));

        const items = await provider.provideDocumentSymbols(doc.object, token);
        expect(items).to.be.array();
        expect(items).to.be.ofSize(expectedSize);
    }

    test('Ensure symbols are returned', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        await testDocumentation(1, __filename, 1);
    });
    test('Ensure symbols are returned (for untitled documents)', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        await testDocumentation(1, __filename, 1, undefined, true);
    });
    test('Ensure symbols are returned with a debounce of 100ms', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        await testDocumentation(1, __filename, 1);
    });
    test('Ensure symbols are returned with a debounce of 100ms (for untitled documents)', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        await testDocumentation(1, __filename, 1, undefined, true);
    });
    test('Ensure symbols are not returned when cancelled', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        const tokenSource = new CancellationTokenSource();
        tokenSource.cancel();
        await testDocumentation(1, __filename, 0, tokenSource.token);
    });
    test('Ensure symbols are not returned when cancelled (for untitled documents)', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        const tokenSource = new CancellationTokenSource();
        tokenSource.cancel();
        await testDocumentation(1, __filename, 0, tokenSource.token, true);
    });
    test('Ensure symbols are returned only for the last request', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, __filename, 0),
            testDocumentation(2, __filename, 0),
            testDocumentation(3, __filename, 1)
        ]);
    });
    test('Ensure symbols are returned for all the requests when the doc is untitled', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, __filename, 1, undefined, true),
            testDocumentation(2, __filename, 1, undefined, true),
            testDocumentation(3, __filename, 1, undefined, true)
        ]);
    });
    test('Ensure symbols are returned for multiple documents', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        await Promise.all([
            testDocumentation(1, 'file1', 1),
            testDocumentation(2, 'file2', 1)
        ]);
    });
    test('Ensure symbols are returned for multiple untitled documents ', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        await Promise.all([
            testDocumentation(1, 'file1', 1, undefined, true),
            testDocumentation(2, 'file2', 1, undefined, true)
        ]);
    });
    test('Ensure symbols are returned for multiple documents with a debounce of 100ms', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, 'file1', 1),
            testDocumentation(2, 'file2', 1)
        ]);
    });
    test('Ensure symbols are returned for multiple untitled documents with a debounce of 100ms', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, 'file1', 1, undefined, true),
            testDocumentation(2, 'file2', 1, undefined, true)
        ]);
    });
    test('Ensure IFileSystem.arePathsSame is used', async () => {
        doc.setup(d => d.getText())
            .returns(() => '')
            .verifiable(TypeMoq.Times.once());
        doc.setup(d => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        doc.setup(d => d.fileName)
            .returns(() => __filename);

        const symbols = TypeMoq.Mock.ofType<ISymbolResult>();
        symbols.setup((s: any) => s.then).returns(() => undefined);
        const definitions: IDefinition[] = [];
        for (let counter = 0; counter < 3; counter += 1) {
            const def = TypeMoq.Mock.ofType<IDefinition>();
            def.setup(d => d.fileName).returns(() => counter.toString());
            definitions.push(def.object);

            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isValue(counter.toString()), TypeMoq.It.isValue(__filename)))
                .returns(() => false)
                .verifiable(TypeMoq.Times.exactly(1));
        }
        symbols.setup(s => s.definitions)
            .returns(() => definitions)
            .verifiable(TypeMoq.Times.atLeastOnce());

        jediHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(symbols.object))
            .verifiable(TypeMoq.Times.once());

        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        await provider.provideDocumentSymbols(doc.object, new CancellationTokenSource().token);

        doc.verifyAll();
        symbols.verifyAll();
        fileSystem.verifyAll();
        jediHandler.verifyAll();
    });
});

function newDoc(
    uri?: Uri,
    filename?: string,
    isUntitled?: boolean,
    text?: string
): TypeMoq.IMock<TextDocument> {
    const doc = TypeMoq.Mock.ofType<TextDocument>(undefined, TypeMoq.MockBehavior.Strict);
    if (uri !== undefined) {
        doc.setup(d => d.uri).returns(() => uri);
    }
    if (filename !== undefined) {
        doc.setup(d => d.fileName).returns(() => filename);
    }
    if (isUntitled !== undefined) {
        doc.setup(d => d.isUntitled).returns(() => isUntitled);
    }
    if (text !== undefined) {
        doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => text);
    }
    return doc;
}

suite('Language Server Symbol Provider', () => {

    function newLanguageClient(
        token: CancellationToken,
        results: [any, SymbolInformation[]][]
    ): TypeMoq.IMock<LanguageClient> {
        const langClient = TypeMoq.Mock.ofType<LanguageClient>(undefined, TypeMoq.MockBehavior.Strict);
        for (const [doc, symbols] of results) {
            langClient.setup(l => l.sendRequest(
                TypeMoq.It.isValue('textDocument/documentSymbol'),
                TypeMoq.It.isValue(doc),
                TypeMoq.It.isValue(token)
            ))
                .returns(() => Promise.resolve(symbols))
                .verifiable(TypeMoq.Times.once());
        }
        return langClient;
    }

    function getRawDoc(
        uri: Uri
    ) {
        return {
            textDocument: {
                uri: uri.toString()
            }
        };
    }

    test('Ensure symbols are returned', async () => {
        const uri = Uri.file(__filename);
        const expected = newSymbols(uri, [
            ['spam', SymbolKind.Array, 0]
        ]);
        const doc = newDoc(uri);
        const token = new CancellationTokenSource().token;
        const langClient = newLanguageClient(token, [
            [getRawDoc(uri), expected]
        ]);
        const provider = new LanguageServerSymbolProvider(langClient.object);

        const items = await provider.provideDocumentSymbols(doc.object, token);

        expect(items).to.deep.equal(expected);
        doc.verifyAll();
        langClient.verifyAll();
    });
});

//################################
// helpers

function newSymbols(
    uri: Uri,
    info: [string, SymbolKind, string | number][]
): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];
    for (const [fullName, kind, range] of info) {
        const symbol = newSymbol(uri, fullName, kind, range);
        symbols.push(symbol);
    }
    return symbols;
}

function newSymbol(
    uri: Uri,
    fullName: string,
    kind: SymbolKind,
    rawRange: string | number = ''
): SymbolInformation {
    const [containerName, name] = splitFullName(fullName);
    const range = parseRange(rawRange);
    const loc = new Location(uri, range);
    return new SymbolInformation(name, kind, containerName, loc);
}
