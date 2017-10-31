
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../../client/common/configSettings';
import { execPythonFile } from '../../client/common/utils';
import { initialize, closeActiveWindows, initializeTest } from '../initialize';
import { PythonSettings } from '../../client/common/configSettings';
import { rootWorkspaceUri } from '../common';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const filePep484 = path.join(autoCompPath, 'pep484.py');

suite('Autocomplete PEP 484', () => {
    let isPython3: Promise<boolean>;
    suiteSetup(async () => {
        await initialize();
        const version = await execPythonFile(rootWorkspaceUri, PythonSettings.getInstance(rootWorkspaceUri).pythonPath, ['--version'], __dirname, true);
        isPython3 = Promise.resolve(version.indexOf('3.') >= 0);
    });
    setup(() => initializeTest());
    suiteTeardown(() => closeActiveWindows());
    teardown(() => closeActiveWindows());

    test('argument', async () => {
        if (!await isPython3) {
            return;
        }
        let textDocument = await vscode.workspace.openTextDocument(filePep484);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(2, 27);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    });

    test('return value', async () => {
        if (!await isPython3) {
            return;
        }
        let textDocument = await vscode.workspace.openTextDocument(filePep484);
        await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(8, 6);
        let list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'bit_length').length, 0, 'bit_length not found');
        assert.notEqual(list.items.filter(item => item.label === 'from_bytes').length, 0, 'from_bytes not found');
    });
});
