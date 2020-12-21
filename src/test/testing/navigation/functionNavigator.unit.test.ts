// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaisAsPromised from 'chai-as-promised';
import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import {
    Location,
    Range,
    SymbolInformation,
    SymbolKind,
    TextDocument,
    TextEditor,
    TextEditorRevealType,
    Uri,
} from 'vscode';
import { DocumentManager } from '../../../client/common/application/documentManager';
import { IDocumentManager } from '../../../client/common/application/types';
import { TestCollectionStorageService } from '../../../client/testing/common/services/storageService';
import { ITestCollectionStorageService } from '../../../client/testing/common/types';
import { TestFunctionCodeNavigator } from '../../../client/testing/navigation/functionNavigator';
import { TestNavigatorHelper } from '../../../client/testing/navigation/helper';
import { ITestNavigatorHelper } from '../../../client/testing/navigation/types';

use(chaisAsPromised);

suite('Unit Tests - Navigation Function', () => {
    let navigator: TestFunctionCodeNavigator;
    let helper: ITestNavigatorHelper;
    let docManager: IDocumentManager;
    let doc: typemoq.IMock<TextDocument>;
    let editor: typemoq.IMock<TextEditor>;
    let storage: ITestCollectionStorageService;
    setup(() => {
        doc = typemoq.Mock.ofType<TextDocument>();
        editor = typemoq.Mock.ofType<TextEditor>();
        helper = mock(TestNavigatorHelper);
        docManager = mock(DocumentManager);
        storage = mock(TestCollectionStorageService);
        navigator = new TestFunctionCodeNavigator(instance(helper), instance(docManager), instance(storage));
    });
    test('Ensure file is opened', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedFn = { parentTestFile: { fullPath: filePath.fsPath }, testFunction: {} };
        when(storage.findFlattendTestFunction(filePath, anything())).thenReturn(flattenedFn as any);

        await navigator.navigateTo(filePath, {} as any);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
    });
    test('Ensure errors are swallowed', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenReject(new Error('kaboom'));
        const flattenedFn = { parentTestFile: { fullPath: filePath.fsPath }, testFunction: {} };
        when(storage.findFlattendTestFunction(filePath, anything())).thenReturn(flattenedFn as any);

        await navigator.navigateTo(filePath, {} as any);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
    });
    async function navigateToFunction(focusCode: boolean) {
        const filePath = Uri.file('some file Path');
        const line = 999;
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedFn = { parentTestFile: { fullPath: filePath.fsPath }, testFunction: { name: 'function_name' } };
        when(storage.findFlattendTestFunction(filePath, anything())).thenReturn(flattenedFn as any);
        const range = new Range(line, 0, line, 0);
        const symbol: SymbolInformation = {
            containerName: '',
            kind: SymbolKind.Function,
            name: 'function_name',
            location: new Location(Uri.file(__filename), range),
        };
        when(helper.findSymbol(doc.object, anything(), anything())).thenResolve(symbol);

        await navigator.navigateTo(filePath, { name: 'function_name' } as any, focusCode);

        verify(helper.openFile(anything())).once();
        verify(helper.findSymbol(doc.object, anything(), anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
        if (focusCode) {
            verify(
                docManager.showTextDocument(doc.object, deepEqual({ preserveFocus: false, selection: range })),
            ).once();
        } else {
            editor.verify((e) => e.revealRange(typemoq.It.isAny(), TextEditorRevealType.Default), typemoq.Times.once());
        }
    }
    test('Ensure we use line number from test function when navigating in file (without focusing code)', async () => {
        await navigateToFunction(false);
    });
    test('Ensure we use line number from test function when navigating in file (focusing code)', async () => {
        await navigateToFunction(true);
    });
    test('Ensure file is opened and range not revealed', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedFn = { parentTestFile: { fullPath: filePath.fsPath }, testFunction: {} };
        when(storage.findFlattendTestFunction(filePath, anything())).thenReturn(flattenedFn as any);
        const search = (s: SymbolInformation) => s.kind === SymbolKind.Function && s.name === 'Hello';
        when(helper.findSymbol(doc.object, search, anything())).thenResolve();

        await navigator.navigateTo(filePath, {} as any);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
        editor.verify((e) => e.revealRange(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
    });
});
