// Licensed under the MIT License.
// Copyright (c) Microsoft Corporation. All rights reserved.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any

import * as path from 'path';
import * as sinon from 'sinon';
import { Position, Range, Uri, window } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
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
    insertPythonCellAndWait,
    swallowSavingOfNotebooks
} from './helper';

suite('DataScience - VSCode Notebook (Cell Edit Syncing)', function () {
    this.timeout(10_000);

    const templateIPynb = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'empty.ipynb');
    let testIPynb: Uri;
    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    let vscNotebook: IVSCodeNotebook;
    const disposables: IDisposable[] = [];
    suiteSetup(async function () {
        this.timeout(10_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        vscNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
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
                await deleteAllCellsAndWait();
            });
            teardown(() => closeNotebooksAndCleanUpAfterTests(disposables));

            async function assertTextInCell(cell: ICell, text: string) {
                await waitForCondition(
                    async () => (cell.data.source as string[]).join('') === splitMultilineString(text).join(''),
                    1_000,
                    `Source; is not ${text}`
                );
            }
            test('Insert and edit cell', async () => {
                await insertPythonCellAndWait('HELLO');
                const doc = vscNotebook.activeNotebookEditor?.document;
                const cellEditor1 = window.visibleTextEditors.find(
                    (item) => doc?.cells.length && item.document.uri.toString() === doc?.cells[0].uri.toString()
                );
                await assertTextInCell(model.cells[0], 'HELLO');

                // Edit cell.
                await new Promise((resolve) =>
                    cellEditor1?.edit((editor) => {
                        editor.insert(new Position(0, 5), ' WORLD');
                        resolve();
                    })
                );

                await assertTextInCell(model.cells[0], 'HELLO WORLD');

                //Clear cell text.
                await new Promise((resolve) =>
                    cellEditor1?.edit((editor) => {
                        editor.delete(new Range(0, 0, 0, 'HELLO WORLD'.length));
                        resolve();
                    })
                );

                await assertTextInCell(model.cells[0], '');
            });
        });
    });
});
