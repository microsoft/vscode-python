// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaisAsPromised from 'chai-as-promised';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Location, Range, SymbolInformation, SymbolKind, TextDocument, TextEditor, TextEditorRevealType, Uri } from 'vscode';
import { TestCollectionStorageService } from '../../../client/unittests/common/services/storageService';
import { ITestCollectionStorageService } from '../../../client/unittests/common/types';
import { TestNavigatorHelper } from '../../../client/unittests/navigation/helper';
import { TestSuiteCodeNavigator } from '../../../client/unittests/navigation/suiteNavigator';
import { ITestNavigatorHelper } from '../../../client/unittests/navigation/types';

use(chaisAsPromised);

// tslint:disable:max-func-body-length no-any
suite('Unit Tests - Navigation Suite', () => {
    let navigator: TestSuiteCodeNavigator;
    let helper: ITestNavigatorHelper;
    let doc: typemoq.IMock<TextDocument>;
    let editor: typemoq.IMock<TextEditor>;
    let storage: ITestCollectionStorageService;
    setup(() => {
        doc = typemoq.Mock.ofType<TextDocument>();
        editor = typemoq.Mock.ofType<TextEditor>();
        helper = mock(TestNavigatorHelper);
        storage = mock(TestCollectionStorageService);
        navigator = new TestSuiteCodeNavigator(instance(helper), instance(storage));
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
    test('Ensure we use line number from test suite when navigating in file', async () => {
        const filePath = Uri.file('some file Path');
        const line = 999;
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedSuite = { parentTestFile: { fullPath: filePath.fsPath }, testSuite: { name: 'suite_name' } };
        when(storage.findFlattendTestSuite(filePath, anything())).thenReturn(flattenedSuite as any);
        const range = new Range(line, 0, line + 1, 0);
        const symbol: SymbolInformation = {
            containerName: '',
            kind: SymbolKind.Class,
            name: 'suite_name',
            location: new Location(Uri.file(__filename), range)
        };
        when(helper.findSymbol(doc.object, anything(), anything())).thenResolve(symbol);

        await navigator.navigateTo(filePath, { name: 'suite_name' } as any);

        verify(helper.openFile(anything())).once();
        verify(helper.findSymbol(doc.object, anything(), anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
        editor.verify(e => e.revealRange(range, TextEditorRevealType.Default), typemoq.Times.once());
    });
    test('Ensure we use line number from test suite when navigating in file', async () => {
        const filePath = Uri.file('some file Path');
        const line = 999;
        when(helper.openFile(anything())).thenResolve([doc.object, editor.object]);
        const flattenedSuite = { parentTestFile: { fullPath: filePath.fsPath }, testSuite: { line } };
        when(storage.findFlattendTestSuite(filePath, anything())).thenReturn(flattenedSuite as any);
        const range = new Range(line, 0, line + 1, 0);

        await navigator.navigateTo(filePath, { line } as any);

        verify(helper.openFile(anything())).once();
        verify(helper.findSymbol(anything(), anything(), anything())).never();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
        editor.verify(e => e.revealRange(range, TextEditorRevealType.Default), typemoq.Times.once());
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
        editor.verify(e => e.revealRange(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.never());
    });
});
