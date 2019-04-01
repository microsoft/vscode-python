// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import * as React from 'react';
import * as uuid from 'uuid/v4';
import { Disposable } from 'vscode';

import { createDeferred } from '../../client/common/utils/async';
import { Identifiers } from '../../client/datascience/constants';
import { DataViewerMessageListener } from '../../client/datascience/data-viewing/dataViewerMessageListener';
import { DataViewerMessages } from '../../client/datascience/data-viewing/types';
import { IDataViewer, IDataViewerProvider, IJupyterExecution } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/data-explorer/mainPanel';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { CellPosition, verifyHtmlOnCell } from './historyTestHelpers';
import { blurWindow } from './reactHelpers';
import { nbformat } from '@jupyterlab/coreutils';

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
    });

    function mountWebView(): ReactWrapper<any, Readonly<{}>, React.Component> {

        // Setup our webview panel
        ioc.createWebView(() => mount(<MainPanel skipDefault={true}/>));

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

            // Rewrite the onMessage function to also call the local messageWrapper if it's defined
            const orig = listener.onMessage.bind(listener);
            listener.onMessage = (m: string, payload: any) => {
                if (messageWrapper) {
                    messageWrapper(m, payload);
                }
                return orig(m, payload);
            };

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

    async function createDataViewer(variable: string): Promise<IDataViewer> {
        return dataProvider.create(variable);
    }

    async function injectCode(code: string) : Promise<void> {
        const exec = ioc.get<IJupyterExecution>(IJupyterExecution);
        const server = await exec.connectToNotebookServer();
        if (server) {
            const cells = await server.execute(code, Identifiers.EmptyFileName, 0, uuid());
            assert.equal(cells.length, 1, `Wrong number of cells returned`);
            assert.equal(cells[0].data.cell_type, 'code', `Wrong type of cell returned`);
            const cell = cells[0].data as nbformat.ICodeCell;
            assert.ok(cell.outputs.length > 0, `Cell length not correct`);
            const error = cell.outputs[0].evalue;
            if (error) {
                assert.fail(`Unexpected error: ${error}`);
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

    runMountedTest('Data Frame', async (wrapper) => {
        await injectCode('import pandas as pd\r\ndf = pd.DataFrame([0, 1, 2, 3])');
        const gotAllRows = getCompletedPromise();
        const dv = await createDataViewer('df');
        assert.ok(dv, 'DataViewer not created');
        await gotAllRows;

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

});
