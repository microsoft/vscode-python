// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import * as React from 'react';
import * as uuid from 'uuid/v4';
import { Disposable } from 'vscode';

import { Identifiers } from '../../client/datascience/constants';
import { DataViewerMessageListener } from '../../client/datascience/data-viewing/dataViewerMessageListener';
import { DataViewerMessages } from '../../client/datascience/data-viewing/types';
import { IDataViewer, IDataViewerProvider, IJupyterExecution } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/data-explorer/mainPanel';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { CellPosition, verifyHtmlOnCell } from './historyTestHelpers';
import { blurWindow } from './reactHelpers';

suite('DataViewer tests', () => {
    const disposables: Disposable[] = [];
    let dataProvider: IDataViewerProvider;
    let ioc: DataScienceIocContainer;

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
            await server.execute(code, Identifiers.EmptyFileName, 0, uuid());
        }
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>) {
        test(name, async (_done: MochaDone) => {
            const wrapper = mountWebView();
            try {
                await testFunc(wrapper);
            } finally {
                // Blur window focus so we don't have editors polling
                blurWindow();

                // Make sure to unmount the wrapper or it will interfere with other tests
                wrapper.unmount();
            }
        });
    }

    runMountedTest('Data Frame', async (wrapper) => {
        await injectCode('import pandas as pd\r\ndf = pd.DataFrame([0, 1, 2, 3])');
        const dv = await createDataViewer('df');
        assert.ok(dv, 'DataViewer not created');

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

});
