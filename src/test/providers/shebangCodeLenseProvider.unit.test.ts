// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { TextDocument, TextLine, Uri } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PlatformService } from '../../client/common/platform/platformService';
import { IPlatformService } from '../../client/common/platform/types';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

suite('Shebang detection', () => {
    let interpreterService: IInterpreterService;
    let workspaceService: IWorkspaceService;
    let provider: ShebangCodeLensProvider;
    let factory: IProcessServiceFactory;
    let processService: typemoq.IMock<IProcessService>;
    let platformService: typemoq.IMock<PlatformService>;
    setup(() => {
        interpreterService = mock<IInterpreterService>();
        workspaceService = mock(WorkspaceService);
        factory = mock(ProcessServiceFactory);
        processService = typemoq.Mock.ofType<IProcessService>();
        platformService = typemoq.Mock.ofType<IPlatformService>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processService.setup((p) => (p as any).then).returns(() => undefined);
        when(factory.create(anything())).thenResolve(processService.object);
        provider = new ShebangCodeLensProvider(
            instance(factory),
            instance(interpreterService),
            platformService.object,
            instance(workspaceService),
        );
    });
    function createDocument(
        firstLine: string,
        uri = Uri.parse('xyz.py'),
    ): [typemoq.IMock<TextDocument>, typemoq.IMock<TextLine>] {
        const doc = typemoq.Mock.ofType<TextDocument>();
        const line = typemoq.Mock.ofType<TextLine>();

        line.setup((l) => l.isEmptyOrWhitespace)
            .returns(() => firstLine.length === 0)
            .verifiable(typemoq.Times.once());
        line.setup((l) => l.text).returns(() => firstLine);

        doc.setup((d) => d.lineAt(typemoq.It.isValue(0)))
            .returns(() => line.object)
            .verifiable(typemoq.Times.once());
        doc.setup((d) => d.uri).returns(() => uri);

        return [doc, line];
    }
    test('Shebang should be empty when first line is empty when resolving shebang as interpreter', async () => {
        const [document, line] = createDocument('');

        const shebang = await provider.detectShebang(document.object, true);

        document.verifyAll();
        line.verifyAll();
        expect(shebang).to.be.equal(undefined, 'Shebang should be undefined');
    });
    test('Shebang should be empty when first line is empty when not resolving shebang as interpreter', async () => {
        const [document, line] = createDocument('');

        const shebang = await provider.detectShebang(document.object, false);

        document.verifyAll();
        line.verifyAll();
        expect(shebang).to.be.equal(undefined, 'Shebang should be undefined');
    });
    test('Shebang should be returned as it is when not resolving shebang as interpreter', async () => {
        const [document, line] = createDocument('#!HELLO');

        const shebang = await provider.detectShebang(document.object, false);

        document.verifyAll();
        line.verifyAll();
        expect(shebang).to.be.equal('HELLO', 'Shebang should be HELLO');
    });
    test('Shebang should be empty when python path is invalid in shebang', async () => {
        const [document, line] = createDocument('#!HELLO');

        processService
            .setup((p) => p.exec(typemoq.It.isValue('HELLO'), typemoq.It.isAny()))
            .returns(() => Promise.reject())
            .verifiable(typemoq.Times.once());

        const shebang = await provider.detectShebang(document.object, true);

        document.verifyAll();
        line.verifyAll();
        expect(shebang).to.be.equal(undefined, 'Shebang should be undefined');
        processService.verifyAll();
    });
    test('Shebang should be returned when python path is valid', async () => {
        const [document, line] = createDocument('#!HELLO');

        processService
            .setup((p) => p.exec(typemoq.It.isValue('HELLO'), typemoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'THIS_IS_IT' }))
            .verifiable(typemoq.Times.once());

        const shebang = await provider.detectShebang(document.object, true);

        document.verifyAll();
        line.verifyAll();
        expect(shebang).to.be.equal('THIS_IS_IT');
        processService.verifyAll();
    });
    test("Shebang should be returned when python path is valid and text is'/usr/bin/env python'", async () => {
        const [document, line] = createDocument('#!/usr/bin/env python');
        platformService
            .setup((p) => p.isWindows)
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        processService
            .setup((p) => p.exec(typemoq.It.isValue('/usr/bin/env'), typemoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'THIS_IS_IT' }))
            .verifiable(typemoq.Times.once());

        const shebang = await provider.detectShebang(document.object, true);

        document.verifyAll();
        line.verifyAll();
        expect(shebang).to.be.equal('THIS_IS_IT');
        processService.verifyAll();
        platformService.verifyAll();
    });
    test("Shebang should be returned when python path is valid and text is'/usr/bin/env python' and is windows", async () => {
        const [document, line] = createDocument('#!/usr/bin/env python');
        platformService
            .setup((p) => p.isWindows)
            .returns(() => true)
            .verifiable(typemoq.Times.once());
        processService
            .setup((p) => p.exec(typemoq.It.isValue('/usr/bin/env python'), typemoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'THIS_IS_IT' }))
            .verifiable(typemoq.Times.once());

        const shebang = await provider.detectShebang(document.object, true);

        document.verifyAll();
        line.verifyAll();
        expect(shebang).to.be.equal('THIS_IS_IT');
        processService.verifyAll();
        platformService.verifyAll();
    });

    test("No code lens when there's no shebang", async () => {
        const [document] = createDocument('');
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            path: 'python',
        } as unknown) as PythonEnvironment);
        processService
            .setup((p) => p.exec(typemoq.It.isValue('python'), typemoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'python' }))
            .verifiable(typemoq.Times.once());

        provider.detectShebang = () => Promise.resolve('');

        const codeLenses = await provider.provideCodeLenses(document.object);

        expect(codeLenses).to.be.lengthOf(0);
    });
    test('No code lens when shebang is an empty string', async () => {
        const [document] = createDocument('#!');
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            path: 'python',
        } as unknown) as PythonEnvironment);
        processService
            .setup((p) => p.exec(typemoq.It.isValue('python'), typemoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'python' }))
            .verifiable(typemoq.Times.once());

        provider.detectShebang = () => Promise.resolve('');

        const codeLenses = await provider.provideCodeLenses(document.object);

        expect(codeLenses).to.be.lengthOf(0);
    });
    test('No code lens when python path in settings is the same as that in shebang', async () => {
        const [document] = createDocument('#!python');
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            path: 'python',
        } as unknown) as PythonEnvironment);
        processService
            .setup((p) => p.exec(typemoq.It.isValue('python'), typemoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'python' }))
            .verifiable(typemoq.Times.once());

        provider.detectShebang = () => Promise.resolve('python');

        const codeLenses = await provider.provideCodeLenses(document.object);

        expect(codeLenses).to.be.lengthOf(0);
    });
    test('Code lens returned when python path in settings is different to one in shebang', async () => {
        const [document] = createDocument('#!python');
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            path: 'different',
        } as unknown) as PythonEnvironment);
        processService
            .setup((p) => p.exec(typemoq.It.isValue('different'), typemoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'different' }))
            .verifiable(typemoq.Times.once());

        provider.detectShebang = () => Promise.resolve('python');

        const codeLenses = await provider.provideCodeLenses(document.object);

        expect(codeLenses).to.be.lengthOf(1);
        expect(codeLenses[0].command!.command).to.equal('python.setShebangInterpreter');
        expect(codeLenses[0].command!.title).to.equal('Set as interpreter');
        expect(codeLenses[0].range.start.character).to.equal(0);
        expect(codeLenses[0].range.start.line).to.equal(0);
        expect(codeLenses[0].range.end.line).to.equal(0);
    });
});
