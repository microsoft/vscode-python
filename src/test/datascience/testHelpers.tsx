// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import { min } from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Provider } from 'react-redux';
import { isString } from 'util';
import { CancellationToken } from 'vscode';

import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterExecution } from '../../client/datascience/types';
import { getConnectedInteractiveEditor } from '../../datascience-ui/history-react/interactivePanel';
import * as InteractiveStore from '../../datascience-ui/history-react/redux/store';
import { CommonActionType } from '../../datascience-ui/interactive-common/redux/reducers/types';
import { getConnectedNativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import * as NativeStore from '../../datascience-ui/native-editor/redux/store';
import { IKeyboardEvent } from '../../datascience-ui/react-common/event';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { MonacoEditor } from '../../datascience-ui/react-common/monacoEditor';
import { PostOffice } from '../../datascience-ui/react-common/postOffice';
import { noop } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView } from './mountedWebView';
import { createInputEvent, createKeyboardEvent } from './reactHelpers';
export * from './testHelpersCore';

//tslint:disable:trailing-comma no-any no-multiline-string
export enum CellInputState {
    Hidden,
    Visible,
    Collapsed,
    Expanded
}

export enum CellPosition {
    First = 'first',
    Last = 'last'
}

async function testInnerLoop(
    name: string,
    type: 'native' | 'interactive',
    testFunc: (type: 'native' | 'interactive') => Promise<void>,
    getIOC: () => Promise<DataScienceIocContainer>
) {
    const ioc = await getIOC();
    const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
    if (await jupyterExecution.isNotebookSupported()) {
        addMockData(ioc, 'a=1\na', 1);
        await testFunc(type);
    } else {
        // tslint:disable-next-line:no-console
        console.log(`${name} skipped, no Jupyter installed.`);
    }
}

export function runDoubleTest(
    name: string,
    testFunc: (type: 'native' | 'interactive') => Promise<void>,
    getIOC: () => Promise<DataScienceIocContainer>
) {
    // Just run the test twice. Originally mounted twice, but too hard trying to figure out disposing.
    test(`${name} (interactive)`, async () => testInnerLoop(name, 'interactive', testFunc, getIOC));
    test(`${name} (native)`, async () => testInnerLoop(name, 'native', testFunc, getIOC));
}

export function runInteractiveTest(
    name: string,
    testFunc: () => Promise<void>,
    getIOC: () => Promise<DataScienceIocContainer>
) {
    // Run the test with just the interactive window
    test(`${name} (interactive)`, async () => testInnerLoop(name, 'interactive', (_t) => testFunc(), getIOC));
}
export function runNativeTest(
    name: string,
    testFunc: () => Promise<void>,
    getIOC: () => Promise<DataScienceIocContainer>
) {
    // Run the test with just the native window
    test(`${name} (native)`, async () => testInnerLoop(name, 'native', (_t) => testFunc(), getIOC));
}

export function addMockData(
    ioc: DataScienceIocContainer,
    code: string,
    result: string | number | undefined | string[],
    mimeType?: string | string[],
    cellType?: string
) {
    if (ioc.mockJupyter) {
        if (cellType && cellType === 'error') {
            ioc.mockJupyter.addError(code, result ? result.toString() : '');
        } else {
            if (result) {
                ioc.mockJupyter.addCell(code, result, mimeType);
            } else {
                ioc.mockJupyter.addCell(code);
            }
        }
    }
}

export function addInputMockData(
    ioc: DataScienceIocContainer,
    code: string,
    result: string | number | undefined,
    mimeType?: string,
    cellType?: string
) {
    if (ioc.mockJupyter) {
        if (cellType && cellType === 'error') {
            ioc.mockJupyter.addError(code, result ? result.toString() : '');
        } else {
            if (result) {
                ioc.mockJupyter.addInputCell(code, result, mimeType);
            } else {
                ioc.mockJupyter.addInputCell(code);
            }
        }
    }
}

