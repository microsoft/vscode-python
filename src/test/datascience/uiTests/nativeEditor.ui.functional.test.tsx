// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { Disposable } from 'vscode';
import { UseCustomEditor } from '../../../datascience-ui/react-common/constants';
import { mockedVSCodeNamespaces } from '../../vscode-mock';
import { DataScienceIocContainer } from '../dataScienceIocContainer';
import { openNotebook } from './notebookHelpers';
import { NotebookEditorUI } from './notebookUi';

// tslint:disable-next-line: no-var-requires no-require-imports
const sanitize = require('sanitize-filename');

use(chaiAsPromised);

// tslint:disable: no-invalid-this no-any

[false].forEach(useCustomEditorApi => {
    //import { asyncDump } from '../common/asyncDump';
    suite(`${useCustomEditorApi ? 'With' : 'Without'} Custom Editor API`, () => {
        const originalValue_VSC_PYTHON_DS_UI_BROWSER = process.env.VSC_PYTHON_DS_UI_BROWSER;
        const disposables: Disposable[] = [];
        let ioc: DataScienceIocContainer;

        const baseFileJson: nbformat.INotebookContent = {
            cells: [
                {
                    cell_type: 'code',
                    execution_count: 1,
                    metadata: {
                        collapsed: true
                    },
                    outputs: [
                        {
                            data: {
                                'text/plain': ['1']
                            },
                            execution_count: 1,
                            metadata: {},
                            output_type: 'execute_result'
                        }
                    ],
                    source: ['a=1\n', 'a']
                },
                {
                    cell_type: 'code',
                    execution_count: 2,
                    metadata: {},
                    outputs: [
                        {
                            data: {
                                'text/plain': ['2']
                            },
                            execution_count: 2,
                            metadata: {},
                            output_type: 'execute_result'
                        }
                    ],
                    source: ['b=2\n', 'b']
                },
                {
                    cell_type: 'code',
                    execution_count: 3,
                    metadata: {},
                    outputs: [
                        {
                            data: {
                                'text/plain': ['3']
                            },
                            execution_count: 3,
                            metadata: {},
                            output_type: 'execute_result'
                        }
                    ],
                    source: ['c=3\n', 'c']
                }
            ],
            metadata: {
                file_extension: '.py',
                kernelspec: {
                    display_name: 'Python 3',
                    language: 'python',
                    name: 'python3'
                },
                language_info: {
                    codemirror_mode: {
                        name: 'ipython',
                        version: 3
                    },
                    file_extension: '.py',
                    mimetype: 'text/x-python',
                    name: 'python',
                    nbconvert_exporter: 'python',
                    pygments_lexer: 'ipython3',
                    version: '3.7.4'
                },
                mimetype: 'text/x-python',
                name: 'python',
                npconvert_exporter: 'python',
                pygments_lexer: 'ipython3',
                version: 3,
                orig_nbformat: 3
            },
            nbformat: 4,
            nbformat_minor: 2
        };
        const baseFile = JSON.stringify(baseFileJson);
        const addedJSON = baseFileJson;
        addedJSON.cells.splice(3, 0, {
            cell_type: 'code',
            execution_count: null,
            metadata: {},
            outputs: [],
            source: ['a']
        });

        suiteSetup(function() {
            UseCustomEditor.enabled = useCustomEditorApi;
            // tslint:disable-next-line: no-invalid-this
            this.timeout(30_000);
            process.env.VSC_PYTHON_DS_UI_BROWSER = '1';
        });
        suiteTeardown(() => {
            if (originalValue_VSC_PYTHON_DS_UI_BROWSER === undefined) {
                delete process.env.VSC_PYTHON_DS_UI_BROWSER;
            } else {
                process.env.VSC_PYTHON_DS_UI_BROWSER = originalValue_VSC_PYTHON_DS_UI_BROWSER;
            }
        });
        setup(async () => {
            UseCustomEditor.enabled = useCustomEditorApi;
            ioc = new DataScienceIocContainer(true);
            ioc.registerDataScienceTypes(useCustomEditorApi);
            await ioc.activate();
        });
        teardown(async () => {
            sinon.restore();
            mockedVSCodeNamespaces.window?.reset();
            for (const disposable of disposables) {
                if (!disposable) {
                    continue;
                }
                // tslint:disable-next-line:no-any
                const promise = disposable.dispose() as Promise<any>;
                if (promise) {
                    await promise;
                }
            }
            await ioc.dispose();
            mockedVSCodeNamespaces.window?.reset();
            if (originalValue_VSC_PYTHON_DS_UI_BROWSER === undefined) {
                delete process.env.VSC_PYTHON_DS_UI_BROWSER;
            } else {
                process.env.VSC_PYTHON_DS_UI_BROWSER = originalValue_VSC_PYTHON_DS_UI_BROWSER;
            }
        });
        let notebookUi: NotebookEditorUI;
        teardown(async function() {
            if (this.test && this.test.state === 'failed') {
                const imageName = `${sanitize(this.test.fullTitle())}.png`;
                await notebookUi.captureScreenshot(path.join(os.tmpdir(), 'tmp', 'screenshots', imageName));
                // await notebookUi.captureScreenshot(path.join(EXTENSION_ROOT_DIR, 'tmp', 'screenshots', imageName));
            }
        });
        async function openNotebookFile(fileContents: string) {
            const result = await openNotebook(ioc, disposables, fileContents);
            notebookUi = result.notebookUI;
            return result;
        }
        test('Notebook has 3 cells', async () => {
            const { notebookUI } = await openNotebookFile(baseFile);
            await notebookUI.assertCellCount(3);
            await notebookUI.executeCell(0);
        });
    });
});
