// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { CancellationToken, CancellationTokenSource, Range, SymbolInformation, SymbolKind, TextDocument, Uri } from 'vscode';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { ExecutionResult, IPythonExecutionFactory, IPythonExecutionService } from '../../../client/common/process/types';
import { IDocumentSymbolProvider } from '../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { TestFileSymbolProvider } from '../../../client/testing/navigation/symbolProvider';

// tslint:disable:max-func-body-length no-any
suite('Unit Tests - Navigation Command Handler', () => {
    let symbolProvider: IDocumentSymbolProvider;
    let pythonServiceFactory: IPythonExecutionFactory;
    let pythonService: IPythonExecutionService;
    let doc: typemoq.IMock<TextDocument>;
    let token: CancellationToken;
    setup(() => {
        pythonServiceFactory = mock(PythonExecutionFactory);
        pythonService = mock(PythonExecutionService);
        doc = typemoq.Mock.ofType<TextDocument>();
        token = new CancellationTokenSource().token;
        symbolProvider = new TestFileSymbolProvider(instance(pythonServiceFactory));
    });
    test('Ensure no symbols are returned when file has not been saved', async () => {
        doc.setup(d => d.isUntitled)
            .returns(() => true)
            .verifiable(typemoq.Times.once());

        const symbols = await symbolProvider.provideDocumentSymbols(doc.object, token);

        expect(symbols).to.be.lengthOf(0);
        doc.verifyAll();
    });
    test('Ensure no symbols are returned when there are errors in running the code', async () => {
        doc.setup(d => d.isUntitled)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup(d => d.isDirty)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup(d => d.uri)
            .returns(() => Uri.file(__filename))
            .verifiable(typemoq.Times.atLeastOnce());

        const symbols = await symbolProvider.provideDocumentSymbols(doc.object, token);

        expect(symbols).to.be.lengthOf(0);
        doc.verifyAll();
    });
    test('Ensure no symbols are returned when there are no symbols to be returned', async () => {
        const docUri = Uri.file(__filename);
        const args = [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'symbolProvider.py'), docUri.fsPath];
        const proc: ExecutionResult<string> = {
            stdout: JSON.stringify({ classes: [], methods: [], functions: [] })
        };
        doc.setup(d => d.isUntitled)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup(d => d.isDirty)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup(d => d.uri)
            .returns(() => docUri)
            .verifiable(typemoq.Times.atLeastOnce());
        when(pythonServiceFactory.create(anything())).thenResolve(instance(pythonService));
        when(pythonService.exec(anything(), anything())).thenResolve(proc);
        doc.setup(d => d.isDirty).returns(() => false);
        doc.setup(d => d.uri).returns(() => docUri);

        const symbols = await symbolProvider.provideDocumentSymbols(doc.object, token);

        verify(pythonServiceFactory.create(anything())).once();
        verify(pythonService.exec(deepEqual(args), deepEqual({ throwOnStdErr: true, token }))).once();
        expect(symbols).to.be.lengthOf(0);
        doc.verifyAll();
    });
    test('Ensure symbols are returned', async () => {
        const docUri = Uri.file(__filename);
        const args = [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'symbolProvider.py'), docUri.fsPath];
        const proc: ExecutionResult<string> = {
            stdout: JSON.stringify({
                classes: [
                    {
                        namespace: '1',
                        name: 'one',
                        kind: SymbolKind.Class,
                        range: { start: { line: 1, character: 2 }, end: { line: 3, character: 4 } }
                    }
                ],
                methods: [
                    {
                        namespace: '2',
                        name: 'two',
                        kind: SymbolKind.Class,
                        range: { start: { line: 5, character: 6 }, end: { line: 7, character: 8 } }
                    }
                ],
                functions: [
                    {
                        namespace: '3',
                        name: 'three',
                        kind: SymbolKind.Class,
                        range: { start: { line: 9, character: 10 }, end: { line: 11, character: 12 } }
                    }
                ]
            })
        };
        doc.setup(d => d.isUntitled)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup(d => d.isDirty)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup(d => d.uri)
            .returns(() => docUri)
            .verifiable(typemoq.Times.atLeastOnce());
        when(pythonServiceFactory.create(anything())).thenResolve(instance(pythonService));
        when(pythonService.exec(anything(), anything())).thenResolve(proc);
        doc.setup(d => d.isDirty).returns(() => false);
        doc.setup(d => d.uri).returns(() => docUri);

        const symbols = (await symbolProvider.provideDocumentSymbols(doc.object, token)) as SymbolInformation[];

        verify(pythonServiceFactory.create(anything())).once();
        verify(pythonService.exec(deepEqual(args), deepEqual({ throwOnStdErr: true, token }))).once();
        expect(symbols).to.be.lengthOf(3);
        doc.verifyAll();
        expect(symbols[0].kind).to.be.equal(SymbolKind.Class);
        expect(symbols[0].name).to.be.equal('one');
        expect(symbols[0].location.range).to.be.deep.equal(new Range(1, 2, 3, 4));

        expect(symbols[1].kind).to.be.equal(SymbolKind.Method);
        expect(symbols[1].name).to.be.equal('two');
        expect(symbols[1].location.range).to.be.deep.equal(new Range(5, 6, 7, 8));

        expect(symbols[2].kind).to.be.equal(SymbolKind.Function);
        expect(symbols[2].name).to.be.equal('three');
        expect(symbols[2].location.range).to.be.deep.equal(new Range(9, 10, 11, 12));
    });
});
