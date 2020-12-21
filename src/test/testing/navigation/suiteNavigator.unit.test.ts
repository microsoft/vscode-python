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
import { TestNavigatorHelper } from '../../../client/testing/navigation/helper';
import { TestSuiteCodeNavigator } from '../../../client/testing/navigation/suiteNavigator';
import { ITestNavigatorHelper } from '../../../client/testing/navigation/types';

use(chaisAsPromised);

// tslint:disable:max-func-body-length no-any
suite('Unit Tests - Navigation Suite', () => {
    let navigator: TestSuiteCodeNavigator;
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
        navigator = new TestSuiteCodeNavigator(instance(helper), instance(docManager), instance(storage));
    });
    test('Ensure file is opened', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedSuite = { parentTestFile: { fullPath: filePath.fsPath }, testSuite: {} };
        when(storage.findFlattendTestSuite(filePath, anything())).thenReturn(flattenedSuite as any);

        await navigator.navigateTo(filePath, {} as any);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
    });
    test('Ensure errors are swallowed', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenReject(new Error('kaboom'));
        const flattenedSuite = { parentTestFile: { fullPath: filePath.fsPath }, testSuite: {} };
        when(storage.findFlattendTestSuite(filePath, anything())).thenReturn(flattenedSuite as any);

        await navigator.navigateTo(filePath, {} as any);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
    });
    async function navigateUsingLineFromSuite(focusCode: boolean) {
        const filePath = Uri.file('some file Path');
        const line = 999;
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedSuite = { parentTestFile: { fullPath: filePath.fsPath }, testSuite: { name: 'suite_name' } };
        when(storage.findFlattendTestSuite(filePath, anything())).thenReturn(flattenedSuite as any);
        const range = new Range(line, 0, line, 0);
        const symbol: SymbolInformation = {
            containerName: '',
            kind: SymbolKind.Class,
            name: 'suite_name',
            location: new Location(Uri.file(__filename), range),
        };
        when(helper.findSymbol(doc.object, anything(), anything())).thenResolve(symbol);

        await navigator.navigateTo(filePath, { name: 'suite_name' } as any, focusCode);

        verify(helper.openFile(anything())).once();
        verify(helper.findSymbol(doc.object, anything(), anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
        if (focusCode) {
            verify(
                docManager.showTextDocument(doc.object, deepEqual({ preserveFocus: false, selection: range })),
            ).once();
        } else {
            editor.verify((e) => e.revealRange(range, TextEditorRevealType.Default), typemoq.Times.once());
        }
    }
    test('Ensure we use line number from test suite when navigating in file (without focusing code)', async () => {
        await navigateUsingLineFromSuite(false);
    });
    test('Ensure we use line number from test suite when navigating in file (focusing code)', async () => {
        await navigateUsingLineFromSuite(true);
    });
    async function navigateFromSuite(focusCode: boolean) {
        const filePath = Uri.file('some file Path');
        const line = 999;
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedSuite = { parentTestFile: { fullPath: filePath.fsPath }, testSuite: { line } };
        when(storage.findFlattendTestSuite(filePath, anything())).thenReturn(flattenedSuite as any);
        const range = new Range(line, 0, line, 0);

        await navigator.navigateTo(filePath, { line } as any, focusCode);

        verify(helper.openFile(anything())).once();
        verify(helper.findSymbol(anything(), anything(), anything())).never();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
        if (focusCode) {
            verify(
                docManager.showTextDocument(doc.object, deepEqual({ preserveFocus: false, selection: range })),
            ).once();
        } else {
            editor.verify((e) => e.revealRange(range, TextEditorRevealType.Default), typemoq.Times.once());
        }
    }
    test('Navigating in file (without focusing code)', async () => {
        await navigateFromSuite(false);
    });
    test('Navigating in file (focusing code)', async () => {
        await navigateFromSuite(true);
    });
    test('Ensure file is opened and range not revealed', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedSuite = { parentTestFile: { fullPath: filePath.fsPath }, testSuite: {} };
        when(storage.findFlattendTestSuite(filePath, anything())).thenReturn(flattenedSuite as any);
        const search = (s: SymbolInformation) => s.kind === SymbolKind.Class && s.name === 'Hello';
        when(helper.findSymbol(doc.object, search, anything())).thenResolve();

        await navigator.navigateTo(filePath, {} as any);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
        editor.verify((e) => e.revealRange(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
    });
});
