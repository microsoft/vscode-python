// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable, TextDocument, TextEditor } from 'vscode';
import { HistoryMessageListener } from '../../client/datascience/history/historyMessageListener';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import { IHistory, IHistoryProvider, IJupyterExecution } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import {
    addCode,
    addContinuousMockData,
    addMockData,
    CellInputState,
    CellPosition,
    defaultDataScienceSettings,
    enterInput,
    escapePath,
    findButton,
    getCellResults,
    getLastOutputCell,
    initialDataScienceSettings,
    srcDirectory,
    toggleCellExpansion,
    updateDataScienceSettings,
    verifyHtmlOnCell,
    verifyLastCellInputState
} from './historyTestHelpers';
import { blurWindow, waitForUpdate } from './reactHelpers';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite('History variable explorer tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;
    let historyProvider: IHistoryProvider;
    let jupyterExecution: IJupyterExecution;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
    });

    function mountWebView(): ReactWrapper<any, Readonly<{}>, React.Component> {

        // Setup our webview panel
        ioc.createWebView(() => mount(<MainPanel baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />));

        // Make sure the history provider and execution factory in the container is created (the extension does this on startup in the extension)
        historyProvider = ioc.get<IHistoryProvider>(IHistoryProvider);

        // The history provider create needs to be rewritten to make the history window think the mounted web panel is
        // ready.
        const origFunc = (historyProvider as any).create.bind(historyProvider);
        (historyProvider as any).create = async (): Promise<void> => {
            await origFunc();
            const history = historyProvider.getActive();

            // During testing the MainPanel sends the init message before our history is created.
            // Pretend like it's happening now
            const listener = ((history as any).messageListener) as HistoryMessageListener;
            listener.onMessage(HistoryMessages.Started, {});
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
    });

    async function getOrCreateHistory(): Promise<IHistory> {
        const result = await historyProvider.getOrCreateActive();

        // During testing the MainPanel sends the init message before our history is created.
        // Pretend like it's happening now
        const listener = ((result as any).messageListener) as HistoryMessageListener;
        listener.onMessage(HistoryMessages.Started, {});

        return result;
    }

    // tslint:disable-next-line:no-any
    function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>) {
        test(name, async () => {
            if (await jupyterExecution.isNotebookSupported()) {
                addMockData(ioc, 'a=1\na', 1);
                const wrapper = mountWebView();
                try {
                    await testFunc(wrapper);
                } finally {
                    // Blur window focus so we don't have editors polling
                    blurWindow();

                    // Make sure to unmount the wrapper or it will interfere with other tests
                    wrapper.unmount();
                }
            } else {
                // tslint:disable-next-line:no-console
                console.log(`${name} skipped, no Jupyter installed.`);
            }
        });
    }

    runMountedTest('Variable explorer simple', async (wrapper) => {
        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });
});
