// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unused-variable
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../../client/common/constants';
import { isOs, isPythonVersion, OSType } from '../../../common';
import { closeActiveWindows, initialize, initializeTest } from '../../../initialize';
import { UnitTestIocContainer } from '../../../testing/serviceRegistry';

const autoCompPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'autocomp');
const fileOne = path.join(autoCompPath, 'one.py');
const fileImport = path.join(autoCompPath, 'imp.py');
const fileDoc = path.join(autoCompPath, 'doc.py');
const fileLambda = path.join(autoCompPath, 'lamb.py');
const fileDecorator = path.join(autoCompPath, 'deco.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');
const fileSuppress = path.join(autoCompPath, 'suppress.py');

// tslint:disable-next-line:max-func-body-length
suite('Autocomplete Base Tests', function () {
    // Attempt to fix #1301
    // tslint:disable-next-line:no-invalid-this
    this.timeout(60000);
    let ioc: UnitTestIocContainer;
    let isPy38: boolean;

    suiteSetup(async function () {
        // Attempt to fix #1301
        // tslint:disable-next-line:no-invalid-this
        this.timeout(60000);
        await initialize();
        initializeDI();
        isPy38 = await isPythonVersion('3.8');
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

    test('For "sys."', (done) => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileOne)
            .then((document) => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then(() => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(3, 10);
                return vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    textDocument.uri,
                    position
                );
            })
            .then((list) => {
                assert.equal(
                    list!.items.filter((item) => item.label === 'api_version').length,
                    1,
                    'api_version not found'
                );
            })
            .then(done, done);
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/975
    test('For "import *" find a specific completion for known lib [fstat]', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileImport);
        await vscode.window.showTextDocument(textDocument);
        const lineNum = 1;
        const colNum = 4;
        const position = new vscode.Position(lineNum, colNum);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );

        const indexOfFstat = list!.items.findIndex((val: vscode.CompletionItem) => val.label === 'fstat');

        assert(
            indexOfFstat !== -1,
            `fstat was not found as a completion in ${fileImport} at line ${lineNum}, col ${colNum}`
        );
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/898
    test('For "f.readlines()"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDoc);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(5, 27);
        await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        // These are not known to work, jedi issue
        // assert.equal(list.items.filter(item => item.label === 'capitalize').length, 1, 'capitalize not found (known not to work, Jedi issue)');
        // assert.notEqual(list.items.filter(item => item.label === 'upper').length, 1, 'upper not found');
        // assert.notEqual(list.items.filter(item => item.label === 'lower').length, 1, 'lower not found');
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/265
    test('For "lambda"', async function () {
        if (await isPythonVersion('2')) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
        const textDocument = await vscode.workspace.openTextDocument(fileLambda);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(1, 19);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter((item) => item.label === 'append').length, 0, 'append not found');
        assert.notEqual(list!.items.filter((item) => item.label === 'clear').length, 0, 'clear not found');
        assert.notEqual(list!.items.filter((item) => item.label === 'count').length, 0, 'cound not found');
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/630
    test('For "abc.decorators"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDecorator);
        await vscode.window.showTextDocument(textDocument);
        let position = new vscode.Position(3, 9);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter((item) => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(
            list!.items.filter((item) => item.label === 'abstractmethod').length,
            0,
            'abstractmethod not found'
        );

        position = new vscode.Position(4, 9);
        list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter((item) => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(
            list!.items.filter((item) => item.label === 'abstractmethod').length,
            0,
            'abstractmethod not found'
        );

        position = new vscode.Position(2, 30);
        list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );
        assert.notEqual(list!.items.filter((item) => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(
            list!.items.filter((item) => item.label === 'abstractmethod').length,
            0,
            'abstractmethod not found'
        );
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/727
    // https://github.com/DonJayamanne/pythonVSCode/issues/746
    // https://github.com/davidhalter/jedi/issues/859
    test('For "time.slee"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDoc);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(10, 9);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            textDocument.uri,
            position
        );

        const items = list!.items.filter((item) => item.label === 'sleep');
        assert.notEqual(items.length, 0, 'sleep not found');

        checkDocumentation(items[0], 'Delay execution for a given number of seconds.  The argument may be');
    });

    test('For custom class', (done) => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileOne)
            .then((document) => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then((_editor) => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(30, 4);
                return vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    textDocument.uri,
                    position
                );
            })
            .then((list) => {
                assert.notEqual(list!.items.filter((item) => item.label === 'method1').length, 0, 'method1 not found');
                assert.notEqual(list!.items.filter((item) => item.label === 'method2').length, 0, 'method2 not found');
            })
            .then(done, done);
    });

    test('With Unicode Characters', (done) => {
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileEncoding)
            .then((document) => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then((_editor) => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(25, 4);
                return vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    textDocument.uri,
                    position
                );
            })
            .then((list) => {
                const items = list!.items.filter((item) => item.label === 'bar');
                assert.equal(items.length, 1, 'bar not found');

                const expected1 = '说明 - keep this line, it works';
                checkDocumentation(items[0], expected1);

                const expected2 = '如果存在需要等待审批或正在执行的任务，将不刷新页面';
                checkDocumentation(items[0], expected2);
            })
            .then(done, done);
    });

    test('Across files With Unicode Characters', function (done) {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Fix this test.
        // See https://github.com/microsoft/vscode-python/issues/10399.
        if (isOs(OSType.Windows) && isPy38) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        let textDocument: vscode.TextDocument;
        vscode.workspace
            .openTextDocument(fileEncodingUsed)
            .then((document) => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            })
            .then((_editor) => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                const position = new vscode.Position(1, 5);
                return vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    textDocument.uri,
                    position
                );
            })
            .then((list) => {
                let items = list!.items.filter((item) => item.label === 'Foo');
                assert.equal(items.length, 1, 'Foo not found');
                checkDocumentation(items[0], '说明');

                items = list!.items.filter((item) => item.label === 'showMessage');
                assert.equal(items.length, 1, 'showMessage not found');

                const expected1 =
                    'Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи.';
                checkDocumentation(items[0], expected1);

                const expected2 = 'Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.';
                checkDocumentation(items[0], expected2);
            })
            .then(done, done);
    });

    // https://github.com/Microsoft/vscode-python/issues/110
    test('Suppress in strings/comments', async () => {
        const positions = [
            new vscode.Position(0, 1), // false
            new vscode.Position(0, 9), // true
            new vscode.Position(0, 12), // false
            new vscode.Position(1, 1), // false
            new vscode.Position(1, 3), // false
            new vscode.Position(2, 7), // false
            new vscode.Position(3, 0), // false
            new vscode.Position(4, 2), // false
            new vscode.Position(4, 8), // false
            new vscode.Position(5, 4), // false
            new vscode.Position(5, 10) // false
        ];
        const expected = [false, true, false, false, false, false, false, false, false, false, false];
        const textDocument = await vscode.workspace.openTextDocument(fileSuppress);
        await vscode.window.showTextDocument(textDocument);
        for (let i = 0; i < positions.length; i += 1) {
            const list = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                textDocument.uri,
                positions[i]
            );
            const result = list!.items.filter((item) => item.label === 'abs').length;
            assert.equal(
                result > 0,
                expected[i],
                `Expected ${expected[i]} at position ${positions[i].line}:${positions[i].character} but got ${result}`
            );
        }
    });
});

// tslint:disable-next-line:no-any
function checkDocumentation(item: vscode.CompletionItem, expectedContains: string): void {
    let isValidType = false;
    let documentation: string;

    if (typeof item.documentation === 'string') {
        isValidType = true;
        documentation = item.documentation;
    } else {
        documentation = (item.documentation as vscode.MarkdownString).value;
        isValidType = documentation !== undefined && documentation !== null;
    }
    assert.equal(isValidType, true, 'Documentation is neither string nor vscode.MarkdownString');

    const inDoc = documentation.indexOf(expectedContains) >= 0;
    assert.equal(inDoc, true, 'Documentation incorrect');
}