export function addContinuousMockData(
    ioc: DataScienceIocContainer,
    code: string,
    resultGenerator: (c: CancellationToken) => Promise<{ result: string; haveMore: boolean }>
) {
    if (ioc.mockJupyter) {
        ioc.mockJupyter.addContinuousOutputCell(code, resultGenerator);
    }
}

export function getOutputCell(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string,
    cellIndex: number | CellPosition
): ReactWrapper<any, Readonly<{}>, React.Component> | undefined {
    const foundResult = wrapper.find(cellType);
    let targetCell: ReactWrapper | undefined;
    // Get the correct result that we are dealing with
    if (typeof cellIndex === 'number') {
        if (cellIndex >= 0 && cellIndex <= foundResult.length - 1) {
            targetCell = foundResult.at(cellIndex);
        }
    } else if (typeof cellIndex === 'string') {
        switch (cellIndex) {
            case CellPosition.First:
                targetCell = foundResult.first();
                break;

            case CellPosition.Last:
                // Skip the input cell on these checks.
                targetCell = getLastOutputCell(wrapper, cellType);
                break;

            default:
                // Fall through, targetCell check will fail out
                break;
        }
    }

    return targetCell;
}

export function getLastOutputCell(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string
): ReactWrapper<any, Readonly<{}>, React.Component> {
    // Skip the edit cell if in the interactive window
    const count = cellType === 'InteractiveCell' ? 2 : 1;
    wrapper.update();
    const foundResult = wrapper.find(cellType);
    return getOutputCell(wrapper, cellType, foundResult.length - count)!;
}

export function verifyCellSource(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: 'NativeCell' | 'InteractiveCell',
    source: string,
    cellIndex: number | CellPosition
) {
    wrapper.update();

    const foundResult = wrapper.find(cellType);
    assert.ok(foundResult.length >= 1, "Didn't find any cells being rendered");
    let targetCell: ReactWrapper;
    let index = 0;
    // Get the correct result that we are dealing with
    if (typeof cellIndex === 'number') {
        if (cellIndex >= 0 && cellIndex <= foundResult.length - 1) {
            targetCell = foundResult.at(cellIndex);
        }
    } else if (typeof cellIndex === 'string') {
        switch (cellIndex) {
            case CellPosition.First:
                targetCell = foundResult.first();
                break;

            case CellPosition.Last:
                // Skip the input cell on these checks.
                targetCell = getLastOutputCell(wrapper, cellType);
                index = foundResult.length - 1;
                break;

            default:
                // Fall through, targetCell check will fail out
                break;
        }
    }

    // ! is ok here to get rid of undefined type check as we want a fail here if we have not initialized targetCell
    assert.ok(targetCell!, "Target cell doesn't exist");

    const editor = cellType === 'InteractiveCell' ? getInteractiveEditor(wrapper) : getNativeEditor(wrapper, index);
    const inst = editor!.instance() as MonacoEditor;
    assert.deepStrictEqual(inst.state.model?.getValue(), source, 'Source does not match on cell');
}

export function verifyServerStatus(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, statusText: string) {
    wrapper.update();

    const foundResult = wrapper.find('div.kernel-status-server');
    assert.ok(foundResult.length >= 1, "Didn't find server status");
    const html = foundResult.html();
    assert.ok(html.includes(statusText), `${statusText} not found in server status`);
}

