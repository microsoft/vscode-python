import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PythonSettings } from '../../client/common/configSettings';
import { initialize, closeActiveWindows, IS_TRAVIS, wait, initializeTest } from './../initialize';
import { Position } from 'vscode';
import { extractMethod } from '../../client/providers/simpleRefactorProvider';
import { RefactorProxy } from '../../client/refactor/proxy';
import { getTextEditsFromPatch } from '../../client/common/editor';
import { MockOutputChannel } from './../mockClasses';

const EXTENSION_DIR = path.join(__dirname, '..', '..', '..');
const refactorSourceFile = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFile = path.join(__dirname, '..', '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');

interface RenameResponse {
    results: [{ diff: string }];
}

suite('Method Extraction', () => {
    // Hack hac hack
    const oldExecuteCommand = vscode.commands.executeCommand;
    const options: vscode.TextEditorOptions = { cursorStyle: vscode.TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: vscode.TextEditorLineNumbersStyle.Off, tabSize: 4 };

    suiteSetup(() => {
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        return initialize();
    });
    suiteTeardown(() => {
        vscode.commands.executeCommand = oldExecuteCommand;
        return closeActiveWindows();
    });
    setup(async () => {
        if (fs.existsSync(refactorTargetFile)) {
            await wait(500);
            fs.unlinkSync(refactorTargetFile);
        }
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        await initializeTest();
        (<any>vscode).commands.executeCommand = (cmd) => Promise.resolve();
    });
    teardown(() => {
        vscode.commands.executeCommand = oldExecuteCommand;
        return closeActiveWindows();
    });

    function testingMethodExtraction(shouldError: boolean, startPos: Position, endPos: Position) {
        const pythonSettings = PythonSettings.getInstance(vscode.Uri.file(refactorTargetFile));
        let rangeOfTextToExtract = new vscode.Range(startPos, endPos);
        let proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile));
        let expectedTextEdits: vscode.TextEdit[];
        let ignoreErrorHandling = false;
        let mockTextDoc: vscode.TextDocument;
        const DIFF = `--- a/refactor.py\n+++ b/refactor.py\n@@ -237,9 +237,12 @@\n             try:\n                 self._process_request(self._input.readline())\n             except Exception as ex:\n-                message = ex.message + '  \\n' + traceback.format_exc()\n-                sys.stderr.write(str(len(message)) + ':' + message)\n-                sys.stderr.flush()\n+                self.myNewMethod(ex)\n+\n+    def myNewMethod(self, ex):\n+        message = ex.message + '  \\n' + traceback.format_exc()\n+        sys.stderr.write(str(len(message)) + ':' + message)\n+        sys.stderr.flush()\n \n if __name__ == '__main__':\n     RopeRefactoring().watch()\n`;
        return new Promise<vscode.TextDocument>((resolve, reject) => {
            vscode.workspace.openTextDocument(refactorTargetFile).then(textDocument => {
                mockTextDoc = textDocument;
                expectedTextEdits = getTextEditsFromPatch(textDocument.getText(), DIFF);
                resolve();
            }, error => reject(error));
        })
            .then(() => proxy.extractMethod<RenameResponse>(mockTextDoc, 'myNewMethod', refactorTargetFile, rangeOfTextToExtract, options))
            .then(response => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                let textEdits = getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
                assert.equal(response.results.length, 1, 'Invalid number of items in response');
                assert.equal(textEdits.length, expectedTextEdits.length, 'Invalid number of Text Edits');
                textEdits.forEach(edit => {
                    let foundEdit = expectedTextEdits.filter(item => item.newText === edit.newText && item.range.isEqual(edit.range));
                    assert.equal(foundEdit.length, 1, 'Edit not found');
                });
            }).catch(error => {
                if (ignoreErrorHandling) {
                    return Promise.reject(error);
                }
                if (shouldError) {
                    // Wait a minute this shouldn't work, what's going on
                    assert.equal(true, true, 'Error raised as expected');
                    return;
                }

                return Promise.reject(error);
            });
    }

    test('Extract Method', done => {
        let startPos = new vscode.Position(239, 0);
        let endPos = new vscode.Position(241, 35);
        testingMethodExtraction(false, startPos, endPos).then(() => done(), done);
    });

    test('Extract Method will fail if complete statements are not selected', done => {
        let startPos = new vscode.Position(239, 30);
        let endPos = new vscode.Position(241, 35);
        testingMethodExtraction(true, startPos, endPos).then(() => done(), done);
    });

    function testingMethodExtractionEndToEnd(shouldError: boolean, startPos: Position, endPos: Position) {
        let ch = new MockOutputChannel('Python');
        let textDocument: vscode.TextDocument;
        let textEditor: vscode.TextEditor;
        let rangeOfTextToExtract = new vscode.Range(startPos, endPos);
        let ignoreErrorHandling = false;

        return vscode.workspace.openTextDocument(refactorTargetFile).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            editor.selections = [new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end)];
            editor.selection = new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end);
            textEditor = editor;
            return;
        }).then(() => {
            return extractMethod(EXTENSION_DIR, textEditor, rangeOfTextToExtract, ch).then(() => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                return textEditor.document.save();
            }).then(() => {
                assert.equal(ch.output.length, 0, 'Output channel is not empty');
                assert.equal(textDocument.lineAt(241).text.trim().indexOf('def newmethod'), 0, 'New Method not created');
                assert.equal(textDocument.lineAt(239).text.trim().startsWith('self.newmethod'), true, 'New Method not being used');
            }).catch(error => {
                if (ignoreErrorHandling) {
                    return Promise.reject(error);
                }
                if (shouldError) {
                    // Wait a minute this shouldn't work, what's going on
                    assert.equal(true, true, 'Error raised as expected');
                    return;
                }

                return Promise.reject(error);
            });
        }, error => {
            if (ignoreErrorHandling) {
                return Promise.reject(error);
            }
            if (shouldError) {
                // Wait a minute this shouldn't work, what's going on
                assert.equal(true, true, 'Error raised as expected');
            }
            else {
                assert.fail(error + '', null, 'Method extraction failed\n' + ch.output, '');
                return Promise.reject(error);
            }
        });
    }

    // This test fails on linux (text document not getting updated in time)
    if (!IS_TRAVIS) {
        test('Extract Method (end to end)', done => {
            let startPos = new vscode.Position(239, 0);
            let endPos = new vscode.Position(241, 35);
            testingMethodExtractionEndToEnd(false, startPos, endPos).then(() => done(), done);
        });
    }

    test('Extract Method will fail if complete statements are not selected', done => {
        let startPos = new vscode.Position(239, 30);
        let endPos = new vscode.Position(241, 35);
        testingMethodExtractionEndToEnd(true, startPos, endPos).then(() => done(), done);
    });
});
