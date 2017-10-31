// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { EOL } from 'os';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../../client/common/configSettings';
import { initialize, closeActiveWindows, initializeTest } from '../initialize';
import { execPythonFile } from '../../client/common/utils';
import { PythonSettings } from '../../client/common/configSettings';
import { rootWorkspaceUri } from '../common';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const fileOne = path.join(autoCompPath, 'one.py');
const fileImport = path.join(autoCompPath, 'imp.py');
const fileDoc = path.join(autoCompPath, 'doc.py');
const fileLambda = path.join(autoCompPath, 'lamb.py');
const fileDecorator = path.join(autoCompPath, 'deco.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');

suite('Autocomplete', () => {
    let isPython3: Promise<boolean>;
    suiteSetup(async () => {
        await initialize();
        const version = await execPythonFile(rootWorkspaceUri, PythonSettings.getInstance(rootWorkspaceUri).pythonPath, ['--version'], __dirname, true);
        isPython3 = Promise.resolve(version.indexOf('3.') >= 0);
    });
    setup(() => initializeTest());
    suiteTeardown(() => closeActiveWindows());
    teardown(() => closeActiveWindows());

    test('For "sys."', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(3, 10);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.equal(list.items.filter(item => item.label === 'api_version').length, 1, 'api_version not found');
        }).then(done, done);
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/975
    test('For "import *"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileImport);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(1, 4);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.equal(list.items.filter(item => item.label === 'fstat').length, 1, 'fstat not found');
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/898
    test('For "f.readlines()"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDoc);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(5, 27);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        // These are not known to work, jedi issue
        // assert.equal(list.items.filter(item => item.label === 'capitalize').length, 1, 'capitalize not found (known not to work, Jedi issue)');
        // assert.notEqual(list.items.filter(item => item.label === 'upper').length, 1, 'upper not found');
        // assert.notEqual(list.items.filter(item => item.label === 'lower').length, 1, 'lower not found');
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/265
    test('For "lambda"', async () => {
        if (!await isPython3) {
            return;
        }
        const textDocument = await vscode.workspace.openTextDocument(fileLambda);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(1, 19);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'append').length, 0, 'append not found');
        assert.notEqual(list.items.filter(item => item.label === 'clear').length, 0, 'clear not found');
        assert.notEqual(list.items.filter(item => item.label === 'count').length, 0, 'cound not found');
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/630
    test('For "abc.decorators"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDecorator);
        await vscode.window.showTextDocument(textDocument);
        let position = new vscode.Position(3, 9);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(list.items.filter(item => item.label === 'abstractmethod').length, 0, 'abstractmethod not found');

        position = new vscode.Position(4, 9);
        list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(list.items.filter(item => item.label === 'abstractmethod').length, 0, 'abstractmethod not found');

        position = new vscode.Position(2, 30);
        list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(list.items.filter(item => item.label === 'abstractmethod').length, 0, 'abstractmethod not found');
    });

    // https://github.com/DonJayamanne/pythonVSCode/issues/727
    // https://github.com/DonJayamanne/pythonVSCode/issues/746
    // https://github.com/davidhalter/jedi/issues/859
    test('For "time.slee"', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDoc);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(10, 9);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'sleep').length, 0, 'sleep not found');
        assert.notEqual(list.items.filter(item => item.documentation.toString().startsWith("Delay execution for a given number of seconds.  The argument may be")).length, 0, 'Documentation incorrect');
    });

    test('For custom class', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(30, 4);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.notEqual(list.items.filter(item => item.label === 'method1').length, 0, 'method1 not found');
            assert.notEqual(list.items.filter(item => item.label === 'method2').length, 0, 'method2 not found');
        }).then(done, done);
    });

    test('With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(25, 4);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.equal(list.items.filter(item => item.label === 'bar').length, 1, 'bar not found');
            const documentation = `说明 - keep this line, it works${EOL}delete following line, it works${EOL}如果存在需要等待审批或正在执行的任务，将不刷新页面`;
            assert.equal(list.items.filter(item => item.label === 'bar')[0].documentation, documentation, 'unicode documentation is incorrect');
        }).then(done, done);
    });

    test('Across files With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 5);
            return vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.equal(list.items.filter(item => item.label === 'Foo').length, 1, 'Foo not found');
            assert.equal(list.items.filter(item => item.label === 'Foo')[0].documentation, '说明', 'Foo unicode documentation is incorrect');

            assert.equal(list.items.filter(item => item.label === 'showMessage').length, 1, 'showMessage not found');
            const documentation = `Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи. ${EOL}Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.`;
            assert.equal(list.items.filter(item => item.label === 'showMessage')[0].documentation, documentation, 'showMessage unicode documentation is incorrect');
        }).then(done, done);
    });
});
