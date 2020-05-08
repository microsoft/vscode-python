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
import { IJupyterDebugService, IJupyterVariable } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { getOrCreateInteractiveWindow } from './interactiveWindowTestHelpers';
import { MockDocumentManager } from './mockDocumentManager';
import { waitForVariablesUpdated } from './testHelpers';

// tslint:disable: no-var-requires no-require-imports no-any

export async function verifyAfterStep(
    ioc: DataScienceIocContainer,
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    targetVariables: IJupyterVariable[]
) {
    const interactive = await getOrCreateInteractiveWindow(ioc);
    const debuggerBroke = createDeferred();
    const jupyterDebugger = ioc.get<IJupyterDebugService>(IJupyterDebugService, Identifiers.MULTIPLEXING_DEBUGSERVICE);
    jupyterDebugger.onBreakpointHit(() => debuggerBroke.resolve());
    const docManager = ioc.get<IDocumentManager>(IDocumentManager) as MockDocumentManager;
    const file = Uri.file('foo.py');
    docManager.addDocument('a=1\na', file.fsPath);
    const debugPromise = interactive.debugCode('a=1\na', file.fsPath, 1, undefined, undefined);
    await debuggerBroke.promise;
    const variableRefresh = waitForVariablesUpdated(ioc, 2); // Two times. Once for the initial refresh and another for the values.
    await jupyterDebugger.requestVariables(); // This is necessary because not running inside of VS code. Normally it would do this.
    await variableRefresh;
    wrapper.update();
    verifyVariables(wrapper, targetVariables);
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

    verifyCell(rowCells.at(4), targetVariable.supportsDataExplorer, targetVariable.name);
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
