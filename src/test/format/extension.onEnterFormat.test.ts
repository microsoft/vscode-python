
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
    let editor: vscode.TextEditor;

    suiteSetup(initialize);
    setup(async () => {
        document = await vscode.workspace.openTextDocument(unformattedFile);
        editor = await vscode.window.showTextDocument(document);
    });
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Simple statement', async () => {
        const text = await formatAtPosition(1, 0);
        assert.equal(text, 'x = 1', 'Line was not formatted');
    });

    test('No formatting inside strings', async () => {
        let text = await formatAtPosition(2, 0);
        assert.equal(text, '"""x=1', 'Text inside string was formatted');
        text = await formatAtPosition(3, 0);
        assert.equal(text, '"""', 'Text inside string was formatted');
    });

    test('Whitespace before comment', async () => {
        const text = await formatAtPosition(4, 0);
        assert.equal(text, '  # comment', 'Whitespace before comment was not preserved');
    });

    test('No formatting of comment', async () => {
        const text = await formatAtPosition(5, 0);
        assert.equal(text, '# x=1', 'Text inside comment was formatted');
    });

    test('Formatting line ending in comment', async () => {
        const text = await formatAtPosition(6, 0);
        assert.equal(text, 'x + 1 # ', 'Line ending in comment was not formatted');
    });

    test('Formatting line with @', async () => {
        const text = await formatAtPosition(7, 0);
        assert.equal(text, '@x', 'Line with @ was reformatted');
    });

    test('Formatting line with @', async () => {
        const text = await formatAtPosition(8, 0);
        assert.equal(text, 'x.y', 'Line ending with period was reformatted');
    });

    test('Formatting line with unknown neighboring tokens', async () => {
        const text = await formatAtPosition(9, 0);
        assert.equal(text, 'if x <= 1:', 'Line with unknown neighboring tokens was not formatted');
    });

    test('Formatting line with unknown neighboring tokens', async () => {
        const text = await formatAtPosition(10, 0);
        assert.equal(text, 'if 1 <= x:', 'Line with unknown neighboring tokens was not formatted');
    });

    test('Formatting method definition with arguments', async () => {
        const text = await formatAtPosition(11, 0);
        assert.equal(text, 'def __init__(self, age=23)', 'Method definition with arguments was not formatted');
    });

    test('Formatting space after open brace', async () => {
        const text = await formatAtPosition(12, 0);
        assert.equal(text, 'while(1)', 'Space after open brace was not formatted');
    });

    test('Formatting line ending in string', async () => {
        const text = await formatAtPosition(13, 0);
        assert.equal(text, 'x + """', 'Line ending in multiline string was not formatted');
    });

    async function formatAtPosition(line: number, character: number): Promise<string> {
        const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>('vscode.executeFormatOnTypeProvider',
            document.uri, new vscode.Position(line, character), '\n', { insertSpaces: true, tabSize: 2 });
        if (edits) {
            await editor.edit(builder => edits.forEach(e => builder.replace(e.range, e.newText)));
        }
        return document.lineAt(line - 1).text;
    }
});
