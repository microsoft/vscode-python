// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Disposable } from 'vscode';

import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { IFileSystem } from '../../client/common/platform/types';
import { JupyterExecution } from '../../client/datascience/jupyterExecution';
import { IConnectionInfo, JupyterProcess } from '../../client/datascience/jupyterProcess';
import { IJupyterExecution, INotebookImporter, INotebookProcess, INotebookServer } from '../../client/datascience/types';
import { Cell, ICellViewModel } from '../../datascience-ui/history-react/cell';
import { generateTestState } from '../../datascience-ui/history-react/mainPanelState';
import { DataScienceIocContainer } from './dataScienceIocContainer';

// tslint:disable:no-any no-multiline-string max-func-body-length no-console
suite('Jupyter notebook tests', () => {
    const disposables: Disposable[] = [];
    let jupyterExecution: IJupyterExecution;
    let jupyterServer : INotebookServer;
    let ioc: DataScienceIocContainer;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        jupyterServer = ioc.serviceManager.get<INotebookServer>(INotebookServer);
        jupyterExecution = ioc.serviceManager.get<IJupyterExecution>(IJupyterExecution);
    });

    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
        jupyterServer.dispose();
        ioc.dispose();
    });

    function escapePath(p: string) {
        return p.replace(/\\/g, '\\\\');
    }

    function srcDirectory() {
        return path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
    }

    async function assertThrows(func : () => Promise<void>, message: string) {
        try  {
            await func();
            assert.fail(message);
        // tslint:disable-next-line:no-empty
        } catch {
        }
    }

    async function verifySimple(code: string, expectedValue: any) : Promise<void> {
        const cells = await jupyterServer.execute(code, path.join(srcDirectory(), 'foo.py'), 2);
        assert.equal(cells.length, 1, `Wrong number of cells returned`);
        assert.equal(cells[0].data.cell_type, 'code', `Wrong type of cell returned`);
        const cell = cells[0].data as nbformat.ICodeCell;
        assert.equal(cell.outputs.length, 1, `Cell length not correct`);
        const data = cell.outputs[0].data;
        const error = cell.outputs[0].evalue;
        if (error) {
            assert.fail(`Unexpected error: ${error}`);
        }
        assert.ok(data, `No data object on the cell`);
        if (data) { // For linter
            assert.ok(data.hasOwnProperty('text/plain'), `Cell mime type not correct`);
            assert.ok(data['text/plain'], `Cell mime type not correct`);
            assert.equal(data['text/plain'], expectedValue, 'Cell value does not match');
        }
    }

    async function verifyError(code: string, errorString: string) : Promise<void> {
        const cells = await jupyterServer.execute(code, path.join(srcDirectory(), 'foo.py'), 2);
        assert.equal(cells.length, 1, `Wrong number of cells returned`);
        assert.equal(cells[0].data.cell_type, 'code', `Wrong type of cell returned`);
        const cell = cells[0].data as nbformat.ICodeCell;
        assert.equal(cell.outputs.length, 1, `Cell length not correct`);
        const error = cell.outputs[0].evalue;
        if (error) {
            assert.ok(error, 'Error not found when expected');
            assert.equal(error, errorString, 'Unexpected error found');
        }
    }

    async function verifyCell(index: number, code: string, mimeType: string, cellType: string, verifyValue : (data: any) => void) : Promise<void> {
        // Verify results of an execute
        const cells = await jupyterServer.execute(code, path.join(srcDirectory(), 'foo.py'), 2);
        assert.equal(cells.length, 1, `${index}: Wrong number of cells returned`);
        if (cellType === 'code') {
            assert.equal(cells[0].data.cell_type, cellType, `${index}: Wrong type of cell returned`);
            const cell = cells[0].data as nbformat.ICodeCell;
            assert.equal(cell.outputs.length, 1, `${index}: Cell length not correct`);
            const error = cell.outputs[0].evalue;
            if (error) {
                assert.fail(`${index}: Unexpected error: ${error}`);
            }
            const data = cell.outputs[0].data;
            assert.ok(data, `${index}: No data object on the cell`);
            if (data) { // For linter
                assert.ok(data.hasOwnProperty(mimeType), `${index}: Cell mime type not correct`);
                assert.ok(data[mimeType], `${index}: Cell mime type not correct`);
                verifyValue(data[mimeType]);
            }
        } else if (cellType === 'markdown') {
            assert.equal(cells[0].data.cell_type, cellType, `${index}: Wrong type of cell returned`);
            const cell = cells[0].data as nbformat.IMarkdownCell;
            const outputSource = Cell.concatMultilineString(cell.source);
            verifyValue(outputSource);
        } else if (cellType === 'error') {
            const cell = cells[0].data as nbformat.ICodeCell;
            assert.equal(cell.outputs.length, 1, `${index}: Cell length not correct`);
            const error = cell.outputs[0].evalue;
            assert.ok(error, 'Error not found when expected');
            verifyValue(error);
        }
    }

    function testMimeTypes(types : {code: string; mimeType: string; cellType: string; verifyValue(data: any): void}[]) {
        runTest('MimeTypes', async () => {
            // Test all mime types together so we don't have to startup and shutdown between
            // each
            const server = await jupyterServer.start();
            if (!server) {
                assert.fail('Server not created');
            }
            let statusCount: number = 0;
            jupyterServer.onStatusChanged((bool: boolean) => {
                statusCount += 1;
            });
            for (let i = 0; i < types.length; i += 1) {
                const prevCount = statusCount;
                await verifyCell(i, types[i].code, types[i].mimeType, types[i].cellType, types[i].verifyValue);
                if (types[i].cellType !== 'markdown') {
                    assert.ok(statusCount > prevCount, 'Status didnt update');
                }
            }
        });
    }

    function runTest(name: string, func: () => Promise<void>) {
        test(name, async () => {
            if (await jupyterExecution.isNotebookSupported()) {
                return func();
            } else {
                // tslint:disable-next-line:no-console
                console.log(`Skipping test ${name}, no jupyter installed.`);
            }
        });
    }

    runTest('Creation', async () => {
        const server = await jupyterServer.start();
        if (!server) {
            assert.fail('Server not created');
        }
    });

    runTest('Failure', async () => {
        jupyterServer.shutdown().ignoreErrors();
        // Make a dummy class that will fail during launch
        class FailedProcess extends JupyterProcess {
            public waitForConnectionInformation() : Promise<IConnectionInfo> {
                return Promise.reject('Failing');
            }
        }
        ioc.serviceManager.rebind<INotebookProcess>(INotebookProcess, FailedProcess);
        jupyterServer = ioc.serviceManager.get<INotebookServer>(INotebookServer);
        return assertThrows(async () => {
            await jupyterServer.start();
        }, 'Server start is not throwing');
    });

    test('Not installed', async () => {
        jupyterServer.shutdown().ignoreErrors();
        // Make a dummy class that will fail during launch
        class FailedAvailability extends JupyterExecution {
            public isNotebookSupported = () : Promise<boolean> => {
                return Promise.resolve(false);
            }
        }
        ioc.serviceManager.rebind<IJupyterExecution>(IJupyterExecution, FailedAvailability);
        jupyterServer = ioc.serviceManager.get<INotebookServer>(INotebookServer);
        return assertThrows(async () => {
            await jupyterServer.start();
        }, 'Server start is not throwing');
    });

    runTest('Export/Import', async () => {
        const server = await jupyterServer.start();
        if (!server) {
            assert.fail('Server not created');
        }

        // Get a bunch of test cells (use our test cells from the react controls)
        const testState = generateTestState(id => { return; });
        const cells = testState.cellVMs.map((cellVM: ICellViewModel, index: number) => { return cellVM.cell; });

        // Translate this into a notebook
        const notebook = await jupyterServer.translateToNotebook(cells);

        // Save to a temp file
        const fileSystem = ioc.serviceManager.get<IFileSystem>(IFileSystem);
        const importer = ioc.serviceManager.get<INotebookImporter>(INotebookImporter);
        const temp = await fileSystem.createTemporaryFile('.ipynb');
        try {
            await fs.writeFile(temp.filePath, JSON.stringify(notebook), 'utf8');
            // Try importing this. This should verify export works and that importing is possible
            await importer.importFromFile(temp.filePath);
        } finally {
            importer.dispose();
            temp.dispose();
        }
    });

    runTest('Restart kernel', async () => {
        const server = await jupyterServer.start();
        if (!server) {
            assert.fail('Server not created');
        }

        // Setup some state and verify output is correct
        await verifySimple('a=1\r\na', 1);
        await verifySimple('a+=1\r\na', 2);
        await verifySimple('a+=4\r\na', 6);

        console.log('Waiting for idle');

        // In unit tests we have to wait for status idle before restarting. Unit tests
        // seem to be timing out if the restart throws any exceptions (even if they're caught)
        await jupyterServer.waitForIdle();

        console.log('Restarting kernel');

        await jupyterServer.restartKernel();

        console.log('Waiting for idle');
        await jupyterServer.waitForIdle();

        console.log('Verifying restart');
        await verifyError('a', `name 'a' is not defined`);
    });

    testMimeTypes(
        [
            {
                code:
                    `a=1
a`,
                mimeType: 'text/plain',
                cellType: 'code',
                verifyValue: (d) => assert.equal(d, 1, 'Plain text invalid')
            },
            {
                code:
                    `df = pd.read_csv("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`,
                mimeType: 'text/html',
                cellType: 'code',
                verifyValue: (d) => assert.ok(d.toString().includes('</td>'), 'Table not found')
            },
            {
                code:
                    `df = pd.read("${escapePath(path.join(srcDirectory(), 'DefaultSalesReport.csv'))}")
df.head()`,
                mimeType: 'text/html',
                cellType: 'error',
                verifyValue: (d) => assert.equal(d, `module 'pandas' has no attribute 'read'`, 'Unexpected error result')
            },
            {
                code:
                    `#%% [markdown]#
# #HEADER`,
                mimeType: 'text/plain',
                cellType: 'markdown',
                verifyValue: (d) => assert.equal(d, '#HEADER', 'Markdown incorrect')
            },
            {
                // Test relative directories too.
                code:
                    `df = pd.read_csv("./DefaultSalesReport.csv")
df.head()`,
                mimeType: 'text/html',
                cellType: 'code',
                verifyValue: (d) => assert.ok(d.toString().includes('</td>'), 'Table not found')
            },
            {
                // Plotly
                code:
                    `import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import pandas as pd
x = np.linspace(0, 20, 100)
plt.plot(x, np.sin(x))
plt.show()`,
                mimeType: 'image/png',
                cellType: 'code',
                verifyValue: (d) => { return; }
            }
        ]
    );

    // Tests that should be running:
    // - Creation
    // - Failure
    // - Not installed
    // - Different mime types
    // - Export/import
    // - Auto import
    // - changing directories
    // - Restart
    // - Error types
});
