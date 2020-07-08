// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import {
    findMappedNotebookCell,
    findMappedNotebookCellModel
} from '../../../client/datascience/notebook/helpers/cellMappers';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import { canRunTests, closeNotebooksAndCleanUpAfterTests, createTemporaryNotebook } from './helper';

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Open)', function () {
    this.timeout(15_000);
    const templateIPynb = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'withOutput.ipynb'
    );
    let api: IExtensionTestApi;
    let testIPynb: Uri;
    const disposables: IDisposable[] = [];
    suiteSetup(async function () {
        this.timeout(15_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
    });
    setup(async () => {
        sinon.restore();
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
    });
    teardown(async () => closeNotebooksAndCleanUpAfterTests(disposables));

    test('Verify cell mapping', async () => {
        const vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        const editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        const model = (await editorProvider.open(testIPynb))!.model!;

        const notebook = vscodeNotebook.activeNotebookEditor?.document!;

        assert.equal(notebook.cells.length, model?.cells.length, 'Incorrect number of cells');
        for (let index = 0; index < notebook?.cells.length; index += 1) {
            const vscCell = notebook.cells[index];
            const cell = model.cells[index];
            // Given a VS Code Cell, we should be able to find the corresponding ICell.
            assert.equal(cell, findMappedNotebookCellModel(vscCell, model.cells), 'Could not find mapped ICell');

            // Given an ICell, we should be able to find the corresponding VS Code Cell.
            assert.equal(vscCell, findMappedNotebookCell(cell, notebook.cells), 'Could not find mapped NotebookCell');
        }
    });
});
