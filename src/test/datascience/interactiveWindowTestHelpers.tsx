// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import { Uri } from 'vscode';

import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { IInteractiveWindow, IInteractiveWindowProvider, IJupyterExecution } from '../../client/datascience/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { addMockData, getCellResults, mountWebView } from './testHelpers';

export function getInteractiveCellResults(
    ioc: DataScienceIocContainer,
    // tslint:disable-next-line: no-any
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    updater: () => Promise<void>
    // tslint:disable-next-line: no-any
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(ioc, wrapper, 'InteractiveCell', updater);
}

export async function getOrCreateInteractiveWindow(ioc: DataScienceIocContainer): Promise<IInteractiveWindow> {
    const interactiveWindowProvider = ioc.get<IInteractiveWindowProvider>(IInteractiveWindowProvider);
    return (await interactiveWindowProvider.getOrCreateActive()) as InteractiveWindow;
}

export function closeInteractiveWindow(
    window: IInteractiveWindow,
    // tslint:disable-next-line: no-any
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>
) {
    const promise = window.dispose();
    wrapper.unmount();
    return promise;
}

export function runMountedTest(
    name: string,
    // tslint:disable-next-line:no-any
    testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>,
    getIOC: () => DataScienceIocContainer
) {
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

export async function addCode(
    ioc: DataScienceIocContainer,
    // tslint:disable-next-line: no-any
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    code: string,
    expectError: boolean = false,
    uri: Uri = Uri.file('foo.py')
    // tslint:disable-next-line: no-any
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    // Adding code should cause 5 renders to happen.
    // 1) Input
    // 2) Status ready
    // 3) Execute_Input message
    // 4) Output message (if there's only one)
    // 5) Status finished
    return getInteractiveCellResults(ioc, wrapper, async () => {
        const history = await getOrCreateInteractiveWindow(ioc);
        const success = await history.addCode(code, uri.fsPath, 2);
        if (expectError) {
            assert.equal(success, false, `${code} did not produce an error`);
        }
    });
}
