// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import { ReactWrapper } from 'enzyme';
import { parse } from 'node-html-parser';
import * as React from 'react';

import { Uri } from 'vscode';
import { IDocumentManager } from '../../client/common/application/types';
import { createDeferred } from '../../client/common/utils/async';
import { Identifiers } from '../../client/datascience/constants';
import { getDefaultInteractiveIdentity } from '../../client/datascience/interactive-window/identity';
import {
    IJupyterDebugService,
    IJupyterVariable,
    IJupyterVariables,
    INotebookProvider
} from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { getOrCreateInteractiveWindow } from './interactiveWindowTestHelpers';
import { MockDocumentManager } from './mockDocumentManager';
import { waitForVariablesUpdated } from './testHelpers';

// tslint:disable: no-var-requires no-require-imports no-any chai-vague-errors no-unused-expression

export async function verifyAfterStep(
    ioc: DataScienceIocContainer,
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    verify: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>,
    numberOfRefreshesRequired: number = 1
) {
    const interactive = await getOrCreateInteractiveWindow(ioc);
    const debuggerBroke = createDeferred();
    const jupyterDebugger = ioc.get<IJupyterDebugService>(IJupyterDebugService, Identifiers.MULTIPLEXING_DEBUGSERVICE);
    jupyterDebugger.onBreakpointHit(() => debuggerBroke.resolve());
    const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
    const file = Uri.file('foo.py');
    docManager.addDocument('a=1\na', file.fsPath);
    const debugPromise = interactive.window.debugCode('a=1\na', file, 1, undefined, undefined);
    await debuggerBroke.promise;
    const variableRefresh = waitForVariablesUpdated(interactive.mount, numberOfRefreshesRequired);
    await jupyterDebugger.requestVariables(); // This is necessary because not running inside of VS code. Normally it would do this.
    await variableRefresh;
    wrapper.update();
    await verify(wrapper);
    await jupyterDebugger.continue();
    return debugPromise;
}

// Verify a set of rows versus a set of expected variables
export function verifyVariables(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    targetVariables: IJupyterVariable[]
) {
    // Force an update so we render whatever the current state is
    wrapper.update();

    // Then search for results.
    const foundRows = wrapper.find('div.react-grid-Row');

    expect(foundRows.length).to.be.equal(
        targetVariables.length,
        'Different number of variable explorer rows and target variables'
    );

    foundRows.forEach((row, index) => {
        verifyRow(row, targetVariables[index]);
    });
}

const Button_Column = 0;
const Name_Column = Button_Column + 1;
const Type_Column = Name_Column + 1;
const Shape_Column = Type_Column + 1;
const Value_Column = Shape_Column + 1;

// Verify a single row versus a single expected variable
function verifyRow(rowWrapper: ReactWrapper<any, Readonly<{}>, React.Component>, targetVariable: IJupyterVariable) {
    const rowCells = rowWrapper.find('div.react-grid-Cell');

    expect(rowCells.length).to.be.equal(5, 'Unexpected number of cells in variable explorer row');

    verifyCell(rowCells.at(Name_Column), targetVariable.name, targetVariable.name);
    verifyCell(rowCells.at(Type_Column), targetVariable.type, targetVariable.name);

    if (targetVariable.shape && targetVariable.shape !== '') {
        verifyCell(rowCells.at(Shape_Column), targetVariable.shape, targetVariable.name);
    } else if (targetVariable.count) {
        verifyCell(rowCells.at(Shape_Column), targetVariable.count.toString(), targetVariable.name);
    }

    if (targetVariable.value) {
        verifyCell(rowCells.at(Value_Column), targetVariable.value, targetVariable.name);
    }

    verifyCell(rowCells.at(Button_Column), targetVariable.supportsDataExplorer, targetVariable.name);
}

// Verify a single cell value against a specific target value
function verifyCell(
    cellWrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    value: string | boolean,
    targetName: string
) {
    const cellHTML = parse(cellWrapper.html()) as any;
    const innerHTML = cellHTML.innerHTML;
    if (typeof value === 'string') {
        // tslint:disable-next-line:no-string-literal
        const match = /value="([\s\S]+?)"\s+/.exec(innerHTML);
        expect(match).to.not.be.equal(null, `${targetName} does not have a value attribute`);

        // Eliminate whitespace differences
        const actualValueNormalized = match![1].replace(/^\s*|\s(?=\s)|\s*$/g, '').replace(/\r\n/g, '\n');
        const expectedValueNormalized = value.replace(/^\s*|\s(?=\s)|\s*$/g, '').replace(/\r\n/g, '\n');

        expect(actualValueNormalized).to.be.equal(
            expectedValueNormalized,
            `${targetName} has an unexpected value ${innerHTML} in variable explorer cell`
        );
    } else {
        if (value) {
            expect(innerHTML).to.include('image-button-image', `Image class not found in ${targetName}`);
        } else {
            expect(innerHTML).to.not.include('image-button-image', `Image class was found ${targetName}`);
        }
    }
}

export async function verifyCanFetchData<T>(
    ioc: DataScienceIocContainer,
    executionCount: number,
    name: string,
    rows: T[]
) {
    const variableFetcher = ioc.get<IJupyterVariables>(IJupyterVariables, Identifiers.ALL_VARIABLES);
    const notebookProvider = ioc.get<INotebookProvider>(INotebookProvider);
    const notebook = await notebookProvider.getOrCreateNotebook({
        getOnly: true,
        identity: getDefaultInteractiveIdentity()
    });
    expect(notebook).to.not.be.undefined;
    const variableList = await variableFetcher.getVariables(
        {
            executionCount,
            startIndex: 0,
            pageSize: 100,
            sortAscending: true,
            sortColumn: 'INDEX',
            refreshCount: 0
        },
        notebook!
    );
    expect(variableList.pageResponse.length).to.be.greaterThan(0, 'No variables returned');
    const variable = variableList.pageResponse.find((v) => v.name === name);
    expect(variable).to.not.be.undefined;
    expect(variable?.supportsDataExplorer).to.eq(true, `Variable ${name} does not support data explorer`);
    const withInfo = await variableFetcher.getDataFrameInfo(variable!, notebook!);
    expect(withInfo.count).to.eq(rows.length, 'Wrong number of rows for variable');
    const fetchedRows = await variableFetcher.getDataFrameRows(withInfo!, 0, rows.length, notebook!);
    expect(fetchedRows.data).to.have.length(rows.length, 'Fetched rows data is not the correct size');
    for (let i = 0; i < rows.length; i += 1) {
        const fetchedRow = (fetchedRows.data as any)[i];
        const val = fetchedRow['0']; // Column should default to zero for tests calling this.
        expect(val).to.be.eq(rows[i], 'Invalid value found');
    }
}