export function verifyHtmlOnCell(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: 'NativeCell' | 'InteractiveCell',
    html: string | undefined | RegExp,
    cellIndex: number | CellPosition
) {
    wrapper.update();

    const foundResult = wrapper.find(cellType);
    assert.ok(foundResult.length >= 1, "Didn't find any cells being rendered");

    let targetCell: ReactWrapper;
    // Get the correct result that we are dealing with
    if (typeof cellIndex === 'number') {
        if (cellIndex >= 0 && cellIndex <= foundResult.length - 1) {
            targetCell = foundResult.at(cellIndex);
        }
    } else if (typeof cellIndex === 'string') {
        switch (cellIndex) {
            case CellPosition.First:
                targetCell = foundResult.first();
                break;

            case CellPosition.Last:
                // Skip the input cell on these checks.
                targetCell = getLastOutputCell(wrapper, cellType);
                break;

            default:
                // Fall through, targetCell check will fail out
                break;
        }
    }

    // ! is ok here to get rid of undefined type check as we want a fail here if we have not initialized targetCell
    assert.ok(targetCell!, "Target cell doesn't exist");

    // If html is specified, check it
    let output = targetCell!.find('div.cell-output');
    if (output.length <= 0) {
        output = targetCell!.find('div.markdown-cell-output');
    }
    const outputHtml = output.length > 0 ? output.html() : undefined;
    if (html && isString(html)) {
        // Extract only the first 100 chars from the input string
        const sliced = html.substr(0, min([html.length, 100]));
        assert.ok(output.length > 0, 'No output cell found');
        assert.ok(outputHtml?.includes(sliced), `${outputHtml} does not contain ${sliced}`);
    } else if (html && outputHtml) {
        const regex = html as RegExp;
        assert.ok(regex.test(outputHtml), `${outputHtml} does not match ${html}`);
    } else {
        // html not specified, look for an empty render
        assert.ok(
            targetCell!.isEmptyRender() || outputHtml === undefined,
            `Target cell is not empty render, got this instead: ${outputHtml}`
        );
    }
}

/**
 * Creates a keyboard event for a cells.
 *
 * @export
 * @param {(Partial<IKeyboardEvent> & { code: string })} event
 * @returns
 */
export function createKeyboardEventForCell(event: Partial<IKeyboardEvent> & { code: string }) {
    const defaultKeyboardEvent: IKeyboardEvent = {
        altKey: false,
        code: '',
        ctrlKey: false,
        editorInfo: {
            contents: '',
            isDirty: false,
            isFirstLine: false,
            isLastLine: false,
            isSuggesting: false,
            clear: noop
        },
        metaKey: false,
        preventDefault: noop,
        shiftKey: false,
        stopPropagation: noop,
        target: {} as any
    };

    const defaultEditorInfo = defaultKeyboardEvent.editorInfo!;
    const providedEditorInfo = event.editorInfo || {};
    return {
        ...defaultKeyboardEvent,
        ...event,
        editorInfo: {
            ...defaultEditorInfo,
            ...providedEditorInfo
        }
    };
}

export function isCellSelected(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string,
    cellIndex: number | CellPosition
): boolean {
    try {
        verifyCell(wrapper, cellType, { selector: '.cell-wrapper-selected' }, cellIndex);
        return true;
    } catch {
        return false;
    }
}

export function isCellFocused(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string,
    cellIndex: number | CellPosition
): boolean {
    try {
        verifyCell(wrapper, cellType, { selector: '.cell-wrapper-focused' }, cellIndex);
        return true;
    } catch {
        return false;
    }
}

export function isCellMarkdown(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string,
    cellIndex: number | CellPosition
): boolean {
    const cell = getOutputCell(wrapper, cellType, cellIndex);
    assert.ok(cell, 'Could not find output cell');
    return cell!.props().cellVM.cell.data.cell_type === 'markdown';
}

export function verifyCellIndex(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellId: string,
    expectedCellIndex: number
) {
    const nativeCell = wrapper.find(cellId).first().find('NativeCell');
    const secondCell = wrapper.find('NativeCell').at(expectedCellIndex);
    assert.equal(nativeCell.html(), secondCell.html());
}

function verifyCell(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string,
    options: { selector: string; shouldNotExist?: boolean },
    cellIndex: number | CellPosition
) {
    wrapper.update();
    const foundResult = wrapper.find(cellType);
    assert.ok(foundResult.length >= 1, "Didn't find any cells being rendered");

    let targetCell: ReactWrapper;
    // Get the correct result that we are dealing with
    if (typeof cellIndex === 'number') {
        if (cellIndex >= 0 && cellIndex <= foundResult.length - 1) {
            targetCell = foundResult.at(cellIndex);
        }
    } else if (typeof cellIndex === 'string') {
        switch (cellIndex) {
            case CellPosition.First:
                targetCell = foundResult.first();
                break;

            case CellPosition.Last:
                // Skip the input cell on these checks.
                targetCell = getLastOutputCell(wrapper, cellType);
                break;

            default:
                // Fall through, targetCell check will fail out
                break;
        }
    }

    // ! is ok here to get rid of undefined type check as we want a fail here if we have not initialized targetCell
    assert.ok(targetCell!, "Target cell doesn't exist");

    if (options.shouldNotExist) {
        assert.ok(
            targetCell!.find(options.selector).length === 0,
            `Found cells with the matching selector '${options.selector}'`
        );
    } else {
        assert.ok(
            targetCell!.find(options.selector).length >= 1,
            `Didn't find any cells with the matching selector '${options.selector}'`
        );
    }
}

