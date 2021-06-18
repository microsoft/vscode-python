// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as typemoq from 'typemoq';
import {
    CancellationToken,
    CancellationTokenSource,
    Range,
    SymbolInformation,
    SymbolKind,
    TextDocument,
    Uri,
} from 'vscode';
import {
    ExecutionResult,
    IPythonExecutionFactory,
    IPythonExecutionService,
} from '../../../client/common/process/types';
import { IDocumentSymbolProvider } from '../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { TestFileSymbolProvider } from '../../../client/testing/navigation/symbolProvider';

suite('Unit Tests - Navigation Command Handler', () => {
    let symbolProvider: IDocumentSymbolProvider;
    let pythonExecFactory: typemoq.IMock<IPythonExecutionFactory>;
    let pythonService: typemoq.IMock<IPythonExecutionService>;
    let doc: typemoq.IMock<TextDocument>;
    let token: CancellationToken;
    setup(() => {
        pythonService = typemoq.Mock.ofType<IPythonExecutionService>();
        pythonExecFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();

        // Both typemoq and ts-mockito fail to resolve promises on dynamically created mocks
        // A solution is to mock the `then` on the mock that the `Promise` resolves to.
        // typemoq: https://github.com/florinn/typemoq/issues/66#issuecomment-315681245
        // ts-mockito: https://github.com/NagRock/ts-mockito/issues/163#issuecomment-536210863
        // In this case, the factory below returns a promise that is a mock of python service
        // so we need to mock the `then` on the service.
        pythonService.setup((x: any) => x.then).returns(() => undefined);

        pythonExecFactory
            .setup((factory) => factory.create(typemoq.It.isAny()))
            .returns(async () => pythonService.object);

        doc = typemoq.Mock.ofType<TextDocument>();
        token = new CancellationTokenSource().token;
    });
    test('Ensure no symbols are returned when file has not been saved', async () => {
        doc.setup((d) => d.isUntitled)
            .returns(() => true)
            .verifiable(typemoq.Times.once());

        symbolProvider = new TestFileSymbolProvider(pythonExecFactory.object);
        const symbols = await symbolProvider.provideDocumentSymbols(doc.object, token);

        expect(symbols).to.be.lengthOf(0);
        doc.verifyAll();
    });
    test('Ensure no symbols are returned when there are errors in running the code', async () => {
        doc.setup((d) => d.isUntitled)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.isDirty)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.uri)
            .returns(() => Uri.file(__filename))
            .verifiable(typemoq.Times.atLeastOnce());

        pythonService
            .setup((service) => service.exec(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(async () => {
                return { stdout: '' };
            });

        symbolProvider = new TestFileSymbolProvider(pythonExecFactory.object);
        const symbols = await symbolProvider.provideDocumentSymbols(doc.object, token);

        expect(symbols).to.be.lengthOf(0);
        doc.verifyAll();
    });
    test('Ensure no symbols are returned when there are no symbols to be returned', async () => {
        const docUri = Uri.file(__filename);
        const args = [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'symbolProvider.py'), docUri.fsPath];
        const proc: ExecutionResult<string> = {
            stdout: JSON.stringify({ classes: [], methods: [], functions: [] }),
        };
        doc.setup((d) => d.isUntitled)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.isDirty)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.uri)
            .returns(() => docUri)
            .verifiable(typemoq.Times.atLeastOnce());

        pythonService
            .setup((service) => service.exec(typemoq.It.isValue(args), typemoq.It.isAny()))
            .returns(async () => proc)
            .verifiable(typemoq.Times.once());

        symbolProvider = new TestFileSymbolProvider(pythonExecFactory.object);
        const symbols = await symbolProvider.provideDocumentSymbols(doc.object, token);

        expect(symbols).to.be.lengthOf(0);
        doc.verifyAll();
        pythonService.verifyAll();
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
                        range: { start: { line: 1, character: 2 }, end: { line: 3, character: 4 } },
                    },
                ],
                methods: [
                    {
                        namespace: '2',
                        name: 'two',
                        kind: SymbolKind.Class,
                        range: { start: { line: 5, character: 6 }, end: { line: 7, character: 8 } },
                    },
                ],
                functions: [
                    {
                        namespace: '3',
                        name: 'three',
                        kind: SymbolKind.Class,
                        range: { start: { line: 9, character: 10 }, end: { line: 11, character: 12 } },
                    },
                ],
            }),
        };
        doc.setup((d) => d.isUntitled)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.isDirty)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.uri)
            .returns(() => docUri)
            .verifiable(typemoq.Times.atLeastOnce());

        pythonService
            .setup((service) => service.exec(typemoq.It.isValue(args), typemoq.It.isAny()))
            .returns(async () => proc)
            .verifiable(typemoq.Times.once());

        symbolProvider = new TestFileSymbolProvider(pythonExecFactory.object);
        const symbols = (await symbolProvider.provideDocumentSymbols(doc.object, token)) as SymbolInformation[];

        expect(symbols).to.be.lengthOf(3);
        doc.verifyAll();
        pythonService.verifyAll();
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
