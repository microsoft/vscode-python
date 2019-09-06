// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { expect } from 'chai';
import { ReactWrapper } from 'enzyme';
import { parse } from 'node-html-parser';
import * as React from 'react';
import { Disposable } from 'vscode';

import {
    InteractiveWindowMessageListener
} from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IInteractiveWindow, IInteractiveWindowProvider, IJupyterVariable } from '../../client/datascience/types';
import { VariableExplorer } from '../../datascience-ui/interactive-common/variableExplorer';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { addCode, runMountedTest } from './interactiveWindowTestHelpers';
import { waitForUpdate } from './reactHelpers';

// tslint:disable:max-func-body-length trailing-comma no-any no-multiline-string
suite('DataScience Interactive Window variable explorer tests', () => {
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;

    suiteSetup(function () {
        // These test require python, so only run with a non-mocked jupyter
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        if (!isRollingBuild) {
            // tslint:disable-next-line:no-console
            console.log('Skipping Variable Explorer tests. Requires python environment');
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
    });

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

    async function getOrCreateInteractiveWindow(): Promise<IInteractiveWindow> {
        const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
        const result = await interactiveWindowProvider.getOrCreateActive();

        // During testing the MainPanel sends the init message before our interactive window is created.
        // Pretend like it's happening now
        const listener = ((result as any).messageListener) as InteractiveWindowMessageListener;
        listener.onMessage(InteractiveWindowMessages.Started, {});

        return result;
    }

    runMountedTest('Variable explorer - Exclude', async (wrapper) => {
        const basicCode: string = `import numpy as np
import pandas as pd
value = 'hello world'`;
        const basicCode2: string = `value2 = 'hello world 2'`;

        openVariableExplorer(wrapper);

        await addCode(getOrCreateInteractiveWindow, wrapper, 'a=1\na');
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode, 4);
        await waitForUpdate(wrapper, VariableExplorer, 3);

        // We should show a string and show an int, the modules should be hidden
        let targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'value', value: "'hello world'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);

        // Update our exclude list to exclude strings
        ioc.getSettings().datascience.variableExplorerExclude = `${ioc.getSettings().datascience.variableExplorerExclude};str`;

        // Add another string and check our vars, strings should be hidden
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode2, 4);
        await waitForUpdate(wrapper, VariableExplorer, 2);

        targetVariables = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    }, () => { return ioc; });

    runMountedTest('Variable explorer - Update', async (wrapper) => {
        const basicCode: string = `value = 'hello world'`;
        const basicCode2: string = `value2 = 'hello world 2'`;

        openVariableExplorer(wrapper);

        await addCode(getOrCreateInteractiveWindow, wrapper, 'a=1\na');
        await waitForUpdate(wrapper, VariableExplorer, 2);

        // Check that we have just the 'a' variable
        let targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
        ];
        verifyVariables(wrapper, targetVariables);

        // Add another variable and check it
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode, 4);
        await waitForUpdate(wrapper, VariableExplorer, 3);

        targetVariables = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'value', value: "'hello world'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);

        // Add a second variable and check it
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode2, 4);
        await waitForUpdate(wrapper, VariableExplorer, 4);

        targetVariables = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'value', value: "'hello world'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'value2', value: "'hello world 2'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    }, () => { return ioc; });

    runMountedTest('Variable explorer - Loading', async (wrapper) => {
        const basicCode: string = `value = 'hello world'`;

        openVariableExplorer(wrapper);

        await addCode(getOrCreateInteractiveWindow, wrapper, 'a=1\na');
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode, 4);

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
            // tslint:disable-next-line:quotemark
            {name: 'value', value: "'hello world'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    }, () => { return ioc; });

    // Test our display of basic types. We render 8 rows by default so only 8 values per test
    runMountedTest('Variable explorer - Types A', async (wrapper) => {
        const basicCode: string = `myList = [1, 2, 3]
mySet = set([42])
myDict = {'a': 1}`;

        openVariableExplorer(wrapper);

        await addCode(getOrCreateInteractiveWindow, wrapper, 'a=1\na');
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode, 4);

        // Verify that we actually update the variable explorer
        // Count here is our main render + a render for each variable row as they come in
        await waitForUpdate(wrapper, VariableExplorer, 5);

        const targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'myDict', value: "{'a': 1}", supportsDataExplorer: true, type: 'dict', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myList', value: '[1, 2, 3]', supportsDataExplorer: true, type: 'list', size: 54, shape: '', count: 0, truncated: false},
            // Set can vary between python versions, so just don't both to check the value, just see that we got it
            {name: 'mySet', value: undefined, supportsDataExplorer: true, type: 'set', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    }, () => { return ioc; });

    runMountedTest('Variable explorer - Basic B', async (wrapper) => {
        const basicCode: string = `import numpy as np
import pandas as pd
myComplex = complex(1, 1)
myInt = 99999999
myFloat = 9999.9999
mynpArray = np.array([1.0, 2.0, 3.0])
myDataframe = pd.DataFrame(mynpArray)
mySeries = myDataframe[0]
myTuple = 1,2,3,4,5,6,7,8,9
`;

        openVariableExplorer(wrapper);

        await addCode(getOrCreateInteractiveWindow, wrapper, 'a=1\na');
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode, 4);

        // Verify that we actually update the variable explorer
        // Count here is our main render + a render for each variable row as they come in
        await waitForUpdate(wrapper, VariableExplorer, 9);

        const targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myComplex', value: '(1+1j)', supportsDataExplorer: false, type: 'complex', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myDataframe', value: `0
0 1.0
1 2.0
2 3.0`, supportsDataExplorer: true, type: 'DataFrame', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myFloat', value: '9999.9999', supportsDataExplorer: false, type: 'float', size: 58, shape: '', count: 0, truncated: false},
            {name: 'myInt', value: '99999999', supportsDataExplorer: false, type: 'int', size: 56, shape: '', count: 0, truncated: false},
            {name: 'mynpArray', value: 'array([1., 2., 3.])', supportsDataExplorer: true, type: 'ndarray', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable:no-trailing-whitespace
            {name: 'mySeries', value: `0 1.0
1 2.0
2 3.0
Name: 0, dtype: float64`, supportsDataExplorer: true, type: 'Series', size: 54, shape: '', count: 0, truncated: false},
            {name: 'myTuple', value: '(1, 2, 3, 4, 5, 6, 7, 8, 9)', supportsDataExplorer: false, type: 'tuple', size: 54, shape: '', count: 0, truncated: false}
        ];
        verifyVariables(wrapper, targetVariables);
    }, () => { return ioc; });

    runMountedTest('Variable explorer - Sorting', async (wrapper) => {
        const basicCode: string = `b = 2
c = 3
stra = 'a'
strb = 'b'
strc = 'c'`;

        openVariableExplorer(wrapper);

        await addCode(getOrCreateInteractiveWindow, wrapper, 'a=1\na');
        await addCode(getOrCreateInteractiveWindow, wrapper, basicCode, 4);

        await waitForUpdate(wrapper, VariableExplorer, 7);

        let targetVariables: IJupyterVariable[] = [
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'b', value: '2', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'c', value: '3', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'stra', value: "'a'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'strb', value: "'b'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'strc', value: "'c'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
        ];
        verifyVariables(wrapper, targetVariables);

        sortVariableExplorer(wrapper, 'value', 'DESC');

        targetVariables = [
            {name: 'c', value: '3', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'b', value: '2', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            {name: 'a', value: '1', supportsDataExplorer: false, type: 'int', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'strc', value: "'c'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'strb', value: "'b'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
            // tslint:disable-next-line:quotemark
            {name: 'stra', value: "'a'", supportsDataExplorer: false, type: 'str', size: 54, shape: '', count: 0, truncated: false},
        ];
        verifyVariables(wrapper, targetVariables);
    }, () => { return ioc; });
});

// Open up our variable explorer which also triggers a data fetch
function openVariableExplorer(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
    const varExp: VariableExplorer = wrapper.find('VariableExplorer').instance() as VariableExplorer;

    assert(varExp);

    if (varExp) {
        varExp.setState({open: true});
        varExp.props.variableExplorerToggled(true);
    }
}

function sortVariableExplorer(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, sortColumn: string, sortDirection: string) {
    const varExp: VariableExplorer = wrapper.find('VariableExplorer').instance() as VariableExplorer;

    assert(varExp);

    if (varExp) {
        varExp.sortRows(sortColumn, sortDirection);
    }
}

// Verify a set of rows versus a set of expected variables
function verifyVariables(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, targetVariables: IJupyterVariable[]) {
    const foundRows = wrapper.find('div.react-grid-Row');

    expect(foundRows.length).to.be.equal(targetVariables.length, 'Different number of variable explorer rows and target variables');

    foundRows.forEach((row, index) => {
        verifyRow(row, targetVariables[index]);
    });
}

// Verify a single row versus a single expected variable
function verifyRow(rowWrapper: ReactWrapper<any, Readonly<{}>, React.Component>, targetVariable: IJupyterVariable) {
    const rowCells = rowWrapper.find('div.react-grid-Cell');

    expect(rowCells.length).to.be.equal(5, 'Unexpected number of cells in variable explorer row');

    verifyCell(rowCells.at(0), targetVariable.name, targetVariable.name);
    verifyCell(rowCells.at(1), targetVariable.type, targetVariable.name);

    if (targetVariable.shape && targetVariable.shape !== '') {
        verifyCell(rowCells.at(2), targetVariable.shape, targetVariable.name);
    } else if (targetVariable.count) {
        verifyCell(rowCells.at(2), targetVariable.count.toString(), targetVariable.name);
    }

    if (targetVariable.value) {
        verifyCell(rowCells.at(3), targetVariable.value, targetVariable.name);
    }
}

// Verify a single cell value against a specific target value
function verifyCell(cellWrapper: ReactWrapper<any, Readonly<{}>, React.Component>, value: string, targetName: string) {
    const cellHTML = parse(cellWrapper.html()) as any;
    // tslint:disable-next-line:no-string-literal
    const rawValue = cellHTML.firstChild.rawAttributes['value'] as string;

    // Eliminate whitespace differences
    const actualValueNormalized = rawValue.replace(/^\s*|\s(?=\s)|\s*$/g, '').replace(/\r\n/g, '\n');
    const expectedValueNormalized = value.replace(/^\s*|\s(?=\s)|\s*$/g, '').replace(/\r\n/g, '\n');

    expect(actualValueNormalized).to.be.equal(expectedValueNormalized, `${targetName} has an unexpected value in variable explorer cell`);
}