export function verifyLastCellInputState(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string,
    state: CellInputState
) {
    const lastCell = getLastOutputCell(wrapper, cellType);
    assert.ok(lastCell, "Last cell doesn't exist");

    const inputBlock = lastCell.find('div.cell-input');
    const toggleButton = lastCell.find('polygon.collapse-input-svg');

    switch (state) {
        case CellInputState.Hidden:
            assert.ok(inputBlock.length === 0, 'Cell input not hidden');
            break;

        case CellInputState.Visible:
            assert.ok(inputBlock.length === 1, 'Cell input not visible');
            break;

        case CellInputState.Expanded:
            assert.ok(toggleButton.html().includes('collapse-input-svg-rotate'), 'Cell input toggle not expanded');
            break;

        case CellInputState.Collapsed:
            assert.ok(!toggleButton.html().includes('collapse-input-svg-rotate'), 'Cell input toggle not collapsed');
            break;

        default:
            assert.fail('Unknown cellInputStat');
            break;
    }
}

export async function getCellResults(
    mountedWebView: IMountedWebView,
    cellType: string,
    updater: () => Promise<void>,
    renderPromiseGenerator?: () => Promise<void>
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    // Get a render promise with the expected number of renders
    const renderPromise = renderPromiseGenerator
        ? renderPromiseGenerator()
        : mountedWebView.waitForMessage(InteractiveWindowMessages.ExecutionRendered);

    // Call our function to update the react control
    await updater();

    // Wait for all of the renders to go through
    await renderPromise;

    // Update wrapper so that it gets the latest values.
    mountedWebView.wrapper.update();

    // Return the result
    return mountedWebView.wrapper.find(cellType);
}

export function simulateKey(
    domNode: HTMLTextAreaElement,
    key: string,
    shiftDown?: boolean,
    ctrlKey?: boolean,
    altKey?: boolean,
    metaKey?: boolean
) {
    // Submit a keypress into the textarea. Simulate doesn't work here because the keydown
    // handler is not registered in any react code. It's being handled with DOM events

    // Save current selection start so we move appropriately after the event
    const selectionStart = domNode.selectionStart;

    // According to this:
    // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Usage_notes
    // The normal events are
    // 1) keydown
    // 2) keypress
    // 3) keyup
    let event = createKeyboardEvent('keydown', { key, code: key, shiftKey: shiftDown, ctrlKey, altKey, metaKey });

    // Dispatch. Result can be swallowed. If so skip the next event.
    let result = domNode.dispatchEvent(event);
    if (result) {
        event = createKeyboardEvent('keypress', { key, code: key, shiftKey: shiftDown, ctrlKey, altKey, metaKey });
        result = domNode.dispatchEvent(event);
        if (result) {
            event = createKeyboardEvent('keyup', { key, code: key, shiftKey: shiftDown, ctrlKey, altKey, metaKey });
            domNode.dispatchEvent(event);

            // Update our value. This will reset selection to zero.
            const before = domNode.value.slice(0, selectionStart);
            const after = domNode.value.slice(selectionStart);
            const keyText = key === 'Enter' ? '\n' : key;

            domNode.value = `${before}${keyText}${after}`;

            // Tell the dom node its selection start has changed. Monaco
            // reads this to determine where the character went.
            domNode.selectionEnd = selectionStart + 1;
            domNode.selectionStart = selectionStart + 1;

            // Dispatch an input event so we update the textarea
            domNode.dispatchEvent(createInputEvent());
        }
    }
}

