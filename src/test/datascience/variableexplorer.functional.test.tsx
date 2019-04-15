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

    runMountedTest('Variable explorer - Exclude', async (wrapper) => {
        const basicCode: string = `import numpy as np
import pandas as pd
value = 'hello world'`;
        const basicCode2: string = `value2 = 'hello world 2'`;

        // Set up our mock data first
        addMockData(ioc, basicCode, undefined);
        addMockData(ioc, basicCode2, undefined);

        openVariableExplorer(wrapper);

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        await addCode(getOrCreateHistory, wrapper, basicCode, 4);
        await waitForUpdate(wrapper, VariableExplorer, 3);

        // We should show a string and show an int, the modules should be hidden
        let targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'value', value: 'hello world', supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);

        // Update our exclude list to only exlude strings
        ioc.getSettings().datascience.variableExplorerExclude = 'str';

        // Add another string and check our vars
        await addCode(getOrCreateHistory, wrapper, basicCode2, 4);
        await waitForUpdate(wrapper, VariableExplorer, 7);

        targetVariables = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'notebook', value: '"<module', supportsDataExplorer: false, type: 'module', size: 54, shape: '', count: 0, truncated: false},
            {name: 'np', value: '"<module', supportsDataExplorer: false, type: 'module', size: 54, shape: '', count: 0, truncated: false},
            {name: 'pd', value: '"<module', supportsDataExplorer: false, type: 'module', size: 54, shape: '', count: 0, truncated: false},
            {name: 'plt', value: '"<module', supportsDataExplorer: false, type: 'module', size: 54, shape: '', count: 0, truncated: false},
            {name: 'sys', value: '"<module', supportsDataExplorer: false, type: 'module', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    });

    runMountedTest('Variable explorer - Update', async (wrapper) => {
        const basicCode: string = `value = 'hello world'`;
        const basicCode2: string = `value2 = 'hello world 2'`;

        // Set up our mock data first
        addMockData(ioc, basicCode, undefined);
        addMockData(ioc, basicCode2, undefined);

        openVariableExplorer(wrapper);

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        await waitForUpdate(wrapper, VariableExplorer, 2);

        // Check that we have just the 'a' variable
        let targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
        ];
        verifyVariables(wrapper, targetVariables);

        // Add another variable and check it
        await addCode(getOrCreateHistory, wrapper, basicCode, 4);
        await waitForUpdate(wrapper, VariableExplorer, 3);

        targetVariables = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'value', value: 'hello world', supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);

        // Add a second variable and check it
        await addCode(getOrCreateHistory, wrapper, basicCode2, 4);
        await waitForUpdate(wrapper, VariableExplorer, 4);

        targetVariables = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'value', value: 'hello world', supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
            {name: 'value2', value: 'hello world 2', supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    });

    runMountedTest('Variable explorer - Loading', async (wrapper) => {
        const basicCode: string = `value = 'hello world'`;

        // Set up our mock data first
        addMockData(ioc, basicCode, undefined);

        openVariableExplorer(wrapper);

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        await addCode(getOrCreateHistory, wrapper, basicCode, 4);

        // Here we are only going to wait for two renders instead of the needed three
        // a should have the value updated, but value should still be loading
        await waitForUpdate(wrapper, VariableExplorer, 2);

        let targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'value', value: 'Loading...', supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);

        // Now wait for one more update and then check the variables, we should have loaded the value var
        await waitForUpdate(wrapper, VariableExplorer, 1);

        targetVariables = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'value', value: 'hello world', supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    });

    runMountedTest('Variable explorer - Types A', async (wrapper) => {
        const basicCode: string = `import numpy as np
import pandas as pd
myList = [x ** 2 for x in range(0,100000)]
mySet = set(myList)
myDict = {}
for value in myList:
    myDict[value] = value / 2`;

        // Set up our mock data first
        addMockData(ioc, basicCode, undefined);

        openVariableExplorer(wrapper);

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        await addCode(getOrCreateHistory, wrapper, basicCode, 4);

        // After code is added, open up our variable explorer which will cause a data fetch
        //openVariableExplorer(wrapper);
        //openVariableExplorer(wrapper);

        // Verify that we actually update the variable explorer
        // Count here is our main render + a render for each variable row as they come in
        // IANU calculate this based on var count automatically
        await waitForUpdate(wrapper, VariableExplorer, 6);

        //const requestingValues = getValuesPromise();
        //await requestingValues;
        const targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myDict', value: '{0: 0.0, 1: 0.5, 4: 2.0, 9: 4.5, 16: 8.0, 25: 12.5, 36: 18.0, 49: 24.5, 64: 32.0, 81: 40.5, 100: 50.0, 121: 60.5, 144: 72.0, 169: 84.5, 196: 98.0, 225: 112.5, 256: 128.0, 289: 144.5, 324: 162.0, 361: ', supportsDataExplorer: true, type: 'dict', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myList', value: '[0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225, 256, 289, 324, 361, 400, 441, 484, 529, 576, 625, 676, 729, 784, 841, 900, 961, 1024, 1089, 1156, 1225, 1296, 1369, 1444, 1521, 1600,', supportsDataExplorer: true, type: 'list', size: 54, shape: '', count: 0, truncated: false},
            {name: 'mySet', value: '{0, 1, 262144, 1048576, 4, 16777216, 9437184, 67108864, 58982400, 9, 268435456, 1073741824, 2415919104, 4294967296, 6710886400, 132342016, 16, 1073479696, 1074003984, 3088580625, 4295491600, 429444302', supportsDataExplorer: true, type: 'set', size: 54, shape: '', count: 0, truncated: false},
            {name: 'value', value: '9999800001', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
        ];
        verifyVariables(wrapper, targetVariables);

        //const varExplorer = findVariableExplorer(wrapper);

        //verifyHtmlOnCell(wrapper, '<span>1</span>', CellPosition.Last);
    });

  //});

    // *********** Note all of the above code is shared with history.functional.test.tsx should be combine? Move into same file or add helpers? ************
    runMountedTest('Variable explorer - Basic B', async (wrapper) => {
        const basicCode: string = `import numpy as np
import pandas as pd
myComplex = complex(1, 1)
myInt = 99999999
myFloat = 9999.9999
mynpArray = np.linspace(0, 100000, 50000,endpoint=True)
myDataframe = pd.DataFrame(mynpArray)
mySeries = myDataframe[0]
myTuple = 1,2,3,4,5,6,7,8,9
`;

        // Set up our mock data first
        addMockData(ioc, basicCode, undefined);

        openVariableExplorer(wrapper);

        await addCode(getOrCreateHistory, wrapper, 'a=1\na');
        await addCode(getOrCreateHistory, wrapper, basicCode, 4);

        // After code is added, open up our variable explorer which will cause a data fetch
        //openVariableExplorer(wrapper);
        //openVariableExplorer(wrapper);

        // Verify that we actually update the variable explorer
        // Count here is our main render + a render for each variable row as they come in
        // IANU calculate this based on var count automatically
        await waitForUpdate(wrapper, VariableExplorer, 9);

        //const requestingValues = getValuesPromise();
        //await requestingValues;
        const targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myComplex', value: '(1+1j)', supportsDataExplorer: false, type: 'complex', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myDataframe', value: '                  0\n0           0.00000\n1           2.00004\n2           4.00008\n3           6.00012\n4           8.00016\n5          10.00020\n6          12.00024\n7          14.00028\n8          16.00032\n', supportsDataExplorer: true, type: 'DataFrame', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myFloat', value: '9999.9999', supportsDataExplorer: false, type: 'float', size: 58, shape: '', count: 0, truncated: false},
            {name: 'myInt', value: '99999999', supportsDataExplorer: false, type: 'int', size: 56, shape: '', count: 0, truncated: false},
            {name: 'mySeries', value: `0             0.00000
1             2.00004
2             4.00008
3             6.00012
4             8.00016
5            10.00020
6            12.00024
7            14.00028
8            16.00032
9 `, supportsDataExplorer: true, type: 'Series', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myTuple', value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)', supportsDataExplorer: false, type: 'tuple', size: 54, shape: '', count: 0, truncated: false},
            {name: 'mynpArray', value: `[0.00000000e+00 2.00004000e+00 4.00008000e+00 ... 9.99959999e+04
 9.99980000e+04 1.00000000e+05]`, supportsDataExplorer: true, type: 'ndarray', size: 54, shape: '', count: 0, truncated: false}
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

    expect(foundRows.length).to.be.equal(targetVariables.length, 'Different number of variable explorer rows and target variables');
    //assert(foundRows.length === targetVariables.length);

    foundRows.forEach((row, index) => {
        verifyRow(row, targetVariables[index]);
    });
}

function verifyRow(rowWrapper: ReactWrapper<any, Readonly<{}>, React.Component>, targetVariable: IJupyterVariable) {
    const rowCells = rowWrapper.find('div.react-grid-Cell');

    expect(rowCells.length).to.be.equal(5, 'Unexpected number of cells in variable explorer row');

    verifyCell(rowCells.at(0), targetVariable.name, targetVariable.name);
    verifyCell(rowCells.at(1), targetVariable.type, targetVariable.name);
    //verifyCell(rowCells.at(2), targetVariable.size.toString());
    verifyCell(rowCells.at(3), targetVariable.value ? targetVariable.value : '', targetVariable.name);
}

function verifyCell(cellWrapper: ReactWrapper<any, Readonly<{}>, React.Component>, value: string, targetName: string) {
    const cellHTML = parse(cellWrapper.html()) as any;
    // tslint:disable-next-line:no-string-literal
    expect(cellHTML.firstChild.rawAttributes['value'] as string).to.be.equal(value, `${targetName} has an unexpected value in variable explorer cell`);
}
