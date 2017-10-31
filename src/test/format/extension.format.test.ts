import { updateSetting } from '../common';

// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import { PythonSettings } from '../../client/common/configSettings';
import { AutoPep8Formatter } from '../../client/formatters/autoPep8Formatter';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST, IS_TRAVIS } from '../initialize';
import { YapfFormatter } from '../../client/formatters/yapfFormatter';
import { execPythonFile } from '../../client/common/utils';

const ch = vscode.window.createOutputChannel('Tests');
const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const workspaceRootPath = path.join(__dirname, '..', '..', '..', 'src', 'test');
const originalUnformattedFile = path.join(pythoFilesPath, 'fileToFormat.py');

const autoPep8FileToFormat = path.join(pythoFilesPath, 'autoPep8FileToFormat.py');
const autoPep8FileToAutoFormat = path.join(pythoFilesPath, 'autoPep8FileToAutoFormat.py');
const yapfFileToFormat = path.join(pythoFilesPath, 'yapfFileToFormat.py');
const yapfFileToAutoFormat = path.join(pythoFilesPath, 'yapfFileToAutoFormat.py');

const configUpdateTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;

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
        }).then(() => { });
    });
    setup(() => initializeTest());
    suiteTeardown(async () => {
        [autoPep8FileToFormat, autoPep8FileToAutoFormat, yapfFileToFormat, yapfFileToAutoFormat].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await updateSetting('formatting.formatOnSave', false, vscode.Uri.file(pythoFilesPath), configUpdateTarget)
        await closeActiveWindows();
    });
    teardown(() => closeActiveWindows());

    function testFormatting(formatter: AutoPep8Formatter | YapfFormatter, formattedContents: string, fileToFormat: string): PromiseLike<void> {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileToFormat).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            return formatter.formatDocument(textDocument, null, null);
        }).then(edits => {
            return textEditor.edit(editBuilder => {
                edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
            });
        }).then(edited => {
            assert.equal(textEditor.document.getText(), formattedContents, 'Formatted text is not the same');
        }, reason => {
            assert.fail(reason, undefined, 'Formatting failed', '');
        });
    }
    test('AutoPep8', done => {
        testFormatting(new AutoPep8Formatter(ch), formattedAutoPep8, autoPep8FileToFormat).then(done, done);
    });

    test('Yapf', done => {
        testFormatting(new YapfFormatter(ch), formattedYapf, yapfFileToFormat).then(done, done);
    });

    async function testAutoFormatting(formatter: string, formattedContents: string, fileToFormat: string): Promise<void> {
        await updateSetting('formatting.formatOnSave', true, vscode.Uri.file(fileToFormat), configUpdateTarget);
        await updateSetting('formatting.provider', formatter, vscode.Uri.file(fileToFormat), configUpdateTarget);
        const textDocument = await vscode.workspace.openTextDocument(fileToFormat);
        const editor = await vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const edited = await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), '#\n');
        });
        const saved = await textDocument.save();
        await new Promise<any>((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 5000);
        });
        const text = textDocument.getText();
        assert.equal(text === formattedContents, true, 'Formatted contents are not the same');
    }
    test('AutoPep8 autoformat on save', done => {
        testAutoFormatting('autopep8', `#${EOL}` + formattedAutoPep8, autoPep8FileToAutoFormat).then(done, done);
    });

    // For some reason doesn't ever work on travis
    if (!IS_TRAVIS) {
        test('Yapf autoformat on save', done => {
            testAutoFormatting('yapf', `#${EOL}` + formattedYapf, yapfFileToAutoFormat).then(done, done);
        });
    }
});
