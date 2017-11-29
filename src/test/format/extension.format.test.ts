import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationTokenSource } from 'vscode';
import { execPythonFile } from '../../client/common/utils';
import { AutoPep8Formatter } from '../../client/formatters/autoPep8Formatter';
import { YapfFormatter } from '../../client/formatters/yapfFormatter';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const ch = vscode.window.createOutputChannel('Tests');
const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const workspaceRootPath = path.join(__dirname, '..', '..', '..', 'src', 'test');
const originalUnformattedFile = path.join(pythoFilesPath, 'fileToFormat.py');

const autoPep8FileToFormat = path.join(pythoFilesPath, 'autoPep8FileToFormat.py');
const autoPep8FileToAutoFormat = path.join(pythoFilesPath, 'autoPep8FileToAutoFormat.py');
const yapfFileToFormat = path.join(pythoFilesPath, 'yapfFileToFormat.py');
const yapfFileToAutoFormat = path.join(pythoFilesPath, 'yapfFileToAutoFormat.py');

let formattedYapf = '';
let formattedAutoPep8 = '';

suite('Formatting', () => {
    suiteSetup(async () => {
        await initialize();
        [autoPep8FileToFormat, autoPep8FileToAutoFormat, yapfFileToFormat, yapfFileToAutoFormat].forEach(file => {
            fs.copySync(originalUnformattedFile, file, { overwrite: true });
        });
        fs.ensureDirSync(path.dirname(autoPep8FileToFormat));
        const yapf = execPythonFile(workspaceRootPath, 'yapf', [originalUnformattedFile], workspaceRootPath, false);
        const autoPep8 = execPythonFile(workspaceRootPath, 'autopep8', [originalUnformattedFile], workspaceRootPath, false);
        await Promise.all<string>([yapf, autoPep8]).then(formattedResults => {
            formattedYapf = formattedResults[0];
            formattedAutoPep8 = formattedResults[1];
        });
    });
    setup(initializeTest);
    suiteTeardown(async () => {
        [autoPep8FileToFormat, autoPep8FileToAutoFormat, yapfFileToFormat, yapfFileToAutoFormat].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await closeActiveWindows();
    });
    teardown(closeActiveWindows);

    async function testFormatting(formatter: AutoPep8Formatter | YapfFormatter, formattedContents: string, fileToFormat: string) {
        const textDocument = await vscode.workspace.openTextDocument(fileToFormat);
        const textEditor = await vscode.window.showTextDocument(textDocument);
        const options = { insertSpaces: textEditor.options.insertSpaces! as boolean, tabSize: textEditor.options.tabSize! as number };
        const edits = await formatter.formatDocument(textDocument, options, new CancellationTokenSource().token);
        await textEditor.edit(editBuilder => {
            edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
        });
        assert.equal(textEditor.document.getText(), formattedContents, 'Formatted text is not the same');
    }
    test('AutoPep8', () => testFormatting(new AutoPep8Formatter(ch), formattedAutoPep8, autoPep8FileToFormat));

    test('Yapf', () => testFormatting(new YapfFormatter(ch), formattedYapf, yapfFileToFormat));
});
