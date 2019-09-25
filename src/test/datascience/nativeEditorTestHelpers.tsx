// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';

import { IJupyterExecution } from '../../client/datascience/types';
import { NativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { waitForUpdate } from './reactHelpers';
import { addMockData, getCellResults, getMainPanel, mountWebView } from './testHelpers';

// tslint:disable-next-line: no-any
export function getNativeCellResults(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedRenders: number, updater: () => Promise<void>): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(wrapper, NativeEditor, 'NativeCell', expectedRenders, updater);
}

// tslint:disable-next-line:no-any
export function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>, getIOC: () => DataScienceIocContainer) {
    test(name, async () => {
        const ioc = getIOC();
        const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
        if (await jupyterExecution.isNotebookSupported()) {
            addMockData(ioc, 'a=1\na', 1);
            const wrapper = mountWebView(ioc, <NativeEditor baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />);
            await testFunc(wrapper);
        } else {
            // tslint:disable-next-line:no-console
            console.log(`${name} skipped, no Jupyter installed.`);
        }
    });
}

// tslint:disable-next-line: no-any
export async function addCell(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, code: string, submit: boolean = true, expectedSubmitRenderCount: number = 5): Promise<void> {
    // First get the stateController on the main panel. That's how we'll add a new cell.
    const reactEditor = getMainPanel<NativeEditor>(wrapper, NativeEditor);
    assert.ok(reactEditor, 'Cannot find the main panel during adding a cell');
    let update = waitForUpdate(wrapper, NativeEditor, 1);
    const vm = reactEditor!.stateController.addNewCell();

    if (submit) {
        // Then use that cell to stick new input.
        assert.ok(vm, 'Did not add a new cell to the main panel');
        await update;

        update = waitForUpdate(wrapper, NativeEditor, expectedSubmitRenderCount);
        reactEditor!.stateController.submitInput(code, vm!);
        return update;
    } else {
        // For non submit scenarios just return back the wait for the add update
        return update;
    }
}
