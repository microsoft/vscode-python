// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { cloneDeep } from 'lodash';
import { IDisposable } from 'monaco-editor';
import { anything, instance, mock, when } from 'ts-mockito';
import { EventEmitter, Memento, Uri } from 'vscode';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');
import type { NotebookDocument } from 'vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../client/common/constants';
import { ICryptoUtils } from '../../../client/common/types';
import { NotebookCellLanguageService } from '../../../client/datascience/notebook/defaultCellLanguageService';
import { createNotebookModel, disposeAllDisposables } from './helper';
// tslint:disable: no-any
suite('DataScience - Default Cell Language Service', () => {
    let notebookCellLanguageService: NotebookCellLanguageService;
    let notebookSaveEmitter: EventEmitter<NotebookDocument>;
    let memento: Memento;
    const disposables: IDisposable[] = [];
    const isNotebookTrusted = true;
    setup(async () => {
        notebookSaveEmitter = new EventEmitter<NotebookDocument>();
        const vscNotebooks = mock<IVSCodeNotebook>();
        when(vscNotebooks.onDidSaveNotebookDocument).thenReturn(notebookSaveEmitter.event);
        memento = mock<Memento>();
        when(memento.get(anything())).thenReturn();
        notebookCellLanguageService = new NotebookCellLanguageService(
            instance(vscNotebooks),
            disposables,
            instance(memento)
        );
        await notebookCellLanguageService.activate();
    });
    teardown(() => disposeAllDisposables(disposables));
    test('Return notebook with 2 cells', async () => {
        const model = createNotebookModel(
            isNotebookTrusted,
            Uri.file('any'),
            instance(mock<Memento>()),
            instance(mock<ICryptoUtils>()),
            {
                cells: [
                    {
                        cell_type: 'code',
                        execution_count: 10,
                        hasExecutionOrder: true,
                        outputs: [],
                        source: 'print(1)',
                        metadata: {}
                    },
                    {
                        cell_type: 'markdown',
                        hasExecutionOrder: false,
                        source: '# HEAD',
                        metadata: {}
                    }
                ]
            }
        );
        when(storageProvider.getOrCreateModel(anything(), anything(), anything(), anything())).thenResolve(model);

        const notebook = await contentProvider.openNotebook(fileUri, {});

        assert.isOk(notebook);
        assert.deepEqual(notebook.languages, [PYTHON_LANGUAGE]);
        // ignore metadata we add.
        const cellsWithoutCustomMetadata = notebook.cells.map((cell) => {
            const cellToCompareWith = cloneDeep(cell);
            delete cellToCompareWith.metadata?.custom;
            return cellToCompareWith;
        });

        assert.equal(notebook.metadata.cellEditable, isNotebookTrusted);
        assert.equal(notebook.metadata.cellRunnable, isNotebookTrusted);
        assert.equal(notebook.metadata.editable, isNotebookTrusted);
        assert.equal(notebook.metadata.runnable, isNotebookTrusted);

        assert.deepEqual(cellsWithoutCustomMetadata, [
            {
                cellKind: (vscodeNotebookEnums as any).CellKind.Code,
                language: PYTHON_LANGUAGE,
                outputs: [],
                source: 'print(1)',
                metadata: {
                    editable: isNotebookTrusted,
                    executionOrder: 10,
                    hasExecutionOrder: true,
                    runState: (vscodeNotebookEnums as any).NotebookCellRunState.Success,
                    runnable: isNotebookTrusted
                }
            },
            {
                cellKind: (vscodeNotebookEnums as any).CellKind.Markdown,
                language: MARKDOWN_LANGUAGE,
                outputs: [],
                source: '# HEAD',
                metadata: {
                    editable: isNotebookTrusted,
                    executionOrder: undefined,
                    hasExecutionOrder: false,
                    runnable: false
                }
            }
        ]);
    });
});
