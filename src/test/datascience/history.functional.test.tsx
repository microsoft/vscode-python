// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount } from 'enzyme';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';

import {
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelProvider,
    WebPanelMessage
} from '../../client/common/application/types';
import { IHistoryProvider, IJupyterExecution } from '../../client/datascience/types';
import { Cell } from '../../datascience-ui/history-react/cell';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { IVsCodeApi } from '../../datascience-ui/react-common/postOffice';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { waitForUpdate } from './reactHelpers';

// tslint:disable-next-line:max-func-body-length
suite('History output tests', () => {
    const disposables: Disposable[] = [];
    let jupyterExecution: IJupyterExecution;
    let webPanelProvider : TypeMoq.IMock<IWebPanelProvider>;
    let webPanel : TypeMoq.IMock<IWebPanel>;
    let historyProvider : IHistoryProvider;
    let webPanelListener : IWebPanelMessageListener;
    let globalAcquireVsCodeApi : () => IVsCodeApi;
    let ioc: DataScienceIocContainer;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();

        webPanelProvider = TypeMoq.Mock.ofType<IWebPanelProvider>();
        webPanel = TypeMoq.Mock.ofType<IWebPanel>();

        ioc.serviceManager.addSingletonInstance<IWebPanelProvider>(IWebPanelProvider, webPanelProvider.object);

        // Setup the webpanel provider so that it returns our dummy web panel. It will have to talk to our global JSDOM window so that the react components can link into it
        webPanelProvider.setup(p => p.create(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns((listener : IWebPanelMessageListener, title: string, script: string, css: string) => {
            // Keep track of the current listener. It listens to messages through the vscode api
            webPanelListener = listener;

            // Return our dummy web panel
            return webPanel.object;
        });
        webPanel.setup(p => p.postMessage(TypeMoq.It.isAny())).callback((m : WebPanelMessage) => window.postMessage(m, '*')); // See JSDOM valid target origins
        webPanel.setup(p => p.show());

        jupyterExecution = ioc.serviceManager.get<IJupyterExecution>(IJupyterExecution);
        historyProvider = ioc.serviceManager.get<IHistoryProvider>(IHistoryProvider);

        // Setup a global for the acquireVsCodeApi so that the React PostOffice can find it
        globalAcquireVsCodeApi = () : IVsCodeApi => {
            return {
                // tslint:disable-next-line:no-any
                postMessage: (msg: any) => {
                    if (webPanelListener) {
                        webPanelListener.onMessage(msg.type, msg.payload);
                    }
                },
                // tslint:disable-next-line:no-any no-empty
                setState: (msg: any) => {

                },
                // tslint:disable-next-line:no-any no-empty
                getState: () => {
                    return {};
                }
            };
        };
        // tslint:disable-next-line:no-string-literal
        global['acquireVsCodeApi'] = globalAcquireVsCodeApi;
    });

    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
        ioc.dispose();
        delete global['ascquireVsCodeApi'];
    });

    test('Simple text', async () => {
        if (await jupyterExecution.isNotebookSupported()) {
            // Create our main panel and tie it into the JSDOM. Ignore progress so we only get a single render
            const wrapper = mount(<MainPanel theme='vscode-light' ignoreProgress={true} skipDefault={true} />);

            // Get an update promise so we can wait for the add code
            const updatePromise = waitForUpdate(wrapper, MainPanel);

            // Send some code to the history and make sure it ends up in the html returned from our render
            const history = historyProvider.active;
            await history.addCode('a=1\na', 'foo.py', 2);

            // Wait for the render to go through
            await updatePromise;

            const foundResult = wrapper.find('Cell');
            assert.equal(foundResult.length, 1, 'Didn\'t find any cells being rendered');
        } else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
    }).timeout(60000);

    test('Loc React test', async () => {
        // Create our main panel and tie it into the JSDOM
        const wrapper = mount(<MainPanel theme='vscode-light' skipDefault={false} />);

        // Our cell should have been rendered. It should have a method to get a loc string
        const cellFound = wrapper.find('Cell');
        const cell = cellFound.at(0).instance() as Cell;
        assert.equal(cell.getUnknownMimeTypeString(), 'Unknown mime type from helper', 'Unknown mime type did not come from script');
    });

    test('Dispose test', async () => {
        // tslint:disable-next-line:no-any
        if (await jupyterExecution.isNotebookSupported()) {
            const history = historyProvider.active;
            await history.show(); // Have to wait for the load to finish
            await history.dispose();
            // tslint:disable-next-line:no-any
            const h2 = historyProvider.active;
            // Check equal and then dispose so the test goes away
            const equal = Object.is(history, h2);
            await h2.show();
            assert.ok(!equal, 'Disposing is not removing the active history');
        } else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
});

    // Tests to do:
    // 1) Cell output works on different mime types. Could just use a notebook to drive
    // 2) History commands work (export/restart/clear all)
    // 3) Jupyter server commands work (open notebook)
    // 4) Changing directories or loading from different directories
    // 5) Telemetry
});
