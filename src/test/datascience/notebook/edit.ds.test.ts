// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { commands, Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { INotebookModelChange } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditor, INotebookEditorProvider, INotebookModel } from '../../../client/datascience/types';
import { splitMultilineString } from '../../../datascience-ui/common';
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

    const templateIPynb = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'test.ipynb'
    );
    let testIPynb: Uri;
    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let editedEvent: TestEventHandler<INotebookEditor>;
    let changedEvent: TestEventHandler<INotebookModelChange>;
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
                model = editor.model!;

                editedEvent = createEventHandler(editorProvider.activeEditor!, 'modified', disposables);
                changedEvent = createEventHandler(editorProvider.activeEditor!.model!, 'changed', disposables);
            });
            teardown(() => closeNotebooksAndCleanUpAfterTests(disposables));

            test('Deleting a cell in an nb should update our NotebookModel', async () => {
                // Delete first cell.
                await deleteCell(0);

                // Verify model state is correct.
                await waitForCondition(async () => model.cells.length === 0, 5_000, 'Not deleted');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Adding a markdown cell in an nb should update our NotebookModel', async () => {
                await insertMarkdownCell('HELLO');

                // Verify model has been updated
                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not inserted');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Adding a markdown cell then deleting it should update our NotebookModel', async () => {
                await insertMarkdownCell('HELLO');

                // Verify events were fired.
                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not inserted');

                await editedEvent.assertFired();
                await changedEvent.assertFired();

                // Delete second cell.
                editedEvent.reset();
                changedEvent.reset();
                await deleteCell(1);

                await waitForCondition(async () => model.cells.length === 1, 5_000, 'Not Deleted');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Adding a code cell in an nb should update our NotebookModel', async () => {
                await insertPythonCell('HELLO');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not Inserted');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Adding a code cell in specific position should update our NotebookModel', async () => {
                await insertPythonCell('HELLO', 1);

                // Verify events were fired.
                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not Inserted');
                assert.equal(model.cells.length, 2);
                await editedEvent.assertFired();
                await changedEvent.assertFired();
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

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.changeToMarkdown');

                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Change cell to code', async function () {
                this.timeout(10_000);
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('HELLO');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.changeToCode');

                await waitForCondition(async () => assertCodeCell(0, 'HELLO'), 1_000, 'Not Changed');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Toggle cells (code->mardown->code->markdown)', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('HELLO');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.changeToMarkdown');

                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
                await editedEvent.assertFired();
                await changedEvent.assertFired();

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.changeToCode');

                await waitForCondition(async () => assertCodeCell(0, 'HELLO'), 1_000, 'Not Changed');
                await editedEvent.assertFired();
                await changedEvent.assertFired();

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.changeToMarkdown');

                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Cut cell', async () => {
                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.cut');

                await waitForCondition(async () => model.cells.length === 0, 5_000, 'Not Cut');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Copy & paste (code cell)', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('HELLO');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.copy');
                await commands.executeCommand('notebook.cell.paste');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'HELLO');
                assertCodeCell(1, 'HELLO');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Copy & paste (markdown cell)', async () => {
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('HELLO');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.copy');
                await commands.executeCommand('notebook.cell.paste');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertMarkdownCell(0, 'HELLO');
                assertMarkdownCell(1, 'HELLO');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Copy & paste above', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                await commands.executeCommand('notebook.cell.copy');
                const oldCell = model.cells[0];

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.pasteAbove');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON');
                assertCodeCell(1, 'PYTHON');
                // Verify the previous cell that was in the first index is now in the second place.
                assert.equal(model.cells[1], oldCell);
                // Verify the new cell is a whole new reference.
                assert.notEqual(model.cells[0], oldCell);
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Copy & paste below', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                await commands.executeCommand('notebook.cell.copy');
                const oldCell = model.cells[0];

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.paste');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON');
                assertCodeCell(1, 'PYTHON');
                // Verify the previous cell that was in the first index is still in the first place.
                assert.equal(model.cells[0], oldCell);
                // Verify the new cell is a whole new reference.
                assert.notEqual(model.cells[1], oldCell);
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Insert code cell above', async () => {
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('MARKDOWN');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.insertCodeCellAbove');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, '');
                assertMarkdownCell(1, 'MARKDOWN');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Insert code cell below', async () => {
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('MARKDOWN');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.insertCodeCellBelow');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertMarkdownCell(0, 'MARKDOWN');
                assertCodeCell(1, '');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Insert markdown cell above', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.insertMarkdownCellAbove');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertMarkdownCell(0);
                assertCodeCell(1, 'PYTHON');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Insert markdown cell below', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.insertMarkdownCellBelow');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not pasted');
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON');
                assertMarkdownCell(1);
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Move cell down', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON');
                await insertMarkdownCellAndWait('MARKDOWN', 1);
                assertCodeCell(0, 'PYTHON');
                assertMarkdownCell(1, 'MARKDOWN');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.moveDown');

                await waitForCondition(async () => assertMarkdownCell(0, 'MARKDOWN'), 5_000, 'Not pasted');
                assertCodeCell(1, 'PYTHON');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
            test('Join cells', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('PYTHON1');
                await insertPythonCellAndWait('PYTHON2', 1);
                assert.lengthOf(model.cells, 2);
                assertCodeCell(0, 'PYTHON1');
                assertCodeCell(1, 'PYTHON2');

                editedEvent.reset();
                changedEvent.reset();
                await commands.executeCommand('notebook.cell.joinBelow');

                await waitForCondition(async () => assertCodeCell(0, 'PYTHON1\nPYTHON2'), 5_000, 'Not pasted');
                await editedEvent.assertFired();
                await changedEvent.assertFired();
            });
        });
    });
});
