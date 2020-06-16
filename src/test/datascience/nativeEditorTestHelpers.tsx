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
import {
    addMockData,
    getCellResults,
    getNativeFocusedEditor,
    injectCode,
    mountWebView,
    simulateKey
} from './testHelpers';

// tslint:disable: no-any

async function getOrCreateNativeEditor(ioc: DataScienceIocContainer, uri?: Uri): Promise<INotebookEditor> {
    const notebookEditorProvider = ioc.get<INotebookEditorProvider>(INotebookEditorProvider);
    let editor: INotebookEditor | undefined;
    const messageWaiter = ioc.getWebPanel('notebook').waitForMessage(InteractiveWindowMessages.LoadAllCellsComplete);
    if (uri) {
        editor = await notebookEditorProvider.open(uri);
    } else {
        editor = await notebookEditorProvider.createNew();
    }
    if (editor) {
        await messageWaiter;
    }

    return editor;
}

export async function createNewEditor(ioc: DataScienceIocContainer): Promise<INotebookEditor> {
    return getOrCreateNativeEditor(ioc);
}

export async function openEditor(
    ioc: DataScienceIocContainer,
    contents: string,
    filePath: string = '/usr/home/test.ipynb'
): Promise<INotebookEditor> {
    const uri = Uri.file(filePath);
    ioc.setFileContents(uri, contents);
    return getOrCreateNativeEditor(ioc, uri);
}

// tslint:disable-next-line: no-any
export function getNativeCellResults(
    ioc: DataScienceIocContainer,
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    updater: () => Promise<void>,
    renderPromiseGenerator?: () => Promise<void>
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(ioc, 'notebook', wrapper, 'NativeCell', updater, renderPromiseGenerator);
}

// tslint:disable-next-line:no-any
export function runMountedTest(
    name: string,
    testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, context: Mocha.Context) => Promise<void>,
    getIOC: () => DataScienceIocContainer
) {
    test(name, async function () {
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

export function focusCell(
    ioc: DataScienceIocContainer,
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    index: number
): Promise<void> {
    const cell = wrapper.find(NativeCell).at(index);
    if (cell) {
        const vm = cell.props().cellVM;
        if (!vm.focused) {
            const focusChange = ioc.getWebPanel('notebook').waitForMessage(InteractiveWindowMessages.FocusedCellEditor);
            cell.props().focusCell(vm.cell.id, CursorPos.Current);
            return focusChange;
        }
    }
    return Promise.resolve();
}

// tslint:disable-next-line: no-any
export async function addCell(
    ioc: DataScienceIocContainer,
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    code: string,
    submit: boolean = true
): Promise<void> {
    // First get the main toolbar. We'll use this to add a cell.
    const toolbar = wrapper.find('#main-panel-toolbar');
    assert.ok(toolbar, 'Cannot find the main panel toolbar during adding a cell');
    const ImageButtons = toolbar.find(ImageButton);
    assert.equal(ImageButtons.length, 10, 'Toolbar buttons not found');
    const addButton = ImageButtons.at(5);
    let update = ioc.getWebPanel('notebook').waitForMessage(InteractiveWindowMessages.FocusedCellEditor);
    addButton.simulate('click');

    await update;

    let textArea: HTMLTextAreaElement | null;
    if (code) {
        // Type in the code
        const editorEnzyme = getNativeFocusedEditor(wrapper);
        textArea = injectCode(editorEnzyme, code);
    }

    if (submit) {
        // Then run the cell (use ctrl+enter so we don't add another cell)
        update = ioc.getWebPanel('notebook').waitForMessage(InteractiveWindowMessages.ExecutionRendered);
        simulateKey(textArea!, 'Enter', false, true);
        return update;
    }
}

export function closeNotebook(ioc: DataScienceIocContainer, editor: INotebookEditor): Promise<void> {
    const promise = editor.dispose();
    ioc.getWebPanel('notebook').dispose();
    return promise;
}
