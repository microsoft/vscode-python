// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import { Uri } from 'vscode';

import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterExecution, INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { CursorPos } from '../../datascience-ui/interactive-common/mainState';
import { NativeCell } from '../../datascience-ui/native-editor/nativeCell';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { addMockData, getCellResults, getNativeFocusedEditor, injectCode, mountWebView, simulateKey, waitForMessage } from './testHelpers';

// tslint:disable: no-any

async function getOrCreateNativeEditor(ioc: DataScienceIocContainer, uri?: Uri, contents?: string): Promise<INotebookEditor> {
    const notebookProvider = ioc.get<INotebookEditorProvider>(INotebookEditorProvider);
    let editor: INotebookEditor | undefined;
    const messageWaiter = waitForMessage(ioc, InteractiveWindowMessages.LoadAllCellsComplete);
    if (uri && contents) {
        editor = await notebookProvider.open(uri, contents);
    } else {
        editor = await notebookProvider.createNew();
    }
    if (editor) {
        await messageWaiter;
    }

    return editor;
}

export async function createNewEditor(ioc: DataScienceIocContainer): Promise<INotebookEditor> {
    return getOrCreateNativeEditor(ioc);
}

export async function openEditor(ioc: DataScienceIocContainer, contents: string, filePath: string = '/usr/home/test.ipynb'): Promise<INotebookEditor> {
    const uri = Uri.file(filePath);
    return getOrCreateNativeEditor(ioc, uri, contents);
}

// tslint:disable-next-line: no-any
export function getNativeCellResults(
    ioc: DataScienceIocContainer,
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    updater: () => Promise<void>,
    renderPromiseGenerator?: () => Promise<void>
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(ioc, wrapper, 'NativeCell', updater, renderPromiseGenerator);
}

// tslint:disable-next-line:no-any
export function runMountedTest(
    name: string,
    testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, context: Mocha.Context) => Promise<void>,
    getIOC: () => DataScienceIocContainer
) {
    test(name, async function() {
        const ioc = getIOC();
        const wrapper = await setupWebview(ioc);
        if (wrapper) {
            // tslint:disable-next-line: no-invalid-this
            await testFunc(wrapper, this);
        } else {
            // tslint:disable-next-line:no-console
            console.log(`${name} skipped, no Jupyter installed.`);
        }
    });
}

export function mountNativeWebView(ioc: DataScienceIocContainer): ReactWrapper<any, Readonly<{}>, React.Component> {
    return mountWebView(ioc, 'native');
}
export async function setupWebview(ioc: DataScienceIocContainer) {
    const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
    if (await jupyterExecution.isNotebookSupported()) {
        addMockData(ioc, 'a=1\na', 1);
        return mountNativeWebView(ioc);
    }
}

export function focusCell(ioc: DataScienceIocContainer, wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, index: number): Promise<void> {
    const cell = wrapper.find(NativeCell).at(index);
    if (cell) {
        const vm = cell.props().cellVM;
        if (!vm.focused) {
            const focusChange = waitForMessage(ioc, InteractiveWindowMessages.FocusedCellEditor);
            cell.props().focusCell(vm.cell.id, CursorPos.Current);
            return focusChange;
        }
    }
    return Promise.resolve();
}

// tslint:disable-next-line: no-any
export async function addCell(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, ioc: DataScienceIocContainer, code: string, submit: boolean = true): Promise<void> {
    // First get the main toolbar. We'll use this to add a cell.
    const toolbar = wrapper.find('#main-panel-toolbar');
    assert.ok(toolbar, 'Cannot find the main panel toolbar during adding a cell');
    const ImageButtons = toolbar.find(ImageButton);
    assert.equal(ImageButtons.length, 10, 'Toolbar buttons not found');
    const addButton = ImageButtons.at(5);
    let update = waitForMessage(ioc, InteractiveWindowMessages.FocusedCellEditor);
    addButton.simulate('click');

    if (submit) {
        await update;

        // Type in the code
        const editorEnzyme = getNativeFocusedEditor(wrapper);
        const textArea = injectCode(editorEnzyme, code);

        // Then run the cell (use ctrl+enter so we don't add another cell)
        update = waitForMessage(ioc, InteractiveWindowMessages.ExecutionRendered);
        simulateKey(textArea!, 'Enter', false, true);

        return update;
    } else {
        return update;
    }
}

export function closeNotebook(editor: INotebookEditor, wrapper: ReactWrapper<any, Readonly<{}>, React.Component>): Promise<void> {
    const promise = editor.dispose();
    wrapper.unmount();
    return promise;
}
