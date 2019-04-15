// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
import '../../client/common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import { parse } from 'node-html-parser';
import * as React from 'react';
import * as uuid from 'uuid/v4';
import { Disposable } from 'vscode';

import { createDeferred } from '../../client/common/utils/async';
import { Identifiers } from '../../client/datascience/constants';
import { DataViewerMessageListener } from '../../client/datascience/data-viewing/dataViewerMessageListener';
import { DataViewerMessages } from '../../client/datascience/data-viewing/types';
import { IDataViewer, IDataViewerProvider, IHistoryProvider, IJupyterExecution } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/data-explorer/mainPanel';
import { noop } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';

// import { asyncDump } from '../common/asyncDump';
suite('DataViewer tests', () => {
    const disposables: Disposable[] = [];
    let dataProvider: IDataViewerProvider;
    let ioc: DataScienceIocContainer;
    let messageWrapper: ((m: string, payload: any) => void) | undefined;

    suiteSetup(function () {
        // DataViewer tests require jupyter to run. Othewrise can't
        // run any of our variable execution code
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        if (!isRollingBuild) {
            // tslint:disable-next-line:no-console
            console.log('Skipping DataViewer tests. Requires python environment');
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();

        // Add a listener for our ioc that lets the test
        // forward messages on
        ioc.addMessageListener((m, p) => {
            if (messageWrapper) {
                messageWrapper(m, p);
            }
        });

    });

    function mountWebView(): ReactWrapper<any, Readonly<{}>, React.Component> {

        // Setup our webview panel
        ioc.createWebView(() => mount(<MainPanel skipDefault={true} baseTheme={'vscode-light'} forceHeight={200}/>));

        // Make sure the data explorer provider and execution factory in the container is created (the extension does this on startup in the extension)
        dataProvider = ioc.get<IDataViewerProvider>(IDataViewerProvider);

        // The history provider create needs to be rewritten to make the history window think the mounted web panel is
        // ready.
        const origFunc = (dataProvider as any).create.bind(dataProvider);
        (dataProvider as any).create = async (v: string): Promise<void> => {
            const dataViewer = await origFunc(v);

            // During testing the MainPanel sends the init message before our history is created.
            // Pretend like it's happening now
            const listener = ((dataViewer as any).messageListener) as DataViewerMessageListener;
            listener.onMessage(DataViewerMessages.Started, {});

            return dataViewer;
        };

        return ioc.wrapper!;
    }

    teardown(async () => {
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
        delete (global as any).ascquireVsCodeApi;
    });

    suiteTeardown(() => {
        // asyncDump();
    });

    async function createDataViewer(variable: string): Promise<IDataViewer> {
        return dataProvider.create(variable);
    }

    async function injectCode(code: string) : Promise<void> {
        const exec = ioc.get<IJupyterExecution>(IJupyterExecution);
        const historyProvider = ioc.get<IHistoryProvider>(IHistoryProvider);
        const server = await exec.connectToNotebookServer(await historyProvider.getNotebookOptions());
        if (server) {
            const cells = await server.execute(code, Identifiers.EmptyFileName, 0, uuid());
            assert.equal(cells.length, 1, `Wrong number of cells returned`);
            assert.equal(cells[0].data.cell_type, 'code', `Wrong type of cell returned`);
            const cell = cells[0].data as nbformat.ICodeCell;
            if (cell.outputs.length > 0) {
                const error = cell.outputs[0].evalue;
                if (error) {
                    assert.fail(`Unexpected error: ${error}`);
                }
            }
        }
    }

    function waitForMessage(message: string) : Promise<void> {
        // Wait for the mounted web panel to send a message back to the data explorer
        const promise = createDeferred<void>();
        messageWrapper = (m: string, _p: any) => {
            if (m === message) {
                promise.resolve();
            }
        };
        return promise.promise;
    }

    function getCompletedPromise() : Promise<void> {
        return waitForMessage(DataViewerMessages.CompletedData);
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>) {
        test(name, async () => {
            const wrapper = mountWebView();
            try {
                await testFunc(wrapper);
            } finally {
                // Make sure to unmount the wrapper or it will interfere with other tests
                if (wrapper && wrapper.length) {
                    wrapper.unmount();
                }
            }
        });
    }

    function verifyRows(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, rows: (string | number)[]) {
        const canvas = wrapper.find('div.react-grid-Canvas');
        assert.ok(canvas.length >= 1, 'Didn\'t find any cells being rendered');

        // Force the canvas to actually render.
        const html = canvas.html();
        const root = parse(html) as any;
        const cells = root.querySelectorAll('.react-grid-Cell') as HTMLElement[];
        assert.ok(cells, 'No cells found');
        assert.ok(cells.length >= rows.length, 'Not enough cells found');
        // Cells should be an array that matches up to the values we expect.
        for (let i = 0; i < rows.length; i += 1) {
            // Span should have our value (based on the CellFormatter's output)
            const span = cells[i].querySelector('div.cell-formatter span') as HTMLSpanElement;
            assert.ok(span, `Span ${i} not found`);
            const val = rows[i].toString();
            assert.equal(val, span.innerHTML, `Row ${i} not matching. ${span.innerHTML} !== ${val}`);
        }
    }

    runMountedTest('Data Frame', async (wrapper) => {
        await injectCode('import pandas as pd\r\ndf = pd.DataFrame([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise();
        const dv = await createDataViewer('df');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('List', async (wrapper) => {
        await injectCode('ls = [0, 1, 2, 3]');
        const gotAllRows = getCompletedPromise();
        const dv = await createDataViewer('ls');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('Series', async (wrapper) => {
        await injectCode('import pandas as pd\r\ns = pd.Series([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise();
        const dv = await createDataViewer('s');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('np.array', async (wrapper) => {
        await injectCode('import numpy as np\r\nx = np.array([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise();
        const dv = await createDataViewer('x');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('Failure', async (_wrapper) => {
        await injectCode('import numpy as np\r\nx = np.array([0, 1, 2, 3])');
        try {
            await createDataViewer('unknown variable');
            assert.fail('Exception should have been thrown');
        } catch {
            noop();
        }
    });
});
