// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any no-require-imports no-var-requires

import { expect, use } from 'chai';
import * as TypeMoq from 'typemoq';
import {
    CancellationToken,
    CancellationTokenSource,
    CompletionItemKind,
    DocumentSymbolProvider,
    Location,
    Range,
    SymbolInformation,
    SymbolKind,
    TextDocument,
    Uri
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { IFileSystem } from '../../../client/common/platform/types';
import { parseRange } from '../../../client/common/utils/text';
import { IServiceContainer } from '../../../client/ioc/types';
import { JediFactory } from '../../../client/languageServices/jediProxyFactory';
import { IDefinition, ISymbolResult, JediProxyHandler } from '../../../client/providers/jediProxy';
import { JediSymbolProvider, LanguageServerSymbolProvider } from '../../../client/providers/symbolProvider';

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
        jediFactory.setup((j) => j.getJediProxyHandler(TypeMoq.It.isAny())).returns(() => jediHandler.object);

        serviceContainer.setup((c) => c.get(IFileSystem)).returns(() => fileSystem.object);
    });

    async function testDocumentation(
        requestId: number,
        fileName: string,
        expectedSize: number,
        token?: CancellationToken,
        isUntitled = false
    ) {
        fileSystem.setup((fs) => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => true);
        token = token ? token : new CancellationTokenSource().token;
        const symbolResult = TypeMoq.Mock.ofType<ISymbolResult>();

        const definitions: IDefinition[] = [
            {
                container: '',
                fileName: fileName,
                kind: SymbolKind.Array,
                range: { endColumn: 0, endLine: 0, startColumn: 0, startLine: 0 },
                rawType: '',
                text: '',
                type: CompletionItemKind.Class
            }
        ];

        uri = Uri.file(fileName);
        doc.setup((d) => d.uri).returns(() => uri);
        doc.setup((d) => d.fileName).returns(() => fileName);
        doc.setup((d) => d.isUntitled).returns(() => isUntitled);
        doc.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => '');
        symbolResult.setup((c) => c.requestId).returns(() => requestId);
        symbolResult.setup((c) => c.definitions).returns(() => definitions);
        symbolResult.setup((c: any) => c.then).returns(() => undefined);
        jediHandler
            .setup((j) => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
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
        await Promise.all([testDocumentation(1, 'file1', 1), testDocumentation(2, 'file2', 1)]);
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
        await Promise.all([testDocumentation(1, 'file1', 1), testDocumentation(2, 'file2', 1)]);
    });
    test('Ensure symbols are returned for multiple untitled documents with a debounce of 100ms', async () => {
        provider = new JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        await Promise.all([
            testDocumentation(1, 'file1', 1, undefined, true),
            testDocumentation(2, 'file2', 1, undefined, true)
        ]);
    });
    test('Ensure IFileSystem.arePathsSame is used', async () => {
        doc.setup((d) => d.getText())
            .returns(() => '')
            .verifiable(TypeMoq.Times.once());
        doc.setup((d) => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        doc.setup((d) => d.fileName).returns(() => __filename);

        const symbols = TypeMoq.Mock.ofType<ISymbolResult>();
        symbols.setup((s: any) => s.then).returns(() => undefined);
        const definitions: IDefinition[] = [];
        for (let counter = 0; counter < 3; counter += 1) {
            const def = TypeMoq.Mock.ofType<IDefinition>();
            def.setup((d) => d.fileName).returns(() => counter.toString());
            definitions.push(def.object);

            fileSystem
                .setup((fs) => fs.arePathsSame(TypeMoq.It.isValue(counter.toString()), TypeMoq.It.isValue(__filename)))
                .returns(() => false)
                .verifiable(TypeMoq.Times.exactly(1));
        }
        symbols
            .setup((s) => s.definitions)
            .returns(() => definitions)
            .verifiable(TypeMoq.Times.atLeastOnce());

        jediHandler
            .setup((j) => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
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

suite('Language Server Symbol Provider', () => {
    function createLanguageClient(token: CancellationToken, results: [any, any[]][]): TypeMoq.IMock<LanguageClient> {
        const langClient = TypeMoq.Mock.ofType<LanguageClient>(undefined, TypeMoq.MockBehavior.Strict);
        for (const [doc, symbols] of results) {
            langClient
                .setup((l) =>
                    l.sendRequest(
                        TypeMoq.It.isValue('textDocument/documentSymbol'),
                        TypeMoq.It.isValue(doc),
                        TypeMoq.It.isValue(token)
                    )
                )
                .returns(() => Promise.resolve(symbols))
                .verifiable(TypeMoq.Times.once());
        }
        return langClient;
    }

    function getRawDoc(uri: Uri) {
        return {
            textDocument: {
                uri: uri.toString()
            }
        };
    }

    test('Ensure symbols are returned - simple', async () => {
        const raw = [
            {
                name: 'spam',
                kind: SymbolKind.Array + 1,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                },
                children: []
            }
        ];
        const uri = Uri.file(__filename);
        const expected = createSymbols(uri, [['spam', SymbolKind.Array, 0]]);
        const doc = createDoc(uri);
        const token = new CancellationTokenSource().token;
        const langClient = createLanguageClient(token, [[getRawDoc(uri), raw]]);
        const provider = new LanguageServerSymbolProvider(langClient.object);

        const items = await provider.provideDocumentSymbols(doc.object, token);

        expect(items).to.deep.equal(expected);
        doc.verifyAll();
        langClient.verifyAll();
    });
    test('Ensure symbols are returned - minimal', async () => {
        const uri = Uri.file(__filename);

        // The test data is loosely based on the "full" test.
        const raw = [
            {
                name: 'SpamTests',
                kind: 5,
                range: {
                    start: { line: 2, character: 6 },
                    end: { line: 2, character: 15 }
                },
                children: [
                    {
                        name: 'test_all',
                        kind: 12,
                        range: {
                            start: { line: 3, character: 8 },
                            end: { line: 3, character: 16 }
                        },
                        children: [
                            {
                                name: 'self',
                                kind: 13,
                                range: {
                                    start: { line: 3, character: 17 },
                                    end: { line: 3, character: 21 }
                                },
                                children: []
                            }
                        ]
                    },
                    {
                        name: 'assertTrue',
                        kind: 13,
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 0 }
                        },
                        children: []
                    }
                ]
            }
        ];
        const expected = [
            new SymbolInformation('SpamTests', SymbolKind.Class, '', new Location(uri, new Range(2, 6, 2, 15))),
            new SymbolInformation(
                'test_all',
                SymbolKind.Function,
                'SpamTests',
                new Location(uri, new Range(3, 8, 3, 16))
            ),
            new SymbolInformation('self', SymbolKind.Variable, 'test_all', new Location(uri, new Range(3, 17, 3, 21))),
            new SymbolInformation(
                'assertTrue',
                SymbolKind.Variable,
                'SpamTests',
                new Location(uri, new Range(0, 0, 0, 0))
            )
        ];

        const doc = createDoc(uri);
        const token = new CancellationTokenSource().token;
        const langClient = createLanguageClient(token, [[getRawDoc(uri), raw]]);
        const provider = new LanguageServerSymbolProvider(langClient.object);

        const items = await provider.provideDocumentSymbols(doc.object, token);

        expect(items).to.deep.equal(expected);
    });
    test('Ensure symbols are returned - full', async () => {
        const uri = Uri.file(__filename);

        // This is the raw symbol data returned by the language server which
        // gets converted to SymbolInformation[].  It was captured from an
        // actual VS Code session for a file with the following code:
        //
        //   import unittest
        //
        //   class SpamTests(unittest.TestCase):
        //       def test_all(self):
        //           self.assertTrue(False)
        //
        // See: LanguageServerSymbolProvider.provideDocumentSymbols()
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Change "raw" once the following issues are resolved:
        //  * https://github.com/Microsoft/python-language-server/issues/1
        //  * https://github.com/Microsoft/python-language-server/issues/2
        const raw = JSON.parse(
            '[{"name":"SpamTests","detail":"SpamTests","kind":5,"deprecated":false,"range":{"start":{"line":2,"character":6},"end":{"line":2,"character":15}},"selectionRange":{"start":{"line":2,"character":6},"end":{"line":2,"character":15}},"children":[{"name":"test_all","detail":"test_all","kind":12,"deprecated":false,"range":{"start":{"line":3,"character":4},"end":{"line":4,"character":30}},"selectionRange":{"start":{"line":3,"character":4},"end":{"line":4,"character":30}},"children":[{"name":"self","detail":"self","kind":13,"deprecated":false,"range":{"start":{"line":3,"character":17},"end":{"line":3,"character":21}},"selectionRange":{"start":{"line":3,"character":17},"end":{"line":3,"character":21}},"children":[],"_functionKind":""}],"_functionKind":"function"},{"name":"assertTrue","detail":"assertTrue","kind":13,"deprecated":false,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"selectionRange":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"children":[],"_functionKind":""}],"_functionKind":"class"}]'
        );
        raw[0].children[0].range.start.character = 8;
        raw[0].children[0].range.end.line = 3;
        raw[0].children[0].range.end.character = 16;

        // This is the data from Jedi corresponding to same Python code
        // for which the raw data above was generated.
        // See: JediSymbolProvider.provideDocumentSymbols()
        const expectedRaw = JSON.parse(
            '[{"name":"unittest","kind":1,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":0,"character":7},{"line":0,"character":15}]},"containerName":""},{"name":"SpamTests","kind":4,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":2,"character":0},{"line":4,"character":29}]},"containerName":""},{"name":"test_all","kind":11,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":3,"character":4},{"line":4,"character":29}]},"containerName":"SpamTests"},{"name":"self","kind":12,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":3,"character":17},{"line":3,"character":21}]},"containerName":"test_all"}]'
        );
        expectedRaw[1].location.range[0].character = 6;
        expectedRaw[1].location.range[1].line = 2;
        expectedRaw[1].location.range[1].character = 15;
        expectedRaw[2].location.range[0].character = 8;
        expectedRaw[2].location.range[1].line = 3;
        expectedRaw[2].location.range[1].character = 16;
        const expected = normalizeSymbols(uri, expectedRaw);
        expected.shift(); // For now, drop the "unittest" symbol.
        expected.push(
            new SymbolInformation(
                'assertTrue',
                SymbolKind.Variable,
                'SpamTests',
                new Location(uri, new Range(0, 0, 0, 0))
            )
        );

        const doc = createDoc(uri);
        const token = new CancellationTokenSource().token;
        const langClient = createLanguageClient(token, [[getRawDoc(uri), raw]]);
        const provider = new LanguageServerSymbolProvider(langClient.object);

        const items = await provider.provideDocumentSymbols(doc.object, token);

        expect(items).to.deep.equal(expected);
    });
});

//################################
// helpers

function createDoc(uri?: Uri, filename?: string, isUntitled?: boolean, text?: string): TypeMoq.IMock<TextDocument> {
    const doc = TypeMoq.Mock.ofType<TextDocument>(undefined, TypeMoq.MockBehavior.Strict);
    if (uri !== undefined) {
        doc.setup((d) => d.uri).returns(() => uri);
    }
    if (filename !== undefined) {
        doc.setup((d) => d.fileName).returns(() => filename);
    }
    if (isUntitled !== undefined) {
        doc.setup((d) => d.isUntitled).returns(() => isUntitled);
    }
    if (text !== undefined) {
        doc.setup((d) => d.getText(TypeMoq.It.isAny())).returns(() => text);
    }
    return doc;
}

function createSymbols(uri: Uri, info: [string, SymbolKind, string | number][]): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];
    for (const [fullName, kind, range] of info) {
        const symbol = createSymbol(uri, fullName, kind, range);
        symbols.push(symbol);
    }
    return symbols;
}

