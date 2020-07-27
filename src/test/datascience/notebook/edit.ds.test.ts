// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { commands, Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { ICell, INotebookEditorProvider, INotebookModel } from '../../../client/datascience/types';
import { splitMultilineString } from '../../../datascience-ui/common';
import { IExtensionTestApi, waitForCondition } from '../../common';
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
    trustAllNotebooks
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
    suiteSetup(async function () {
        this.timeout(10_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await trustAllNotebooks();
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    });
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables));
    [true, false].forEach((isUntitled) => {
        suite(isUntitled ? 'Untitled Notebook' : 'Existing Notebook', () => {
            let model: INotebookModel;
            setup(async () => {
                sinon.restore();
                await trustAllNotebooks();
                // Don't use same file (due to dirty handling, we might save in dirty.)
                // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
                testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));

                // Reset for tests, do this every time, as things can change due to config changes etc.
                const editor = isUntitled ? await editorProvider.createNew() : await editorProvider.open(testIPynb);
                model = editor.model!;
            });
            teardown(() => closeNotebooksAndCleanUpAfterTests(disposables));
            async function assertTextInCell(cell: ICell, text: string) {
                await waitForCondition(
                    async () => (cell.data.source as string[]).join('') === splitMultilineString(text).join(''),
                    1_000,
                    `Text ${text} is not in ${(cell.data.source as string[]).join('')}`
                );
            }
            test('Insert and edit cell', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('HELLO');
                await assertTextInCell(model.cells[0], 'HELLO');
            });

            test('Deleting a cell in an nb should update our NotebookModel', async () => {
                // Delete first cell.
                await deleteCell(0);

                // Verify model state is correct.
                await waitForCondition(async () => model.cells.length === 0, 5_000, 'Not deleted');
            });
            test('Adding a markdown cell in an nb should update our NotebookModel', async () => {
                await insertMarkdownCell('HELLO');

                // Verify model has been updated
                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not inserted');
            });
            test('Adding a markdown cell then deleting it should update our NotebookModel', async () => {
                await insertMarkdownCell('HELLO');

                // Verify events were fired.
                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not inserted');

                // Delete second cell.
                await deleteCell(1);

                await waitForCondition(async () => model.cells.length === 1, 5_000, 'Not Deleted');
            });
            test('Adding a code cell in an nb should update our NotebookModel', async () => {
                await insertPythonCell('HELLO');

                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not Inserted');
            });
            test('Adding a code cell in specific position should update our NotebookModel', async () => {
                await insertPythonCell('HELLO', 1);

                // Verify events were fired.
                await waitForCondition(async () => model.cells.length === 2, 5_000, 'Not Inserted');
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

                await commands.executeCommand('notebook.cell.changeToMarkdown');

                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
            });
            test('Change cell to code', async function () {
                this.timeout(10_000);
                await deleteAllCellsAndWait();
                await insertMarkdownCellAndWait('HELLO');

                await commands.executeCommand('notebook.cell.changeToCode');

                await waitForCondition(async () => assertCodeCell(0, 'HELLO'), 1_000, 'Not Changed');
            });
            test('Toggle cells (code->markdown->code->markdown)', async () => {
                await deleteAllCellsAndWait();
                await insertPythonCellAndWait('HELLO');

                await commands.executeCommand('notebook.cell.changeToMarkdown');

                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');

                await commands.executeCommand('notebook.cell.changeToCode');

                await waitForCondition(async () => assertCodeCell(0, 'HELLO'), 1_000, 'Not Changed');

                await commands.executeCommand('notebook.cell.changeToMarkdown');

                await waitForCondition(async () => assertMarkdownCell(0, 'HELLO'), 1_000, 'Not Changed');
            });
            test('Cut cell', async () => {
                await commands.executeCommand('notebook.cell.cut');

                await waitForCondition(async () => model.cells.length === 0, 5_000, 'Not Cut');
            });
        });
    });
});
