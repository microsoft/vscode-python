// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaisAsPromised from 'chai-as-promised';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import {
    CancellationTokenSource,
    DocumentSymbolProvider,
    SymbolInformation,
    SymbolKind,
    TextDocument,
    TextEditor,
    Uri
} from 'vscode';
import { DocumentManager } from '../../../client/common/application/documentManager';
import { IDocumentManager } from '../../../client/common/application/types';
import { LanguageServerSymbolProvider } from '../../../client/providers/symbolProvider';
import { TestNavigatorHelper } from '../../../client/testing/navigation/helper';

use(chaisAsPromised);

// tslint:disable:max-func-body-length no-any
suite('Unit Tests - Navigation Helper', () => {
    let helper: TestNavigatorHelper;
    let docManager: IDocumentManager;
    let doc: typemoq.IMock<TextDocument>;
    let editor: typemoq.IMock<TextEditor>;
    let symbolProvider: DocumentSymbolProvider;
    setup(() => {
        doc = typemoq.Mock.ofType<TextDocument>();
        editor = typemoq.Mock.ofType<TextEditor>();
        doc.setup((d: any) => d.then).returns(() => undefined);
        editor.setup((e: any) => e.then).returns(() => undefined);
        docManager = mock(DocumentManager);
        symbolProvider = mock(LanguageServerSymbolProvider);
        helper = new TestNavigatorHelper(instance(docManager), instance(symbolProvider));
    });
    test('Ensure file is opened', async () => {
        const filePath = Uri.file('some file Path');
        when(docManager.openTextDocument(anything())).thenResolve(doc.object as any);
        when(docManager.showTextDocument(doc.object)).thenResolve(editor.object as any);

        const [d, e] = await helper.openFile(filePath);

        verify(docManager.openTextDocument(filePath)).once();
        verify(docManager.showTextDocument(doc.object)).once();
        expect(d).to.deep.equal(doc.object);
        expect(e).to.deep.equal(editor.object);
    });
    test('No symbols if symbol provider is not registered', async () => {
        const token = new CancellationTokenSource().token;
        const predicate = (s: SymbolInformation) => s.kind === SymbolKind.Function && s.name === '';
        const symbol = await helper.findSymbol(doc.object, predicate, token);
        expect(symbol).to.equal(undefined, 'Must be undefined');
    });
    test('No symbols if no symbols', async () => {
        const token = new CancellationTokenSource().token;
        when(symbolProvider.provideDocumentSymbols(doc.object, token)).thenResolve([] as any);

        const predicate = (s: SymbolInformation) => s.kind === SymbolKind.Function && s.name === '';
        const symbol = await helper.findSymbol(doc.object, predicate, token);

        expect(symbol).to.equal(undefined, 'Must be undefined');
        verify(symbolProvider.provideDocumentSymbols(doc.object, token)).once();
    });
    test('Returns matching symbol', async () => {
        const symbols: SymbolInformation[] = [
            { containerName: '', kind: SymbolKind.Function, name: '1', location: undefined as any },
            { containerName: '', kind: SymbolKind.Class, name: '2', location: undefined as any },
            { containerName: '', kind: SymbolKind.File, name: '2', location: undefined as any }
        ];
        const token = new CancellationTokenSource().token;
        when(symbolProvider.provideDocumentSymbols(doc.object, token)).thenResolve(symbols as any);

        const predicate = (s: SymbolInformation) => s.kind === SymbolKind.Class && s.name === '2';
        const symbol = await helper.findSymbol(doc.object, predicate, token);

        expect(symbol).to.deep.equal(symbols[1]);
        verify(symbolProvider.provideDocumentSymbols(doc.object, token)).once();
    });
});
