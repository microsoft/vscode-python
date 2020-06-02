// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { NotebookModelChange } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditorProvider, INotebookModel } from '../../../client/datascience/types';
import { splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell, createMarkdownCell } from '../../../datascience-ui/common/cellFactory';
import { createEventHandler, IExtensionTestApi, TestEventHandler } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { initialize } from '../../initialize';
import {
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    deleteCell,
    insertMarkdownCell,
    insertPythonCell,
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
        });
    });
});
