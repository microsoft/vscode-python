// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { expect } from 'chai';
import { mount, ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import { parse } from 'node-html-parser';
import * as path from 'path';
import * as React from 'react';
import * as TypeMoq from 'typemoq';
import { Disposable, TextDocument, TextEditor } from 'vscode';
import { createDeferred } from '../../client/common/utils/async';
import { HistoryMessageListener } from '../../client/datascience/history/historyMessageListener';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import { IHistory, IHistoryProvider, IJupyterExecution, IJupyterVariable } from '../../client/datascience/types';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { VariableExplorer } from '../../datascience-ui/history-react/variableExplorer';
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
    let messageWrapper: ((m: string, payload: any) => void) | undefined;

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

    //runMountedTest('Variable explorer simple', async (wrapper) => {
        //await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        //verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    //});

    // *********** Note all of the above code is shared with history.functional.test.tsx should be combine? Move into same file or add helpers? ************
    runMountedTest('Variable explorer basic', async (wrapper) => {
        openVariableExplorer(wrapper);

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');

        // After code is added, open up our variable explorer which will cause a data fetch
        //openVariableExplorer(wrapper);
        //openVariableExplorer(wrapper);

        // Verify that we actually update the variable explorer
        await waitForUpdate(wrapper, VariableExplorer, 2);

        //const requestingValues = getValuesPromise();
        //await requestingValues;

        const targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 50, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);

        //const varExplorer = findVariableExplorer(wrapper);

        //verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

    // IANHU Shared with dataviewer
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
    // IANHU Share with dataviewer
    function getValuesPromise() : Promise<void> {
        return waitForMessage(HistoryMessages.GetVariableValueRequest);
    }
});

// Open up our variable explorer which also triggers a data fetch
function openVariableExplorer(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
    const varExp: VariableExplorer = wrapper.find('VariableExplorer').instance() as VariableExplorer;

    assert(varExp);

    if (varExp) {
        //varExp.toggleInputBlock();
        varExp.setState({open: true});
    }

    //const varExp: VariableExplorer = wrapper.find('VariableExplorer').instance() as VariableExplorer;

    //assert(varExp);

    //if (varExp) {
        //varExp.toggleInputBlock();
    //}
}

function verifyVariables(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, targetVariables: IJupyterVariable[]) {
    const foundRows = wrapper.find('div.react-grid-Row');

    assert(foundRows.length === targetVariables.length);

    foundRows.forEach((row, index) => {
        verifyRow(row, targetVariables[index]);
    });
}

function verifyRow(rowWrapper: ReactWrapper<any, Readonly<{}>, React.Component>, targetVariable: IJupyterVariable) {
    const rowCells = rowWrapper.find('div.react-grid-Cell');

    expect(rowCells.length).to.be.equal(5);

    //verifyCell(rowCells.at(0), 'a');
    //verifyCell(rowCells.at(1), 'int');
    //verifyCell(rowCells.at(2), '50');
    //verifyCell(rowCells.at(3), '1');
    verifyCell(rowCells.at(0), targetVariable.name);
    verifyCell(rowCells.at(1), targetVariable.type);
    verifyCell(rowCells.at(2), targetVariable.size.toString());
    verifyCell(rowCells.at(3), targetVariable.value ? targetVariable.value : '');
}

function verifyCell(cellWrapper: ReactWrapper<any, Readonly<{}>, React.Component>, value: string) {
    const cellHTML = parse(cellWrapper.html()) as any;
    // tslint:disable-next-line:no-string-literal
    expect(cellHTML.firstChild.rawAttributes['value'] as string).to.be.equal(value);
}