export async function submitInput(mountedWebView: IMountedWebView, textArea: HTMLTextAreaElement): Promise<void> {
    // Get a render promise with the expected number of renders (how many updates a the shift + enter will cause)
    // Should be 6 - 1 for the shift+enter and 5 for the new cell.
    const renderPromise = mountedWebView.waitForMessage(InteractiveWindowMessages.ExecutionRendered);

    // Submit a keypress into the textarea
    simulateKey(textArea, 'Enter', true);

    return renderPromise;
}

function enterKey(
    textArea: HTMLTextAreaElement,
    key: string,
    shiftDown?: boolean,
    ctrlKey?: boolean,
    altKey?: boolean,
    metaKey?: boolean
) {
    // Simulate a key press
    simulateKey(textArea, key, shiftDown, ctrlKey, altKey, metaKey);
}

export function getInteractiveEditor(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>
): ReactWrapper<any, Readonly<{}>, React.Component> {
    wrapper.update();
    // Find the last cell. It should have a monacoEditor object
    const cells = wrapper.find('InteractiveCell');
    const lastCell = cells.last();
    return lastCell.find('MonacoEditor');
}

export function getNativeEditor(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    index: number
): ReactWrapper<any, Readonly<{}>, React.Component> | undefined {
    // Find the last cell. It should have a monacoEditor object
    const cells = wrapper.find('NativeCell');
    const lastCell = index < cells.length ? cells.at(index) : undefined;
    return lastCell ? lastCell.find('MonacoEditor') : undefined;
}

export function getNativeFocusedEditor(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>
): ReactWrapper<any, Readonly<{}>, React.Component> | undefined {
    // Find the last cell. It should have a monacoEditor object
    wrapper.update();
    const cells = wrapper.find('NativeCell');
    const focusedCell = cells.find('.cell-wrapper-focused');
    return focusedCell.length > 0 ? focusedCell.find('MonacoEditor') : undefined;
}

export function injectCode(
    editorControl: ReactWrapper<any, Readonly<{}>, React.Component> | undefined,
    code: string
): HTMLTextAreaElement | null {
    assert.ok(editorControl, 'Editor undefined for injecting code');
    const ecDom = editorControl!.getDOMNode();
    assert.ok(ecDom, 'ec DOM object not found');
    const textArea = ecDom!.querySelector('.overflow-guard')!.querySelector('textarea');
    assert.ok(textArea!, 'Cannot find the textarea inside the monaco editor');
    textArea!.focus();

    // Just stick directly into the model.
    const editor = editorControl!.instance() as MonacoEditor;
    assert.ok(editor, 'MonacoEditor not found');
    const monaco = editor.state.editor;
    assert.ok(monaco, 'Monaco control not found');
    const model = monaco!.getModel();
    assert.ok(model, 'Monaco model not found');
    model!.setValue(code);

    return textArea;
}

export function enterEditorKey(
    editorControl: ReactWrapper<any, Readonly<{}>, React.Component> | undefined,
    keyboardEvent: Partial<IKeyboardEvent> & { code: string }
): HTMLTextAreaElement | null {
    const textArea = getTextArea(editorControl);
    assert.ok(textArea!, 'Cannot find the textarea inside the monaco editor');
    textArea!.focus();

    enterKey(
        textArea!,
        keyboardEvent.code,
        keyboardEvent.shiftKey,
        keyboardEvent.ctrlKey,
        keyboardEvent.altKey,
        keyboardEvent.metaKey
    );

    return textArea;
}

export function typeCode(
    editorControl: ReactWrapper<any, Readonly<{}>, React.Component> | undefined,
    code: string
): HTMLTextAreaElement | null {
    const textArea = getTextArea(editorControl);
    assert.ok(textArea!, 'Cannot find the textarea inside the monaco editor');
    textArea!.focus();

    // Now simulate entering all of the keys
    for (let i = 0; i < code.length; i += 1) {
        let keyCode = code.charAt(i);
        if (keyCode === '\n') {
            keyCode = 'Enter';
        }
        enterKey(textArea!, keyCode);
    }

    return textArea;
}

