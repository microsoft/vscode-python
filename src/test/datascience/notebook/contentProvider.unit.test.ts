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
import type { NotebookContentProvider as VSCodeNotebookContentProvider, NotebookDocument } from 'vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../client/common/constants';
import { ICryptoUtils } from '../../../client/common/types';
import { NotebookContentProvider } from '../../../client/datascience/notebook/contentProvider';
import { NotebookCellLanguageService } from '../../../client/datascience/notebook/defaultCellLanguageService';
import { NotebookEditorCompatibilitySupport } from '../../../client/datascience/notebook/notebookEditorCompatibilitySupport';
import { INotebookStorageProvider } from '../../../client/datascience/notebookStorage/notebookStorageProvider';
import { createNotebookModel, disposeAllDisposables } from './helper';
// tslint:disable: no-any
suite('DataScience - NativeNotebook ContentProvider', () => {
    let storageProvider: INotebookStorageProvider;
    let contentProvider: VSCodeNotebookContentProvider;
    const fileUri = Uri.file('a.ipynb');
    const disposables: IDisposable[] = [];
    setup(async () => {
        storageProvider = mock<INotebookStorageProvider>();
        const compatSupport = mock(NotebookEditorCompatibilitySupport);
        when(compatSupport.canOpenWithOurNotebookEditor(anything())).thenReturn(true);
        when(compatSupport.canOpenWithVSCodeNotebookEditor(anything())).thenReturn(true);
        const vscNotebooks = mock<IVSCodeNotebook>();
        when(vscNotebooks.onDidSaveNotebookDocument).thenReturn(new EventEmitter<NotebookDocument>().event);
        const memento = mock<Memento>();
        when(memento.get(anything())).thenReturn();
        const cellLanguageService = new NotebookCellLanguageService(
            instance(vscNotebooks),
            disposables,
            instance(memento)
        );
        contentProvider = new NotebookContentProvider(
            instance(storageProvider),
            cellLanguageService,
            instance(compatSupport)
        );
    });
    teardown(() => disposeAllDisposables(disposables));
    [true, false].forEach((isNotebookTrusted) => {
        suite(isNotebookTrusted ? 'Trusted Notebook' : 'Un-trusted notebook', () => {
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
                when(storageProvider.getOrCreateModel(anything())).thenResolve(model);

                const notebook = await contentProvider.openNotebook(fileUri, {});

                assert.isOk(notebook);
                assert.deepEqual(notebook.languages, ['*']);
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
                            lastRunDuration: undefined,
                            runStartTime: undefined,
                            runState: (vscodeNotebookEnums as any).NotebookCellRunState.Success,
                            runnable: isNotebookTrusted,
                            statusMessage: undefined
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

            test('Return notebook with csharp language', async () => {
                const model = createNotebookModel(
                    isNotebookTrusted,
                    Uri.file('any'),
                    instance(mock<Memento>()),
                    instance(mock<ICryptoUtils>()),
                    {
                        metadata: {
                            language_info: {
                                name: 'csharp'
                            },
                            orig_nbformat: 5
                        },
                        cells: [
                            {
                                cell_type: 'code',
                                execution_count: 10,
                                hasExecutionOrder: true,
                                outputs: [],
                                source: 'Console.WriteLine("1")',
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
                when(storageProvider.getOrCreateModel(anything())).thenResolve(model);

                const notebook = await contentProvider.openNotebook(fileUri, {});

                assert.isOk(notebook);
                assert.deepEqual(notebook.languages, ['*']);

                assert.equal(notebook.metadata.cellEditable, isNotebookTrusted);
                assert.equal(notebook.metadata.cellRunnable, isNotebookTrusted);
                assert.equal(notebook.metadata.editable, isNotebookTrusted);
                assert.equal(notebook.metadata.runnable, isNotebookTrusted);

                // ignore metadata we add.
                const cellsWithoutCustomMetadata = notebook.cells.map((cell) => {
                    const cellToCompareWith = cloneDeep(cell);
                    delete cellToCompareWith.metadata?.custom;
                    return cellToCompareWith;
                });

                assert.deepEqual(cellsWithoutCustomMetadata, [
                    {
                        cellKind: (vscodeNotebookEnums as any).CellKind.Code,
                        language: 'csharp',
                        outputs: [],
                        source: 'Console.WriteLine("1")',
                        metadata: {
                            editable: isNotebookTrusted,
                            executionOrder: 10,
                            hasExecutionOrder: true,
                            runState: (vscodeNotebookEnums as any).NotebookCellRunState.Success,
                            runnable: isNotebookTrusted,
                            statusMessage: undefined,
                            runStartTime: undefined,
                            lastRunDuration: undefined
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
            test('Verify mime types and order', () => {
                // https://github.com/microsoft/vscode-python/issues/11880
            });
        });
    });
});
