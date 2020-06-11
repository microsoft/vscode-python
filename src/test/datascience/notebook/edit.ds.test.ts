// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { commands, Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { NotebookModelChange } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditorProvider, INotebookModel } from '../../../client/datascience/types';
import { splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell, createMarkdownCell } from '../../../datascience-ui/common/cellFactory';
import { createEventHandler, IExtensionTestApi, TestEventHandler, waitForCondition } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { initialize } from '../../initialize';
import {
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    deleteAllCellsAndWait,
    deleteCell,
    insertMarkdownCell,
    insertMarkdownCellAndWait,
    insertPythonCell,
    insertPythonCellAndWait,
    swallowSavingOfNotebooks
} from './helper';

suite('DataScience - VSCode Notebook (Edit)', function () {
    this.timeout(10_000);

    const templateIPynb = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'test.ipynb');
    let handler: TestEventHandler<NotebookModelChange>;
    let testIPynb: Uri;
    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    suiteSetup(async function () {
        this.timeout(10_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    });
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables));
    [true, false].forEach((isUntitled) => {
        suite(isUntitled ? 'Untitled Notebook' : 'Existing Notebook', () => {
            let model: INotebookModel;
            setup(async () => {
                sinon.restore();
                await swallowSavingOfNotebooks();

                // Don't use same file (due to dirty handling, we might save in dirty.)
                // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
                testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));

                // Reset for tests, do this every time, as things can change due to config changes etc.
                const editor = isUntitled ? await editorProvider.createNew() : await editorProvider.open(testIPynb);
                handler = createEventHandler(editor.model!, 'changed', disposables);
                model = editor.model!;
            });
            teardown(() => closeNotebooksAndCleanUpAfterTests(disposables));

            test('Deleting a cell in an nb should trigger updates in our NotebookModel', async () => {
                // Delete first cell.
                await deleteCell(0);

                // Verify events were fired.
                await handler.assertFiredExactly(1);
                assert.equal(handler.first.kind, 'remove', 'Incorrect event fired');

                // Verify model state is correct.
                assert.equal(model.cells.length, 0);
            });
            test('Adding a markdown cell in an nb should trigger updates in our NotebookModel', async () => {
                await insertMarkdownCell('HELLO');

                // Verify events were fired.
                await handler.assertFiredExactly(1);
                assert.equal(handler.first.kind, 'insert', 'Incorrect event fired');
                if (handler.first.kind === 'insert') {
                    const expectedCell = createMarkdownCell(splitMultilineString(['HELLO']), true);
                    assert.equal(handler.first.index, 0);
                    assert.deepEqual(handler.first.cell.data, expectedCell);
                }

                // Verify model has been updated
                assert.equal(model.cells.length, 2);
                assertMarkdownCell(0, 'HELLO');
            });
            test('Adding a markdown cell then deleting it should trigger updates in our NotebookModel', async () => {
                await insertMarkdownCell('HELLO');

                // Verify events were fired.
                await handler.assertFiredExactly(1);
                assert.equal(handler.first.kind, 'insert', 'Incorrect event fired');
                assert.equal(model.cells.length, 2);

                // Delete second cell.
                await deleteCell(1);

                // Verify events were fired.
                await handler.assertFiredExactly(2);
                assert.equal(handler.second.kind, 'remove', 'Incorrect event fired');
                assert.equal(model.cells.length, 1);
            });
            test('Adding a code cell in an nb should trigger updates in our NotebookModel', async () => {
                await insertPythonCell('HELLO');

                // Verify events were fired.
                await handler.assertFiredExactly(1);
                assert.equal(handler.first.kind, 'insert', 'Incorrect event fired');
                if (handler.first.kind === 'insert') {
                    const expectedCell = createCodeCell(['HELLO'], []);
                    assert.equal(handler.first.index, 0);
                    assert.deepEqual(handler.first.cell.data, expectedCell);
                }

                // Verify model has been updated
                assert.equal(model.cells.length, 2);
                assertCodeCell(0, 'HELLO');
            });
            test('Adding a code cell in specific position should trigger updates in our NotebookModel', async () => {
                await insertPythonCell('HELLO', 1);

                // Verify events were fired.
                await handler.assertFiredExactly(1);
                assert.equal(handler.first.kind, 'insert', 'Incorrect event fired');
                if (handler.first.kind === 'insert') {
                    const expectedCell = createCodeCell(['HELLO'], []);
                    assert.equal(handler.first.index, 1);
                    assert.deepEqual(handler.first.cell.data, expectedCell);
                }

                // Verify model has been updated
                assert.equal(model.cells.length, 2);
            });
            function assertCodeCell(index: number, text: string) {
                const cell = model.cells[index];
                assert.equal(cell.data.cell_type, 'code');
                assert.deepEqual(cell.data.source, text === '' ? [''] : splitMultilineString(text));
                return true;
            }
            function assertMarkdownCell(index: number, text?: string) {
                const cell = model.cells[index];
                assert.equal(cell.data.cell_type, 'markdown');
                assert.deepEqual(
                    cell.data.source,
                    text === undefined ? [] : text === '' ? [''] : splitMultilineString(text)
                );
                return true;
            }
            test('Change cell to markdown', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('HELLO');
                handler.reset();

                await commands.executeCommand('notebook.cell.changeToMarkdown');

                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
                assert.isOk(handler.count);
            });
            test('Change cell to code', async function () {
                this.timeout(10_000);
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('HELLO');
                handler.reset();

                await commands.executeCommand('notebook.cell.changeToCode');

                await waitForCondition(async () => assertCodeCell(0, 'HELLO'), 1_000, 'Not Changed');
                assert.isOk(handler.count);
            });
            test('Toggle cells (code->mardown->code->markdown)', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('HELLO');
                handler.reset();

                await commands.executeCommand('notebook.cell.changeToMarkdown');
                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
                assert.isOk(handler.count);

                handler.reset();
                await commands.executeCommand('notebook.cell.changeToCode');
                await waitForCondition(async () => assertCodeCell(0, 'HELLO'), 1_000, 'Not Changed');
                assert.isOk(handler.count);

                handler.reset();
                await commands.executeCommand('notebook.cell.changeToMarkdown');
                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
                assert.isOk(handler.count);
            });
            test('Cut cell', async () => {
                await commands.executeCommand('notebook.cell.cut');

                await handler.assertFiredExactly(1); // cut first cell
                assert.lengthOf(model.cells, 0);
            });
            test('Copy & paste (code cell)', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('HELLO');
                handler.reset();

                await commands.executeCommand('notebook.cell.copy');
                await commands.executeCommand('notebook.cell.paste');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'HELLO');
                assertCodeCell(1, 'HELLO');
            });
            test('Copy & paste (markdown cell)', async () => {
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('HELLO');
                handler.reset();

                await commands.executeCommand('notebook.cell.copy');
                await commands.executeCommand('notebook.cell.paste');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertMarkdownCell(0, 'HELLO');
                assertMarkdownCell(1, 'HELLO');
            });
            test('Copy & paste above', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                await commands.executeCommand('notebook.cell.copy');
                handler.reset();
                const oldCell = model.cells[0];

                await commands.executeCommand('notebook.cell.pasteAbove');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON');
                assertCodeCell(1, 'PYTHON');
                // Verify the previous cell that was in the first index is now in the second place.
                assert.equal(model.cells[1], oldCell);
                // Verify the new cell is a whole new reference.
                assert.notEqual(model.cells[0], oldCell);
            });
            test('Copy & paste below', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                await commands.executeCommand('notebook.cell.copy');
                handler.reset();
                const oldCell = model.cells[0];

                await commands.executeCommand('notebook.cell.paste');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON');
                assertCodeCell(1, 'PYTHON');
                // Verify the previous cell that was in the first index is still in the first place.
                assert.equal(model.cells[0], oldCell);
                // Verify the new cell is a whole new reference.
                assert.notEqual(model.cells[1], oldCell);
            });
            test('Insert code cell above', async () => {
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('MARKDOWN');
                handler.reset();

                await commands.executeCommand('notebook.cell.insertCodeCellAbove');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, '');
                assertMarkdownCell(1, 'MARKDOWN');
            });
            test('Insert code cell below', async () => {
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('MARKDOWN');
                handler.reset();

                await commands.executeCommand('notebook.cell.insertCodeCellBelow');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertMarkdownCell(0, 'MARKDOWN');
                assertCodeCell(1, '');
            });
            test('Insert markdown cell above', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                handler.reset();

                await commands.executeCommand('notebook.cell.insertMarkdownCellAbove');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertMarkdownCell(0);
                assertCodeCell(1, 'PYTHON');
            });
            test('Insert markdown cell below', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                handler.reset();

                await commands.executeCommand('notebook.cell.insertMarkdownCellBelow');

                await handler.assertFiredExactly(1); // paste cell.
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON');
                assertMarkdownCell(1);
            });
            test('Move cell down', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                await insertMarkdownCellAndWait('MARKDOWN', 1);
                assertCodeCell(0, 'PYTHON');
                assertMarkdownCell(1, 'MARKDOWN');

                handler.reset();
                await commands.executeCommand('notebook.cell.moveDown');

                await handler.assertFiredExactly(1); // paste cell.
                assertMarkdownCell(0, 'MARKDOWN');
                assertCodeCell(1, 'PYTHON');
            });
            test('Join cells', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON1');
                await insertPythonCellAndWait('PYTHON2', 1);
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON1');
                assertCodeCell(1, 'PYTHON2');

                handler.reset();
                await commands.executeCommand('notebook.cell.joinBelow');

                await handler.assertFiredExactly(1); // Delete last cell.
                // Bug in VS Code.
                assertCodeCell(0, 'PYTHON1PYTHON2');
            });
        });
    });
});
