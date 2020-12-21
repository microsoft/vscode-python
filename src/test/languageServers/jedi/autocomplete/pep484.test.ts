// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { rootWorkspaceUri } from '../../../common';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { UnitTestIocContainer } from '../../../testing/serviceRegistry';

const autoCompPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'autocomp');
const filePep484 = path.join(autoCompPath, 'pep484.py');

suite('Language Server: Autocomplete PEP 484', () => {
    let isPython2: boolean;
    let ioc: UnitTestIocContainer;
    suiteSetup(async function () {
        await initialize();
        initializeDI();
        isPython2 = (await ioc.getPythonMajorVersion(rootWorkspaceUri!)) === 2;
        if (isPython2) {
            this.skip();
            return;
        }
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

    test('argument', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep484);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(2, 27);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position,
        );
        assert.notEqual(list!.items.filter((item) => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list!.items.filter((item) => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list!.items.filter((item) => item.label === 'lower').length, 0, 'lower not found');
    });

    test('return value', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep484);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(8, 6);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position,
        );
        assert.notEqual(list!.items.filter((item) => item.label === 'bit_length').length, 0, 'bit_length not found');
        assert.notEqual(list!.items.filter((item) => item.label === 'from_bytes').length, 0, 'from_bytes not found');
    });
});
