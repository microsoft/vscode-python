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

import { Identifiers } from '../../client/datascience/constants';
import {
    DataViewerMessages,
    IDataViewer,
    IDataViewerDataProvider,
    IDataViewerFactory
} from '../../client/datascience/data-viewing/types';
import { getDefaultInteractiveIdentity } from '../../client/datascience/interactive-window/identity';
import {
    IJupyterVariable,
    IJupyterVariableDataProviderFactory,
    INotebook,
    INotebookProvider
} from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/data-explorer/mainPanel';
import { ReactSlickGrid } from '../../datascience-ui/data-explorer/reactSlickGrid';
import { noop, sleep } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { takeSnapshot, writeDiffSnapshot } from './helpers';
import { IMountedWebView } from './mountedWebView';

// import { asyncDump } from '../common/asyncDump';
suite('DataScience DataViewer tests', () => {
    const disposables: Disposable[] = [];
    let dataViewerFactory: IDataViewerFactory;
    let jupyterVariableDataProviderFactory: IJupyterVariableDataProviderFactory;
    let ioc: DataScienceIocContainer;
    let notebook: INotebook | undefined;
    const snapshot = takeSnapshot();

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

    suiteTeardown(() => {
        writeDiffSnapshot(snapshot, 'DataViewer');
    });

    setup(async () => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        return ioc.activate();
    });

    function mountWebView() {
        // Setup our webview panel
        const mounted = ioc.createWebView(
            () => mount(<MainPanel skipDefault={true} baseTheme={'vscode-light'} testMode={true} />),
            'default'
        );

        // Make sure the data explorer provider and execution factory in the container is created (the extension does this on startup in the extension)
        dataViewerFactory = ioc.get<IDataViewerFactory>(IDataViewerFactory);
        jupyterVariableDataProviderFactory = ioc.get<IJupyterVariableDataProviderFactory>(
            IJupyterVariableDataProviderFactory
        );

        return mounted;
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

    function createJupyterVariable(variable: string, type: string): IJupyterVariable {
        return {
            name: variable,
            value: '',
            supportsDataExplorer: true,
            type,
            size: 0,
            truncated: true,
            shape: '',
            count: 0
        };
    }

    async function createJupyterVariableDataProvider(
        jupyterVariable: IJupyterVariable
    ): Promise<IDataViewerDataProvider> {
        return jupyterVariableDataProviderFactory.create(jupyterVariable, notebook!);
    }

    async function createDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<IDataViewer> {
        return dataViewerFactory.create(dataProvider, title);
    }

    async function createJupyterVariableDataViewer(variable: string, type: string): Promise<IDataViewer> {
        const jupyterVariable: IJupyterVariable = createJupyterVariable(variable, type);
        const jupyterVariableDataProvider: IDataViewerDataProvider = await createJupyterVariableDataProvider(
            jupyterVariable
        );
        return createDataViewer(jupyterVariableDataProvider, jupyterVariable.name);
    }

    async function injectCode(code: string): Promise<void> {
        const notebookProvider = ioc.get<INotebookProvider>(INotebookProvider);
        notebook = await notebookProvider.getOrCreateNotebook({
            identity: getDefaultInteractiveIdentity()
        });
        if (notebook) {
            const cells = await notebook.execute(code, Identifiers.EmptyFileName, 0, uuid());
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

    function getCompletedPromise(mountedWebView: IMountedWebView): Promise<void> {
        return mountedWebView.waitForMessage(DataViewerMessages.CompletedData);
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(name: string, testFunc: (mount: IMountedWebView) => Promise<void>) {
        test(name, async () => {
            const wrapper = mountWebView();
            try {
                await testFunc(wrapper);
            } finally {
                // Make sure to unmount the wrapper or it will interfere with other tests
                wrapper.dispose();
            }
        });
    }

    function sortRows(
        wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
        sortCol: string,
        sortAsc: boolean
    ): void {
        // Cause our sort
        const mainPanelWrapper = wrapper.find(MainPanel);
        assert.ok(mainPanelWrapper && mainPanelWrapper.length > 0, 'Grid not found to sort on');
        const mainPanel = mainPanelWrapper.instance() as MainPanel;
        assert.ok(mainPanel, 'Main panel instance not found');
        const reactGrid = (mainPanel as any).grid.current as ReactSlickGrid;
        assert.ok(reactGrid, 'Grid control not found');
        if (reactGrid.state.grid) {
            const cols = reactGrid.state.grid.getColumns();
            const col = cols.find((c) => c.field === sortCol);
            assert.ok(col, `${sortCol} is not a column of the grid`);
            reactGrid.sort(new Slick.EventData(), {
                sortCol: col,
                sortAsc,
                multiColumnSort: false,
                grid: reactGrid.state.grid
            });
        }
    }

    async function filterRows(
        wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
        filterCol: string,
        filterText: string
    ): Promise<void> {
        // Cause our sort
        const mainPanelWrapper = wrapper.find(MainPanel);
        assert.ok(mainPanelWrapper && mainPanelWrapper.length > 0, 'Grid not found to sort on');
        const mainPanel = mainPanelWrapper.instance() as MainPanel;
        assert.ok(mainPanel, 'Main panel instance not found');
        const reactGrid = (mainPanel as any).grid.current as ReactSlickGrid;
        assert.ok(reactGrid, 'Grid control not found');
        if (reactGrid.state.grid) {
            const cols = reactGrid.state.grid.getColumns();
            const col = cols.find((c) => c.field === filterCol);
            assert.ok(col, `${filterCol} is not a column of the grid`);
            reactGrid.filterChanged(filterText, col!);
            await sleep(100);
            wrapper.update();
        }
    }

    function verifyRows(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, rows: (string | number)[]) {
        const mainPanel = wrapper.find('.main-panel');
        assert.ok(mainPanel.length >= 1, "Didn't find any cells being rendered");
        wrapper.update();

        // Force the main panel to actually render.
        const html = mainPanel.html();
        const root = parse(html) as any;
        const cells = root.querySelectorAll('.react-grid-cell') as HTMLElement[];
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
        const gotAllRows = getCompletedPromise(wrapper);
        const dv = await createJupyterVariableDataViewer('df', 'DataFrame');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper.wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('List', async (wrapper) => {
        await injectCode('ls = [0, 1, 2, 3]');
        const gotAllRows = getCompletedPromise(wrapper);
        const dv = await createJupyterVariableDataViewer('ls', 'list');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper.wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('Series', async (wrapper) => {
        await injectCode('import pandas as pd\r\ns = pd.Series([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise(wrapper);
        const dv = await createJupyterVariableDataViewer('s', 'Series');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper.wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('np.array', async (wrapper) => {
        await injectCode('import numpy as np\r\nx = np.array([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise(wrapper);
        const dv = await createJupyterVariableDataViewer('x', 'ndarray');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper.wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
    });

    runMountedTest('Failure', async (_wrapper) => {
        await injectCode('import numpy as np\r\nx = np.array([0, 1, 2, 3])');
        try {
            await createJupyterVariableDataViewer('unknown variable', 'ndarray');
            assert.fail('Exception should have been thrown');
        } catch {
            noop();
        }
    });

    runMountedTest('Sorting', async (wrapper) => {
        await injectCode('import numpy as np\r\nx = np.array([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise(wrapper);
        const dv = await createJupyterVariableDataViewer('x', 'ndarray');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper.wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
        sortRows(wrapper.wrapper, '0', false);
        verifyRows(wrapper.wrapper, [3, 3, 2, 2, 1, 1, 0, 0]);
    });

    runMountedTest('Filter', async (wrapper) => {
        await injectCode('import numpy as np\r\nx = np.array([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise(wrapper);
        const dv = await createJupyterVariableDataViewer('x', 'ndarray');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyRows(wrapper.wrapper, [0, 0, 1, 1, 2, 2, 3, 3]);
        await filterRows(wrapper.wrapper, '0', '> 1');
        verifyRows(wrapper.wrapper, [2, 2, 3, 3]);
        await filterRows(wrapper.wrapper, '0', '0');
        verifyRows(wrapper.wrapper, [0, 0]);
    });
});
