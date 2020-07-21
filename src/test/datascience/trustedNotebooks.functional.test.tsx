// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import { Disposable } from 'vscode';
import { EnableTrustedNotebooks } from '../../client/common/experiments/groups';
import { noop } from '../../client/common/utils/misc';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditorProvider } from '../../client/datascience/types';
import { NativeCell } from '../../datascience-ui/native-editor/nativeCell';
import { NativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import { IKeyboardEvent } from '../../datascience-ui/react-common/event';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { createTemporaryFile } from '../utils/fs';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { WaitForMessageOptions } from './mountedWebView';
import { openEditor } from './nativeEditorTestHelpers';
import {
    addMockData,
    enterEditorKey,
    findButton,
    getNativeFocusedEditor,
    getOutputCell,
    isCellFocused,
    typeCode,
    verifyHtmlOnCell
} from './testHelpers';
import { ITestNativeEditorProvider } from './testNativeEditorProvider';

use(chaiAsPromised);

function waitForMessage(ioc: DataScienceIocContainer, message: string, options?: WaitForMessageOptions): Promise<void> {
    return ioc
        .get<ITestNativeEditorProvider>(INotebookEditorProvider)
        .getMountedWebView(undefined)
        .waitForMessage(message, options);
}
// tslint:disable:no-any no-multiline-string
suite('Untrusted notebooks', () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component>;
    const disposables: Disposable[] = [];
    let ioc: DataScienceIocContainer;
    const baseFile = `
{
 "cells": [
  {
   "cell_type": "code",
   "execution_count": 1,
   "metadata": {
    "collapsed": true
   },
   "outputs": [
    {
     "data": {
      "text/plain": [
       "1"
      ]
     },
     "execution_count": 1,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "a=1\\n",
    "a"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 2,
   "metadata": {},
   "outputs": [
    {
     "data": {
      "text/plain": [
       "2"
      ]
     },
     "execution_count": 2,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "b=2\\n",
    "b"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 3,
   "metadata": {},
   "outputs": [
    {
     "data": {
      "text/plain": [
       "3"
      ]
     },
     "execution_count": 3,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "c=3\\n",
    "c"
   ]
  }
 ],
 "metadata": {
  "file_extension": ".py",
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.7.4"
  },
  "mimetype": "text/x-python",
  "name": "python",
  "npconvert_exporter": "python",
  "pygments_lexer": "ipython3",
  "version": 3
 },
 "nbformat": 4,
 "nbformat_minor": 2
}`;
    const addedJSON = JSON.parse(baseFile);
    addedJSON.cells.splice(3, 0, {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: ['a']
    });

    let notebookFile: {
        filePath: string;
        cleanupCallback: Function;
    };
    function initIoc() {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes(false);
        ioc.forceDataScienceSettingsChanged({ alwaysTrustNotebooks: false });
        ioc.setExperimentState(EnableTrustedNotebooks.experiment, true);
        return ioc.activate();
    }
    function simulateKeyPressOnCell(cellIndex: number, keyboardEvent: Partial<IKeyboardEvent> & { code: string }) {
        // Check to see if we have an active focused editor
        const editor = getNativeFocusedEditor(wrapper);

        // If we do have one, send the input there, otherwise send it to the outer cell
        if (editor) {
            simulateKeyPressOnEditor(editor, keyboardEvent);
        } else {
            simulateKeyPressOnCellInner(cellIndex, keyboardEvent);
        }
    }
    function simulateKeyPressOnEditor(
        editorControl: ReactWrapper<any, Readonly<{}>, React.Component> | undefined,
        keyboardEvent: Partial<IKeyboardEvent> & { code: string }
    ) {
        enterEditorKey(editorControl, keyboardEvent);
    }

    function simulateKeyPressOnCellInner(cellIndex: number, keyboardEvent: Partial<IKeyboardEvent> & { code: string }) {
        wrapper.update();
        let nativeCell = wrapper.find(NativeCell).at(cellIndex);
        if (nativeCell.exists()) {
            nativeCell.simulate('keydown', {
                key: keyboardEvent.code,
                shiftKey: keyboardEvent.shiftKey,
                ctrlKey: keyboardEvent.ctrlKey,
                altKey: keyboardEvent.altKey,
                metaKey: keyboardEvent.metaKey
            });
        }
        wrapper.update();
        // Requery for our cell as something like a 'dd' keydown command can delete it before the press and up
        nativeCell = wrapper.find(NativeCell).at(cellIndex);
        if (nativeCell.exists()) {
            nativeCell.simulate('keypress', {
                key: keyboardEvent.code,
                shiftKey: keyboardEvent.shiftKey,
                ctrlKey: keyboardEvent.ctrlKey,
                altKey: keyboardEvent.altKey,
                metaKey: keyboardEvent.metaKey
            });
        }
        nativeCell = wrapper.find(NativeCell).at(cellIndex);
        wrapper.update();
        if (nativeCell.exists()) {
            nativeCell.simulate('keyup', {
                key: keyboardEvent.code,
                shiftKey: keyboardEvent.shiftKey,
                ctrlKey: keyboardEvent.ctrlKey,
                altKey: keyboardEvent.altKey,
                metaKey: keyboardEvent.metaKey
            });
        }
        wrapper.update();
    }

    async function setupFunction(this: Mocha.Context, fileContents?: any) {
        addMockData(ioc, 'b=2\nb', 2);
        addMockData(ioc, 'c=3\nc', 3);
        // Use a real file so we can save notebook to a file.
        // This is used in some tests (saving).
        notebookFile = await createTemporaryFile('.ipynb');
        await fs.writeFile(notebookFile.filePath, fileContents ? fileContents : baseFile);
        const ne = await openEditor(ioc, fileContents ? fileContents : baseFile, notebookFile.filePath);
        wrapper = ne.mount.wrapper;
    }
    function clickCell(cellIndex: number) {
        wrapper.update();
        wrapper.find(NativeCell).at(cellIndex).simulate('click');
        wrapper.update();
    }

    teardown(async () => {
        for (const disposable of disposables) {
            if (!disposable) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const promise = disposable.dispose() as Promise<any>;
            if (promise) {
                await promise;
            }
        }
        await ioc.dispose();
        try {
            notebookFile.cleanupCallback();
        } catch {
            noop();
        }
    });

    setup(async function () {
        await initIoc();
        // tslint:disable-next-line: no-invalid-this
        await setupFunction.call(this);
    });

    test('Outputs are not rendered', () => {
        // No outputs should have rendered
        assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>1</span>', 0));
        assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>2</span>', 1));
        assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>3</span>', 2));
    });
    test('Cannot insert cell into notebook', async () => {
        // Click insert cell button
        const insertCellButton = findButton(wrapper, NativeEditor, 5);
        insertCellButton?.simulate('click');

        // No cell should have been added
        assert.equal(wrapper.find('NativeCell').length, 3, 'Cell added');
    });
    test('Cannot edit cell contents', async () => {
        // Set focus to a cell
        let update = waitForMessage(ioc, InteractiveWindowMessages.SelectedCell);
        clickCell(0);
        await update;
        update = waitForMessage(ioc, InteractiveWindowMessages.FocusedCellEditor);
        simulateKeyPressOnCell(0, { code: 'Enter' });
        await update;
        assert.ok(isCellFocused(wrapper, 'NativeCell', 0));

        // Then try to type code
        const editorEnzyme = getNativeFocusedEditor(wrapper);
        typeCode(editorEnzyme, 'foo');
        const reactEditor = editorEnzyme!.instance() as MonacoEditor;
        const editor = reactEditor.state.editor;
        if (editor) {
            assert.notInclude(editor.getModel()!.getValue(), 'foo', 'Was able to edit cell in untrusted notebook');
        }
    });
    test('Cannot run cell', async () => {
        // Click run cell button
        const cell = getOutputCell(wrapper, 'NativeCell', 1);
        const imageButtons = cell!.find(ImageButton);
        const runButton = imageButtons.findWhere((w) => w.props().tooltip === 'Run cell');
        runButton.simulate('click');

        // Ensure cell was not executed
        assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', `2`, 1));
    });
});