function createSymbol(uri: Uri, fullName: string, kind: SymbolKind, rawRange: string | number = ''): SymbolInformation {
    const [containerName, name] = splitParent(fullName);
    const range = parseRange(rawRange);
    const loc = new Location(uri, range);
    return new SymbolInformation(name, kind, containerName, loc);
}

function normalizeSymbols(uri: Uri, raw: any[]): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];
    for (const item of raw) {
        const symbol = new SymbolInformation(
            item.name,
            // Type coercion is a bit fuzzy when it comes to enums, so we
            // play it safe by explicitly converting.
            (SymbolKind as any)[(SymbolKind as any)[item.kind]],
            item.containerName,
            new Location(
                uri,
                new Range(
                    item.location.range[0].line,
                    item.location.range[0].character,
                    item.location.range[1].line,
                    item.location.range[1].character
                )
            )
        );
        symbols.push(symbol);
    }
    return symbols;
}

/**
 * Return [parent name, name] for the given qualified (dotted) name.
 *
 * Examples:
 *  'x.y'   -> ['x', 'y']
 *  'x'     -> ['', 'x']
 *  'x.y.z' -> ['x.y', 'z']
 *  ''      -> ['', '']
 */
export function splitParent(fullName: string): [string, string] {
    if (fullName.length === 0) {
        return ['', ''];
    }
    const pos = fullName.lastIndexOf('.');
    if (pos < 0) {
        return ['', fullName];
    }
    const parentName = fullName.slice(0, pos);
    const name = fullName.slice(pos + 1);
    return [parentName, name];
}
