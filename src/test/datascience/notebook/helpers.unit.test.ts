// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import type { CellOutput } from 'vscode-proposed';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../client/common/constants';
import { notebookModelToVSCNotebookData } from '../../../client/datascience/notebook/helpers';
import { CellState, INotebookModel } from '../../../client/datascience/types';

suite('Data Science - NativeNotebook helpers', () => {
    test('Convert NotebookModel to VSCode NotebookData', async () => {
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

        const notebook = notebookModelToVSCNotebookData((model as unknown) as INotebookModel);

        assert.isOk(notebook);
        assert.deepEqual(notebook.languages, [PYTHON_LANGUAGE, MARKDOWN_LANGUAGE]);
        assert.deepEqual(notebook.cells, [
            {
                cellKind: vscodeNotebookEnums.CellKind.Code,
                language: PYTHON_LANGUAGE,
                outputs: [],
                source: 'print(1)',
                metadata: {
                    editable: true,
                    executionOrder: 10,
                    hasExecutionOrder: true,
                    runState: vscodeNotebookEnums.NotebookCellRunState.Idle,
                    runnable: true,
                    custom: {
                        cellId: 'MyCellId1'
                    }
                }
            },
            {
                cellKind: vscodeNotebookEnums.CellKind.Markdown,
                language: MARKDOWN_LANGUAGE,
                outputs: [],
                source: '# HEAD',
                metadata: {
                    editable: true,
                    executionOrder: undefined,
                    hasExecutionOrder: false,
                    runState: vscodeNotebookEnums.NotebookCellRunState.Idle,
                    runnable: false,
                    custom: {
                        cellId: 'MyCellId2'
                    }
                }
            }
        ]);
    });
    suite('Outputs', () => {
        function validateCellOutputTranslation(outputs: nbformat.IOutput[], expectedOutputs: CellOutput[]) {
            const model: Partial<INotebookModel> = {
                cells: [
                    {
                        data: {
                            cell_type: 'code',
                            execution_count: 10,
                            outputs,
                            source: 'print(1)',
                            metadata: {}
                        },
                        file: 'a.ipynb',
                        id: 'MyCellId1',
                        line: 0,
                        state: CellState.init
                    }
                ]
            };
            const notebook = notebookModelToVSCNotebookData((model as unknown) as INotebookModel);

            assert.deepEqual(notebook.cells[0].outputs, expectedOutputs);
        }
        test('Empty output', () => {
            validateCellOutputTranslation([], []);
        });
        test('Stream output', () => {
            validateCellOutputTranslation(
                [
                    {
                        output_type: 'stream',
                        name: 'stderr',
                        text: 'Error'
                    },
                    {
                        output_type: 'stream',
                        name: 'stdout',
                        text: 'NoError'
                    }
                ],
                [
                    {
                        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                        data: { 'text/plain': 'Error' }
                    },
                    {
                        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                        data: { 'text/plain': 'NoError' }
                    }
                ]
            );
        });
        test('Streamed text with Ansi characters', async () => {
            validateCellOutputTranslation(
                [
                    {
                        name: 'stderr',
                        text: '\u001b[K\u001b[33m✅ \u001b[0m Loading\n',
                        output_type: 'stream'
                    }
                ],
                [
                    {
                        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                        data: {
                            'text/plain': '\u001b[K\u001b[33m✅ \u001b[0m Loading\n'
                        }
                    }
                ]
            );
        });
        test('Streamed text with angle bracket characters', async () => {
            validateCellOutputTranslation(
                [
                    {
                        name: 'stderr',
                        text: '1 is < 2',
                        output_type: 'stream'
                    }
                ],
                [
                    {
                        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                        data: {
                            'text/plain': '1 is < 2'
                        }
                    }
                ]
            );
        });
        test('Streamed text with angle bracket characters and ansi chars', async () => {
            validateCellOutputTranslation(
                [
                    {
                        name: 'stderr',
                        text: '1 is < 2\u001b[K\u001b[33m✅ \u001b[0m Loading\n',
                        output_type: 'stream'
                    }
                ],
                [
                    {
                        outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                        data: {
                            'text/plain': '1 is < 2\u001b[K\u001b[33m✅ \u001b[0m Loading\n'
                        }
                    }
                ]
            );
        });
        test('Error', async () => {
            validateCellOutputTranslation(
                [
                    {
                        ename: 'Error Name',
                        evalue: 'Error Value',
                        traceback: ['stack1', 'stack2', 'stack3'],
                        output_type: 'error'
                    }
                ],
                [
                    {
                        outputKind: vscodeNotebookEnums.CellOutputKind.Error,
                        ename: 'Error Name',
                        evalue: 'Error Value',
                        traceback: ['stack1', 'stack2', 'stack3']
                    }
                ]
            );
        });

        ['display_data', 'execute_result'].forEach((output_type) => {
            suite(`Rich output for outputtype = ${output_type}`, () => {
                test('Text mimetype output', async () => {
                    validateCellOutputTranslation(
                        [
                            {
                                data: {
                                    'text/plain': 'Hello World!'
                                },
                                output_type
                            }
                        ],
                        [
                            {
                                outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                                data: {
                                    'text/plain': 'Hello World!'
                                }
                            }
                        ]
                    );
                });

                test('png,jpeg images', async () => {
                    validateCellOutputTranslation(
                        [
                            {
                                data: {
                                    'image/png': 'base64PNG',
                                    'image/jpeg': 'base64JPEG'
                                },
                                output_type
                            }
                        ],
                        [
                            {
                                outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                                data: {
                                    'image/png': 'base64PNG',
                                    'image/jpeg': 'base64JPEG'
                                }
                            }
                        ]
                    );
                });
                test('png image with a light background', async () => {
                    validateCellOutputTranslation(
                        [
                            {
                                data: {
                                    'image/png': 'base64PNG'
                                },
                                metadata: {
                                    needs_background: 'light'
                                },
                                output_type
                            }
                        ],
                        [
                            {
                                outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                                data: {
                                    'text/html':
                                        '<div class=\'display\' style="overflow:scroll;background-color:white;"><img src="data:image/png;base64,base64PNG"   ></div>',
                                    'image/png': 'base64PNG'
                                }
                            }
                        ]
                    );
                });
                test('png image with a dark background', async () => {
                    validateCellOutputTranslation(
                        [
                            {
                                data: {
                                    'image/png': 'base64PNG'
                                },
                                metadata: {
                                    needs_background: 'dark'
                                },
                                output_type
                            }
                        ],
                        [
                            {
                                outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                                data: {
                                    'text/html':
                                        '<div class=\'display\' style="overflow:scroll;background-color:black;"><img src="data:image/png;base64,base64PNG"   ></div>',
                                    'image/png': 'base64PNG'
                                }
                            }
                        ]
                    );
                });
                test('png image with custom dimensionns', async () => {
                    validateCellOutputTranslation(
                        [
                            {
                                data: {
                                    'image/png': 'base64PNG'
                                },
                                metadata: {
                                    'image/png': { height: '111px', width: '999px' }
                                },
                                output_type
                            }
                        ],
                        [
                            {
                                outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                                data: {
                                    'text/html':
                                        '<div class=\'display\' style="overflow:scroll;"><img src="data:image/png;base64,base64PNG"  height=111px width=999px></div>',
                                    'image/png': 'base64PNG'
                                }
                            }
                        ]
                    );
                });
                test('png allowed to scroll', async () => {
                    validateCellOutputTranslation(
                        [
                            {
                                data: {
                                    'image/png': 'base64PNG'
                                },
                                metadata: {
                                    unconfined: true,
                                    'image/png': { width: '999px' }
                                },
                                output_type
                            }
                        ],
                        [
                            {
                                outputKind: vscodeNotebookEnums.CellOutputKind.Rich,
                                data: {
                                    'text/html':
                                        '<div class=\'display\' style="overflow:scroll;"><img src="data:image/png;base64,base64PNG"   width=999px></div>',
                                    'image/png': 'base64PNG'
                                }
                            }
                        ]
                    );
                });
            });
        });
    });
});
