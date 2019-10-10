// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import { Uri } from 'vscode';

import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterExecution, INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { NativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { waitForUpdate } from './reactHelpers';
import { addMockData, getCellResults, getMainPanel, mountWebView, waitForMessage } from './testHelpers';

// tslint:disable: no-any

async function getOrCreateNativeEditor(ioc: DataScienceIocContainer, uri?: Uri, contents?: string): Promise<INotebookEditor> {
    const notebookProvider = ioc.get<INotebookEditorProvider>(INotebookEditorProvider);
    if (uri && contents) {
        return notebookProvider.open(uri, contents);
    } else {
        return notebookProvider.createNew();
    }
}

export async function createNewEditor(ioc: DataScienceIocContainer): Promise<INotebookEditor> {
    const loaded = waitForMessage(ioc, InteractiveWindowMessages.LoadAllCellsComplete);
    const result = await getOrCreateNativeEditor(ioc);
    await loaded;
    return result;
}

export async function openEditor(ioc: DataScienceIocContainer, contents: string): Promise<INotebookEditor> {
    const loaded = waitForMessage(ioc, InteractiveWindowMessages.LoadAllCellsComplete);
    const uri = Uri.parse('file:////usr/home/test.ipynb');
    const result = await getOrCreateNativeEditor(ioc, uri, contents);
    await loaded;
    return result;
}

// tslint:disable-next-line: no-any
export function getNativeCellResults(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedRenders: number, updater: () => Promise<void>): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(wrapper, NativeEditor, 'NativeCell', expectedRenders, updater);
}

// tslint:disable-next-line:no-any
export function runMountedTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>, getIOC: () => DataScienceIocContainer) {
    test(name, async () => {
        const ioc = getIOC();
        const wrapper = await setupWebview(ioc);
        if (wrapper) {
            await testFunc(wrapper);
        } else {
            // tslint:disable-next-line:no-console
            console.log(`${name} skipped, no Jupyter installed.`);
        }
    });
}

export function mountNativeWebView(ioc: DataScienceIocContainer): ReactWrapper<any, Readonly<{}>, React.Component> {
    return mountWebView(ioc, <NativeEditor baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />);
}
export async function setupWebview(ioc: DataScienceIocContainer) {
    const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
    if (await jupyterExecution.isNotebookSupported()) {
        addMockData(ioc, 'a=1\na', 1);
        return mountNativeWebView(ioc);
    }
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

export function closeNotebook(editor: INotebookEditor, wrapper: ReactWrapper<any, Readonly<{}>, React.Component>): Promise<void> {
    const reactEditor = getMainPanel<NativeEditor>(wrapper, NativeEditor);
    if (reactEditor) {
        reactEditor.stateController.reset();
    }
    return editor.dispose();
}
