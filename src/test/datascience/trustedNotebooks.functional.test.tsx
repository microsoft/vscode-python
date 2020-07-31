// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import { Disposable } from 'vscode';
import { EnableTrustedNotebooks } from '../../client/common/experiments/groups';
import { noop } from '../../client/common/utils/misc';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditor, INotebookEditorProvider, ITrustService } from '../../client/datascience/types';
import { CommonActionType } from '../../datascience-ui/interactive-common/redux/reducers/types';
import { TrustMessage } from '../../datascience-ui/interactive-common/trustMessage';
import { NativeCell } from '../../datascience-ui/native-editor/nativeCell';
import { NativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import { IKeyboardEvent } from '../../datascience-ui/react-common/event';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { createTemporaryFile } from '../utils/fs';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView, WaitForMessageOptions } from './mountedWebView';
import { closeNotebook, openEditor } from './nativeEditorTestHelpers';
import {
    addMockData,
    enterEditorKey,
    findButton,
    getNativeFocusedEditor,
    getOutputCell,
    isCellFocused,
    isCellMarkdown,
    isCellSelected,
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
suite('Notebook trust', () => {
    let wrapper: ReactWrapper<any, Readonly<{}>, React.Component>;
    let ne: { editor: INotebookEditor; mount: IMountedWebView };
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

    async function setupFunction(this: Mocha.Context) {
        addMockData(ioc, 'b=2\nb', 2);
        addMockData(ioc, 'c=3\nc', 3);
        // Use a real file so we can save notebook to a file.
        // This is used in some tests (saving).
        notebookFile = await createTemporaryFile('.ipynb');
        await fs.writeFile(notebookFile.filePath, baseFile);
        ne = await openEditor(ioc, baseFile, notebookFile.filePath);
        wrapper = ne.mount.wrapper;
    }

    function clickCell(cellIndex: number) {
        wrapper.update();
        wrapper.find(NativeCell).at(cellIndex).simulate('click');
        wrapper.update();
    }

    async function focusCell(targetCellIndex: number) {
        const update = waitForMessage(ioc, InteractiveWindowMessages.FocusedCellEditor);
        clickCell(targetCellIndex);
        simulateKeyPressOnCell(targetCellIndex, { code: 'Enter', editorInfo: undefined });
        await update;
        assert.ok(isCellFocused(wrapper, 'NativeCell', targetCellIndex));
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

    suite('Open an untrusted notebook', async () => {
        test('Outputs are not rendered', () => {
            // No outputs should have rendered
            assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>1</span>', 0));
            assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>2</span>', 1));
            assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>3</span>', 2));
        });
        test('Cannot edit cell contents', async () => {
            await focusCell(0);

            // Try to type code
            const editorEnzyme = getNativeFocusedEditor(wrapper);
            typeCode(editorEnzyme, 'foo');
            const reactEditor = editorEnzyme!.instance() as MonacoEditor;
            const editor = reactEditor.state.editor;
            if (editor) {
                assert.notInclude(editor.getModel()!.getValue(), 'foo', 'Was able to edit cell in untrusted notebook');
            }
        });

        suite('Buttons are disabled', async () => {
            test('Cannot run cell', async () => {
                // Click run cell button
                const cell = getOutputCell(wrapper, 'NativeCell', 1);
                const imageButtons = cell!.find(ImageButton);
                const runButton = imageButtons.findWhere((w) => w.props().tooltip === 'Run cell');
                runButton.simulate('click');

                // Ensure cell was not executed
                assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', `2`, 1));
            });
            test('Cannot switch to markdown', async () => {
                // Click switch to markdown button
                const cell = getOutputCell(wrapper, 'NativeCell', 1);
                const imageButtons = cell!.find(ImageButton);
                const changeToMarkdown = imageButtons.findWhere((w) => w.props().tooltip === 'Change to markdown');
                changeToMarkdown.simulate('click');

                // Ensure cell is still code cell
                assert.isFalse(isCellMarkdown(wrapper, 'NativeCell', 1));
            });
            test('Cannot insert cell into notebook', async () => {
                // Click insert cell button
                const insertCellButton = findButton(wrapper, NativeEditor, 5);
                insertCellButton?.simulate('click');

                // No cell should have been added
                assert.equal(wrapper.find('NativeCell').length, 3, 'Cell added');
            });
        });

        suite('Jupyter shortcuts for editing notebook are disabled', async () => {
            test('Ctrl+enter does not execute cell', async () => {
                const cellIndex = 1;
                await focusCell(cellIndex);

                const promise = waitForMessage(ioc, InteractiveWindowMessages.ExecutionRendered, { timeoutMs: 5_000 });
                simulateKeyPressOnCell(cellIndex, { code: 'Enter', ctrlKey: true, editorInfo: undefined });

                // Waiting for an execution rendered message should timeout
                await expect(promise).to.eventually.be.rejected;
                // No output should have been rendered
                assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>2</span>', cellIndex));
            });
            test('Shift+enter does not execute cell or advance to next cell', async () => {
                const cellIndex = 1;
                await focusCell(cellIndex);

                const promise = waitForMessage(ioc, InteractiveWindowMessages.ExecutionRendered, { timeoutMs: 5_000 });
                simulateKeyPressOnCell(cellIndex, { code: 'Enter', shiftKey: true, editorInfo: undefined });

                // Waiting for an execution rendered message should timeout
                await expect(promise).to.eventually.be.rejected;
                // No output should have been rendered
                assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>2</span>', cellIndex));
                // 3rd cell should be neither selected nor focused
                assert.isFalse(isCellSelected(wrapper, 'NativeCell', cellIndex + 1));
                assert.isFalse(isCellFocused(wrapper, 'NativeCell', cellIndex + 1));
            });
            test('Alt+enter does not execute cell or add a new cell below', async () => {
                assert.equal(wrapper.find('NativeCell').length, 3);
                const cellIndex = 1;
                await focusCell(cellIndex);

                const promise = waitForMessage(ioc, InteractiveWindowMessages.ExecutionRendered, { timeoutMs: 5_000 });
                simulateKeyPressOnCell(1, { code: 'Enter', altKey: true, editorInfo: undefined });

                // Waiting for an execution rendered message should timeout
                await expect(promise).to.eventually.be.rejected;
                // No output should have been rendered
                assert.throws(() => verifyHtmlOnCell(wrapper, 'NativeCell', '<span>2</span>', cellIndex));
                // No cell should have been added
                assert.equal(wrapper.find('NativeCell').length, 3, 'Cell added');
            });
            test('"a" does not add a cell', async () => {
                assert.equal(wrapper.find('NativeCell').length, 3);
                const cellIndex = 0;
                await focusCell(cellIndex);

                const addedCell = waitForMessage(ioc, CommonActionType.INSERT_ABOVE_AND_FOCUS_NEW_CELL, {
                    timeoutMs: 5_000
                });
                const update = waitForMessage(ioc, InteractiveWindowMessages.SelectedCell, { timeoutMs: 5_000 });
                simulateKeyPressOnCell(cellIndex, { code: 'a' });

                await expect(addedCell).to.eventually.be.rejected;
                await expect(update).to.eventually.be.rejected;
                // There should still be 3 cells.
                assert.equal(wrapper.find('NativeCell').length, 3);
            });
            test('"b" does not add a cell', async () => {
                assert.equal(wrapper.find('NativeCell').length, 3);
                const cellIndex = 0;
                await focusCell(cellIndex);

                const addedCell = waitForMessage(ioc, CommonActionType.INSERT_BELOW_AND_FOCUS_NEW_CELL, {
                    timeoutMs: 5_000
                });
                const update = waitForMessage(ioc, InteractiveWindowMessages.SelectedCell, { timeoutMs: 5_000 });
                simulateKeyPressOnCell(cellIndex, { code: 'b' });

                await expect(addedCell).to.eventually.be.rejected;
                await expect(update).to.eventually.be.rejected;
                // There should still be 3 cells.
                assert.equal(wrapper.find('NativeCell').length, 3);
            });
            test('"d" does not delete a cell', async () => {
                assert.equal(wrapper.find('NativeCell').length, 3);
                const cellIndex = 2;
                await focusCell(cellIndex);

                simulateKeyPressOnCell(cellIndex, { code: 'd' });
                simulateKeyPressOnCell(cellIndex, { code: 'd' });

                // There should still be 3 cells.
                assert.equal(wrapper.find('NativeCell').length, 3);
            });
            test('"m" does not change a code cell to markdown', async () => {
                const cellIndex = 2;
                await focusCell(cellIndex);

                const update = waitForMessage(ioc, CommonActionType.CHANGE_CELL_TYPE, {
                    timeoutMs: 5_000
                });
                simulateKeyPressOnCell(cellIndex, { code: 'm' });

                await expect(update).to.eventually.be.rejected;
                assert.isFalse(
                    isCellMarkdown(wrapper, 'NativeCell', cellIndex),
                    'Code cell in untrusted notebook was changed to markdown'
                );
            });
        });
    });

    suite('Trust an untrusted notebook', async () => {
        test('Trust persists when closed and reopened', async () => {
            const before = wrapper.find(TrustMessage);
            assert.equal(before.text(), 'Not Trusted');

            // Trust notebook
            const trustService = ioc.get<ITrustService>(ITrustService);
            await trustService.trustNotebook(ne.editor.model.file, ne.editor.model.getContent());

            // Close
            await closeNotebook(ioc, ne.editor);

            // Reopen
            const newNativeEditor = await openEditor(ioc, baseFile, notebookFile.filePath);
            const newWrapper = newNativeEditor.mount.wrapper;

            // Verify notebook is now trusted
            const after = newWrapper.find(TrustMessage);
            assert.equal(after.text(), 'Trusted');
        });
    });
});
