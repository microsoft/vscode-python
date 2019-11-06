// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';

import { Uri } from 'vscode';
import { IInteractiveWindow, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { InteractivePanel } from '../../datascience-ui/history-react/interactivePanel';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { addMockData, getCellResults, mountWebView } from './testHelpers';

// tslint:disable-next-line: no-any
export function getInteractiveCellResults(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedRenders: number, updater: () => Promise<void>): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(wrapper, InteractivePanel, 'InteractiveCell', expectedRenders, updater);
}

export function getOrCreateInteractiveWindow(ioc: DataScienceIocContainer): Promise<IInteractiveWindow> {
    const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
    return interactiveWindowProvider.getOrCreateActive();
}

// tslint:disable-next-line:no-any
export function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>, getIOC: () => DataScienceIocContainer) {
    test(name, async () => {
        const ioc = getIOC();
        const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
        if (await jupyterExecution.isNotebookSupported()) {
            addMockData(ioc, 'a=1\na', 1);
            const wrapper = mountWebView(ioc, 'interactive');
            await testFunc(wrapper);
        } else {
            // tslint:disable-next-line:no-console
            console.log(`${name} skipped, no Jupyter installed.`);
        }
    });
}

// tslint:disable-next-line: no-any
export async function addCode(ioc: DataScienceIocContainer, wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, code: string, expectedRenderCount: number = 4, expectError: boolean = false): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    // Adding code should cause 5 renders to happen.
    // 1) Input
    // 2) Status ready
    // 3) Execute_Input message
    // 4) Output message (if there's only one)
    // 5) Status finished
    return getInteractiveCellResults(wrapper, expectedRenderCount, async () => {
        const history = await getOrCreateInteractiveWindow(ioc);
        const success = await history.addCode(code, Uri.file('foo.py').fsPath, 2);
        if (expectError) {
            assert.equal(success, false, `${code} did not produce an error`);
        }
    });
}