function getTextArea(
    editorControl: ReactWrapper<any, Readonly<{}>, React.Component> | undefined
): HTMLTextAreaElement | null {
    // Find the last cell. It should have a monacoEditor object. We need to search
    // through its DOM to find the actual textarea to send input to
    // (we can't actually find it with the enzyme wrappers because they only search
    //  React accessible nodes and the monaco html is not react)
    assert.ok(editorControl, 'Editor not defined in order to type code into');
    let ecDom = editorControl!.getDOMNode();
    if ((ecDom as any).length) {
        ecDom = (ecDom as any)[0];
    }
    assert.ok(ecDom, 'ec DOM object not found');
    return ecDom!.querySelector('.overflow-guard')!.querySelector('textarea');
}

export async function enterInput(
    mountedWebView: IMountedWebView,
    code: string,
    resultClass: string
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    const editor =
        resultClass === 'InteractiveCell'
            ? getInteractiveEditor(mountedWebView.wrapper)
            : getNativeFocusedEditor(mountedWebView.wrapper);

    // First we have to type the code into the input box
    const textArea = typeCode(editor, code);

    // Now simulate a shift enter. This should cause a new cell to be added
    await submitInput(mountedWebView, textArea!);

    // Return the result
    return mountedWebView.wrapper.find(resultClass);
}

export function findButton(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    mainClass: React.ComponentClass<any>,
    index: number
): ReactWrapper<any, Readonly<{}>, React.Component> | undefined {
    const mainObj = wrapper.find(mainClass);
    if (mainObj) {
        const buttons = mainObj.find(ImageButton);
        if (buttons) {
            return buttons.at(index);
        }
    }
}

export function getMainPanel<P>(
    wrapper: ReactWrapper<any, Readonly<{}>>,
    mainClass: React.ComponentClass<any>
): P | undefined {
    const mainObj = wrapper.find(mainClass);
    if (mainObj) {
        return (mainObj.instance() as any) as P;
    }

    return undefined;
}

export function toggleCellExpansion(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellType: string) {
    // Find the last cell added
    const lastCell = getLastOutputCell(wrapper, cellType);
    assert.ok(lastCell, "Last call doesn't exist");

    const toggleButton = lastCell.find('button.collapse-input');
    assert.ok(toggleButton);
    toggleButton.simulate('click');
}

export function escapePath(p: string) {
    return p.replace(/\\/g, '\\\\');
}

export function srcDirectory() {
    return path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
}

export function mountConnectedMainPanel(type: 'native' | 'interactive') {
    const ConnectedMainPanel = type === 'native' ? getConnectedNativeEditor() : getConnectedInteractiveEditor();

    // Create the redux store in test mode.
    const createStore = type === 'native' ? NativeStore.createStore : InteractiveStore.createStore;
    const store = createStore(true, 'vs-light', true, new PostOffice());

    // Mount this with a react redux provider
    return mount(
        <Provider store={store}>
            <ConnectedMainPanel />
        </Provider>
    );
}

export function mountComponent<P>(type: 'native' | 'interactive', Component: React.ReactElement<P>) {
    // Create the redux store in test mode.
    const createStore = type === 'native' ? NativeStore.createStore : InteractiveStore.createStore;
    const store = createStore(true, 'vs-light', true, new PostOffice());

    // Mount this with a react redux provider
    return mount(<Provider store={store}>{Component}</Provider>);
}

// Open up our variable explorer which also triggers a data fetch
export function openVariableExplorer(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
    const nodes = wrapper.find(Provider);
    if (nodes.length > 0) {
        const store = nodes.at(0).props().store;
        if (store) {
            store.dispatch({ type: CommonActionType.TOGGLE_VARIABLE_EXPLORER });
        }
    }
}

export async function waitForVariablesUpdated(mountedWebView: IMountedWebView, numberOfTimes?: number): Promise<void> {
    return mountedWebView.waitForMessage(InteractiveWindowMessages.VariablesComplete, { numberOfTimes });
}
