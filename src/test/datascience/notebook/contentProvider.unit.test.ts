// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { CellKind, NotebookCellRunState, NotebookContentProvider as VSCodeNotebookContentProvider, Uri } from 'vscode';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../client/common/constants';
import { INotebookStorageProvider } from '../../../client/datascience/interactive-ipynb/notebookStorageProvider';
import { NotebookContentProvider } from '../../../client/datascience/notebook/contentProvider';
import { CellState, INotebookModel } from '../../../client/datascience/types';

suite('Data Science - NativeNotebook ContentProvider', () => {
    let storageProvider: INotebookStorageProvider;
    let contentProvider: VSCodeNotebookContentProvider;
    const fileUri = Uri.file('a.ipynb');
    setup(async () => {
        storageProvider = mock<INotebookStorageProvider>();
        contentProvider = new NotebookContentProvider(instance(storageProvider));
    });

    test('Return notebook with 2 cells', async () => {
        const model: Partial<INotebookModel> = {
            cells: [
                {
                    data: {
                        cell_type: 'code',
                        execution_count: 10,
                        outputs: [],
                        source: 'print(1)',
                        metadata: {}
                    },
                    file: 'a.ipynb',
                    id: 'MyCellId1',
                    line: 0,
                    state: CellState.init
                },
                {
                    data: {
                        cell_type: 'markdown',
                        source: '# HEAD',
                        metadata: {}
                    },
                    file: 'a.ipynb',
                    id: 'MyCellId2',
                    line: 0,
                    state: CellState.init
                }
            ]
        };
        when(storageProvider.load(anything())).thenResolve((model as unknown) as INotebookModel);

        const notebook = await contentProvider.openNotebook(fileUri);

        assert.isOk(notebook);
        assert.deepEqual(notebook.languages, [PYTHON_LANGUAGE, MARKDOWN_LANGUAGE]);
        assert.deepEqual(notebook.cells, [
            {
                cellKind: CellKind.Code,
                language: PYTHON_LANGUAGE,
                outputs: [],
                source: 'print(1)',
                metadata: {
                    editable: true,
                    executionOrder: 10,
                    runState: NotebookCellRunState.Idle,
                    runnable: true,
                    custom: {
                        cellId: 'MyCellId1'
                    }
                }
            },
            {
                cellKind: CellKind.Markdown,
                language: MARKDOWN_LANGUAGE,
                outputs: [],
                source: '# HEAD',
                metadata: {
                    editable: true,
                    executionOrder: undefined,
                    runState: NotebookCellRunState.Idle,
                    runnable: false,
                    custom: {
                        cellId: 'MyCellId2'
                    }
                }
            }
        ]);
    });
    test('Verify mime types and order', () => {
        // https://github.com/microsoft/vscode-python/issues/11880
    });
});
