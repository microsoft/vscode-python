
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { closeActiveWindows, initialize } from '../initialize';

const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const unformattedFile = path.join(formatFilesPath, 'fileToFormatOnEnter.py');

suite('Formatting - OnEnter provider', () => {
    let document: vscode.TextDocument;

    suiteSetup(initialize);
    setup(async () => {
        document = await vscode.workspace.openTextDocument(unformattedFile);
        await vscode.window.showTextDocument(document);
    });
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Regular string', async () => {
        const edits = await formatAtPosition(1, 0);
        assert.notEqual(edits!.length, 0, 'Line was not formatted');
    });

    test('No formatting inside strings', async () => {
        const edits = await formatAtPosition(2, 0);
        assert.equal(edits!.length, 0, 'Text inside string was formatted');
    });

    test('Whitespace before comment', async () => {
        const edits = await formatAtPosition(4, 0);
        assert.equal(edits!.length, 0, 'Whitespace before comment was formatted');
    });

    test('No formatting of comment', async () => {
        const edits = await formatAtPosition(5, 0);
        assert.equal(edits!.length, 0, 'Text inside comment was formatted');
    });

    test('Formatting line ending in comment', async () => {
        const edits = await formatAtPosition(6, 0);
        assert.notEqual(edits!.length, 0, 'Line ending in comment was not formatted');
    });

    test('Formatting line ending in string', async () => {
        const edits = await formatAtPosition(7, 0);
        assert.notEqual(edits!.length, 0, 'Line ending in multilint string was not formatted');
    });

    async function formatAtPosition(line: number, character: number): Promise<vscode.TextEdit[] | undefined> {
        return await vscode.commands.executeCommand<vscode.TextEdit[]>('vscode.executeFormatOnTypeProvider',
            document.uri, new vscode.Position(line, character), '\n', { insertSpaces: true, tabSize: 2 });
    }
});
