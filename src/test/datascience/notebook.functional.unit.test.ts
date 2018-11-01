// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import { Disposable } from 'vscode';

import { IJupyterAvailability, INotebookServer } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';

suite('Jupyter notebook tests', () => {
    const disposables: Disposable[] = [];
    let availability: IJupyterAvailability;
    let jupyterServer : INotebookServer;
    let ioc: DataScienceIocContainer;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        jupyterServer = ioc.serviceManager.get<INotebookServer>(INotebookServer);
        availability = ioc.serviceManager.get<IJupyterAvailability>(IJupyterAvailability);
    });

    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
    });

    test('Creation', async () => {
        if (await availability.isNotebookSupported()) {
            const server = await jupyterServer.start();
            if (!server) {
                assert.fail('Server not created');
            }
        } else {
            // tslint:disable-next-line:no-console
            console.log('Creation test skipped, no Jupyter installed');
        }
    }).timeout(60000);

    test('Execution', async () => {
        if (await availability.isNotebookSupported()) {
            const server = await jupyterServer.start();
            if (!server) {
                assert.fail('Server not created');
            }
            let statusCount: number = 0;
            jupyterServer.onStatusChanged((bool: boolean) => {
                statusCount += 1;
            });
            const cells = await jupyterServer.execute('a = 1\r\na', 'foo.py', 2);
            assert.equal(cells.length, 1, 'Wrong number of cells returned');
            assert.equal(cells[0].data.cell_type, 'code', 'Wrong type of cell returned');
            const cell = cells[0].data as nbformat.ICodeCell;
            assert.equal(cell.outputs.length, 1, 'Cell length not correct');
            const data = cell.outputs[0].data;
            assert.ok(data, 'No data object on the cell');
            if (data) { // For linter
                assert.ok(data.hasOwnProperty('text/plain'), 'Cell mime type not correct');
                assert.ok(data['text/plain'], 'Cell mime type not correct');
                assert.equal(data['text/plain'], '1', 'Cell not correct');
                assert.ok(statusCount >= 2, 'Status wasnt updated');
            }
        } else {
            // tslint:disable-next-line:no-console
            console.log('Execution test skipped, no Jupyter installed');
        }
    }).timeout(60000);

});
