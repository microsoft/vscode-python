// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';

import { IJupyterExecution, INotebookEditor } from '../../client/datascience/types';
import { NativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { addMockData, mountWebView, getMainPanel } from './testHelpers';

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

export async function addCell(editor: INotebookEditor, wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, code: string, expectedRenderCount: number = 4): Promise<void> {
    const reactEditor = getMainPanel<NativeEditor>(wrapper, NativeEditor);
    assert.ok(reactEditor, 'Cannot find the main panel during adding a cell');
    reactEditor!.stateController.addNewCell();
}
