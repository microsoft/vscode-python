// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import * as React from 'react';
import { Uri } from 'vscode';

import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { CursorPos } from '../../datascience-ui/interactive-common/mainState';
import { NativeCell } from '../../datascience-ui/native-editor/nativeCell';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView } from './mountedWebView';
import { getCellResults, getNativeFocusedEditor, injectCode, simulateKey } from './testHelpers';
import { ITestNativeEditorProvider } from './testNativeEditorProvider';

// tslint:disable: no-any

async function getOrCreateNativeEditor(ioc: DataScienceIocContainer, uri?: Uri) {
    const notebookEditorProvider = ioc.get<ITestNativeEditorProvider>(INotebookEditorProvider);
    let editor: INotebookEditor | undefined;
    const messageWaiter = notebookEditorProvider.waitForMessage(uri, InteractiveWindowMessages.LoadAllCellsComplete);
    if (uri) {
        editor = await notebookEditorProvider.open(uri);
    } else {
        editor = await notebookEditorProvider.createNew();
    }
    if (editor) {
        await messageWaiter;
    }

    return { editor, mount: notebookEditorProvider.getMountedWebView(editor) };
}

export async function createNewEditor(ioc: DataScienceIocContainer) {
    return getOrCreateNativeEditor(ioc);
}

export async function openEditor(
    ioc: DataScienceIocContainer,
    contents: string,
    filePath: string = '/usr/home/test.ipynb'
) {
    const uri = Uri.file(filePath);
    ioc.setFileContents(uri, contents);
    return getOrCreateNativeEditor(ioc, uri);
}

// tslint:disable-next-line: no-any
export function getNativeCellResults(
    mounted: IMountedWebView,
    updater: () => Promise<void>,
    renderPromiseGenerator?: () => Promise<void>
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    return getCellResults(mounted, 'NativeCell', updater, renderPromiseGenerator);
}

// tslint:disable-next-line:no-any
export function runMountedTest(name: string, testFunc: (context: Mocha.Context) => Promise<void>) {
    test(name, async function () {
        // tslint:disable-next-line: no-invalid-this
        await testFunc(this);
    });
}

export function focusCell(mounted: IMountedWebView, index: number): Promise<void> {
    const cell = mounted.wrapper.find(NativeCell).at(index);
    if (cell) {
        const vm = cell.props().cellVM;
        if (!vm.focused) {
            const focusChange = mounted.waitForMessage(InteractiveWindowMessages.FocusedCellEditor);
            cell.props().focusCell(vm.cell.id, CursorPos.Current);
            return focusChange;
        }
    }
    return Promise.resolve();
}

// tslint:disable-next-line: no-any
export async function addCell(mounted: IMountedWebView, code: string, submit: boolean = true): Promise<void> {
    // First get the main toolbar. We'll use this to add a cell.
    const toolbar = mounted.wrapper.find('#main-panel-toolbar');
    assert.ok(toolbar, 'Cannot find the main panel toolbar during adding a cell');
    const ImageButtons = toolbar.find(ImageButton);
    assert.equal(ImageButtons.length, 10, 'Toolbar buttons not found');
    const addButton = ImageButtons.at(5);
    let update = mounted.waitForMessage(InteractiveWindowMessages.FocusedCellEditor);
    addButton.simulate('click');

    await update;

    let textArea: HTMLTextAreaElement | null;
    if (code) {
        // Type in the code
        const editorEnzyme = getNativeFocusedEditor(mounted.wrapper);
        textArea = injectCode(editorEnzyme, code);
    }

    if (submit) {
        // Then run the cell (use ctrl+enter so we don't add another cell)
        update = mounted.waitForMessage(InteractiveWindowMessages.ExecutionRendered);
        simulateKey(textArea!, 'Enter', false, true);
        return update;
    }
}

export function closeNotebook(ioc: DataScienceIocContainer, editor: INotebookEditor): Promise<void> {
    const promise = editor.dispose();
    ioc.getNativeWebPanel(editor).dispose();
    return promise;
}
