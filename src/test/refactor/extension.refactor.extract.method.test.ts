// tslint:disable:interface-name no-any max-func-body-length estrict-plus-operands

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { Position } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { getTextEditsFromPatch } from '../../client/common/editor';
import { extractMethod } from '../../client/providers/simpleRefactorProvider';
import { RefactorProxy } from '../../client/refactor/proxy';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { closeActiveWindows, initialize, initializeTest, IS_TRAVIS, wait } from './../initialize';
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

    let ioc: UnitTestIocContainer;
    suiteSetup(async () => {
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        await initialize();
        initializeDI();
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

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
    }

    function testingMethodExtraction(shouldError: boolean, startPos: Position, endPos: Position) {
        const pythonSettings = PythonSettings.getInstance(vscode.Uri.file(refactorTargetFile));
        const rangeOfTextToExtract = new vscode.Range(startPos, endPos);
        const proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile), ioc.serviceContainer);
        let expectedTextEdits: vscode.TextEdit[];
        let ignoreErrorHandling = false;
        let mockTextDoc: vscode.TextDocument;
        // tslint:disable-next-line:no-multiline-string
        const DIFF = `--- a/refactor.py\n+++ b/refactor.py\n@@ -237,9 +237,12 @@\n             try:\n                 self._process_request(self._input.readline())\n             except Exception as ex:\n-                message = ex.message + '  \\n' + traceback.format_exc()\n-                sys.stderr.write(str(len(message)) + ':' + message)\n-                sys.stderr.flush()\n+                self.myNewMethod(ex)\n+\n+    def myNewMethod(self, ex):\n+        message = ex.message + '  \\n' + traceback.format_exc()\n+        sys.stderr.write(str(len(message)) + ':' + message)\n+        sys.stderr.flush()\n \n if __name__ == '__main__':\n     RopeRefactoring().watch()\n`;
        return new Promise<vscode.TextDocument>((resolve, reject) => {
            vscode.workspace.openTextDocument(refactorTargetFile).then(textDocument => {
                mockTextDoc = textDocument;
                expectedTextEdits = getTextEditsFromPatch(textDocument.getText(), DIFF);
                resolve();
            }, reject);
        })
            .then(() => proxy.extractMethod<RenameResponse>(mockTextDoc, 'myNewMethod', refactorTargetFile, rangeOfTextToExtract, options))
            .then(response => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                const textEdits = getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
                assert.equal(response.results.length, 1, 'Invalid number of items in response');
                assert.equal(textEdits.length, expectedTextEdits.length, 'Invalid number of Text Edits');
                textEdits.forEach(edit => {
                    const foundEdit = expectedTextEdits.filter(item => item.newText === edit.newText && item.range.isEqual(edit.range));
                    assert.equal(foundEdit.length, 1, 'Edit not found');
                });
            }).catch((error: any) => {
                if (ignoreErrorHandling) {
                    return Promise.reject(error!);
                }
                if (shouldError) {
                    // Wait a minute this shouldn't work, what's going on
                    assert.equal(true, true, 'Error raised as expected');
                    return;
                }

                return Promise.reject(error!);
            });
    }

    test('Extract Method', async () => {
        const startPos = new vscode.Position(239, 0);
        const endPos = new vscode.Position(241, 35);
        await testingMethodExtraction(false, startPos, endPos);
    });

    test('Extract Method will fail if complete statements are not selected', async () => {
        const startPos = new vscode.Position(239, 30);
        const endPos = new vscode.Position(241, 35);
        await testingMethodExtraction(true, startPos, endPos);
    });

    function testingMethodExtractionEndToEnd(shouldError: boolean, startPos: Position, endPos: Position) {
        const ch = new MockOutputChannel('Python');
        let textDocument: vscode.TextDocument;
        let textEditor: vscode.TextEditor;
        const rangeOfTextToExtract = new vscode.Range(startPos, endPos);
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
            return extractMethod(EXTENSION_DIR, textEditor, rangeOfTextToExtract, ch, ioc.serviceContainer).then(() => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                return textEditor.document.save();
            }).then(() => {
                assert.equal(ch.output.length, 0, 'Output channel is not empty');
                assert.equal(textDocument.lineAt(241).text.trim().indexOf('def newmethod'), 0, 'New Method not created');
                assert.equal(textDocument.lineAt(239).text.trim().startsWith('self.newmethod'), true, 'New Method not being used');
            }).catch((error: any) => {
                if (ignoreErrorHandling) {
                    return Promise.reject(error!);
                }
                if (shouldError) {
                    // Wait a minute this shouldn't work, what's going on
                    assert.equal(true, true, 'Error raised as expected');
                    return;
                }

                return Promise.reject(error!);
            });
        }, error => {
            if (ignoreErrorHandling) {
                return Promise.reject(error);
            }
            if (shouldError) {
                // Wait a minute this shouldn't work, what's going on
                assert.equal(true, true, 'Error raised as expected');
            } else {
                // tslint:disable-next-line:prefer-template restrict-plus-operands
                assert.fail(error, null, 'Method extraction failed\n' + ch.output, '');
                return Promise.reject(error);
            }
        });
    }

    // This test fails on linux (text document not getting updated in time)
    if (!IS_TRAVIS) {
        test('Extract Method (end to end)', async () => {
            const startPos = new vscode.Position(239, 0);
            const endPos = new vscode.Position(241, 35);
            await testingMethodExtractionEndToEnd(false, startPos, endPos);
        });
    }

    test('Extract Method will fail if complete statements are not selected', async () => {
        const startPos = new vscode.Position(239, 30);
        const endPos = new vscode.Position(241, 35);
        await testingMethodExtractionEndToEnd(true, startPos, endPos);
    });
});
