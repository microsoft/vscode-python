// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
//tslint:disable:trailing-comma
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import * as React from 'react';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';

import {
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelProvider,
    WebPanelMessage
} from '../../client/common/application/types';
import { createDeferred } from '../../client/common/utils/async';
import { Architecture } from '../../client/common/utils/platform';
import { EditorContexts, HistoryMessages } from '../../client/datascience/constants';
import { IHistoryProvider, IJupyterExecution } from '../../client/datascience/types';
import { InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { Cell } from '../../datascience-ui/history-react/cell';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { IVsCodeApi } from '../../datascience-ui/react-common/postOffice';
import { sleep } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { SupportedCommands } from './mockJupyterManager';
import { waitForUpdate } from './reactHelpers';

// tslint:disable-next-line:max-func-body-length no-any
suite('History output tests', () => {
    const disposables: Disposable[] = [];
    let jupyterExecution: IJupyterExecution;
    let webPanelProvider : TypeMoq.IMock<IWebPanelProvider>;
    let webPanel : TypeMoq.IMock<IWebPanel>;
    let historyProvider : IHistoryProvider;
    let webPanelListener : IWebPanelMessageListener;
    let globalAcquireVsCodeApi : () => IVsCodeApi;
    let ioc: DataScienceIocContainer;

    const workingPython: PythonInterpreter = {
        path: '/foo/bar/python.exe',
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        type: InterpreterType.Unknown,
        architecture: Architecture.x64,
    };
    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();

        if (ioc.mockJupyter) {
            ioc.mockJupyter.addInterpreter(workingPython, SupportedCommands.all);
        }

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
        webPanel.setup(p => p.postMessage(TypeMoq.It.isAny())).callback((m : WebPanelMessage) => {
            window.postMessage(m, '*');
        }); // See JSDOM valid target origins
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

    teardown(async () => {
        for (let i = 0; i < disposables.length; i += 1) {
            const disposable = disposables[i];
            if (disposable) {
                // tslint:disable-next-line:no-any
                const promise = disposable.dispose() as Promise<any>;
                if (promise) {
                    await promise;
                }
            }
        }
        await ioc.dispose();
        delete global['ascquireVsCodeApi'];
    });

    function addMockData(code: string, result: string | number, mimeType?: string, cellType?: string) {
        if (ioc.mockJupyter) {
            if (cellType && cellType === 'error') {
                ioc.mockJupyter.addError(code, result.toString());
            } else {
                ioc.mockJupyter.addCell(code, result, mimeType);
            }
        }
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>) {
        test(name, async () => {
            // Create our main panel and tie it into the JSDOM. Ignore progress so we only get a single render
            const wrapper = mount(<MainPanel theme='vscode-light' ignoreProgress={true} skipDefault={true} />);
            try {
                await testFunc(wrapper);
            } finally {
                // Make sure to unmount the wrapper or it will interfere with other tests
                wrapper.unmount();
            }
        }).timeout(60000);
    }

    runMountedTest('Simple text', async (wrapper) => {
        addMockData('a=1\na', 1);
        if (await jupyterExecution.isNotebookSupported()) {

            // Get an update promise so we can wait for the add code
            const updatePromise = waitForUpdate(wrapper, MainPanel);

            // Send some code to the history and make sure it ends up in the html returned from our render
            const history = historyProvider.getOrCreateActive();
            await history.addCode('a=1\na', 'foo.py', 2);

            // Wait for the render to go through
            await updatePromise;

            const foundResult = wrapper.find('Cell');
            assert.ok(foundResult.length >= 1, 'Didn\'t find any cells being rendered');
        } else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
    });

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
            const history = historyProvider.getOrCreateActive();
            await history.show(); // Have to wait for the load to finish
            await history.dispose();
            // tslint:disable-next-line:no-any
            const h2 = historyProvider.getOrCreateActive();
            // Check equal and then dispose so the test goes away
            const equal = Object.is(history, h2);
            await h2.show();
            assert.ok(!equal, 'Disposing is not removing the active history');
        } else {
            // tslint:disable-next-line:no-console
            console.log('History test skipped, no Jupyter installed');
        }
    });

    runMountedTest('Editor Context', async (wrapper) => {
        addMockData('a=1\na', 1);

        // Verify we can send different commands to the UI and it will respond
        if (await jupyterExecution.isNotebookSupported()) {
            const history = historyProvider.getOrCreateActive();

            // Before we have any cells, verify our contexts are not set
            assert.equal(ioc.getContext(EditorContexts.HaveInteractive), false, 'Should not have interactive before starting');
            assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), false, 'Should not have interactive cells before starting');
            assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), false, 'Should not have redoable before starting');

            // Get an update promise so we can wait for the add code
            const updatePromise = waitForUpdate(wrapper, MainPanel);

            // Send some code to the history
            await history.addCode('a=1\na', 'foo.py', 2);

            // Wait for the render to go through
            await updatePromise;

            // Now we should have the 3 editor contexts
            assert.equal(ioc.getContext(EditorContexts.HaveInteractive), true, 'Should have interactive after starting');
            assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), true, 'Should have interactive cells after starting');
            assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), false, 'Should not have redoable after starting');

            // Setup a listener for context change events. We have 3 separate contexts, so we have to wait for all 3.
            let count = 0;
            let deferred = createDeferred<boolean>();
            const eventDispose = ioc.onContextSet(a => {
                count += 1;
                if (count >= 3) {
                    deferred.resolve();
                }
            });
            disposables.push(eventDispose);

            // Create a method that resets the waiting
            const resetWaiting = () => {
                count = 0;
                deferred = createDeferred<boolean>();
            };

            // Now send an undo command. This should change the state, so use our waitForInfo promise instead
            resetWaiting();
            history.postMessage(HistoryMessages.Undo);
            await Promise.race([deferred.promise, sleep(2000)]);
            assert.ok(deferred.resolved, 'Never got update to state');
            assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), true, 'Should have interactive cells after undo as there are two cells');
            assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), true, 'Should have redoable after undo');

            resetWaiting();
            history.postMessage(HistoryMessages.Undo);
            await Promise.race([deferred.promise, sleep(2000)]);
            assert.ok(deferred.resolved, 'Never got update to state');
            assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), false, 'Should not have interactive cells after second undo');
            assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), true, 'Should have redoable after second undo');

            resetWaiting();
            history.postMessage(HistoryMessages.Redo);
            await Promise.race([deferred.promise, sleep(2000)]);
            assert.ok(deferred.resolved, 'Never got update to state');
            assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), true, 'Should have interactive cells after undo');
            assert.equal(ioc.getContext(EditorContexts.HaveRedoableCells), true, 'Should have redoable after redo');

            resetWaiting();
            history.postMessage(HistoryMessages.DeleteAllCells);
            await Promise.race([deferred.promise, sleep(2000)]);
            assert.ok(deferred.resolved, 'Never got update to state');
            assert.equal(ioc.getContext(EditorContexts.HaveInteractiveCells), false, 'Should not have interactive cells after delete');

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
