// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { isPythonVersion } from '../../../common';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { UnitTestIocContainer } from '../../../testing/serviceRegistry';

const autoCompPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'autocomp');
const filePep526 = path.join(autoCompPath, 'pep526.py');

// tslint:disable-next-line:max-func-body-length
suite('Autocomplete PEP 526', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(async function() {
        // Pep526 only valid for 3.6+ (#2545)
        if (await isPythonVersion('2', '3.4', '3.5')) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }

        await initialize();
        initializeDI();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await ioc.dispose();
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }
    test('variable (abc:str)', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(9, 8);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list!.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list!.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('variable (abc: str = "")', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(8, 14);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list!.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list!.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('variable (abc = UNKNOWN # type: str)', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(7, 14);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list!.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list!.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('class methods', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        let position = new vscode.Position(20, 4);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter(item => item.label === 'a').length, 0, 'method a not found');

        position = new vscode.Position(21, 4);
        list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter(item => item.label === 'b').length, 0, 'method b not found');
    });

    test('class method types', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(21, 6);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter(item => item.label === 'bit_length').length, 0, 'bit_length not found');
    });
});
