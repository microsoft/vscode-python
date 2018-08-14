import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest, IsLanguageServerTest } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const filePep526 = path.join(autoCompPath, 'pep526.py');

// tslint:disable-next-line:max-func-body-length
suite('Autocomplete PEP 526', () => {
    let isPython2: boolean;
    let ioc: UnitTestIocContainer;
    suiteSetup(async function () {
        // https://github.com/Microsoft/PTVS/issues/3917
        if (IsLanguageServerTest()) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
        initializeDI();
        isPython2 = await ioc.getPythonMajorVersion(rootWorkspaceUri) === 2;
        if (isPython2) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
            return;
        }
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        ioc.dispose();
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
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list!.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list!.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list!.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('variable (abc: str = "")', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(8, 14);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list!.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list!.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list!.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('variable (abc = UNKNOWN # type: str)', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(7, 14);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list!.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list!.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list!.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('class methods', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        let position = new vscode.Position(20, 4);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list!.items.filter(item => item.label === 'a').length, 0, 'method a not found');

        position = new vscode.Position(21, 4);
        list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list!.items.filter(item => item.label === 'b').length, 0, 'method b not found');
    });

    test('class method types', async () => {
        const textDocument = await vscode.workspace.openTextDocument(filePep526);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(21, 6);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list!.items.filter(item => item.label === 'bit_length').length, 0, 'bit_length not found');
    });
});
