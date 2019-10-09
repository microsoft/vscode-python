// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { mount, ReactWrapper } from 'enzyme';
import { min } from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { CancellationToken } from 'vscode';

import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { IDataScienceSettings } from '../../client/common/types';
import { createDeferred } from '../../client/common/utils/async';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterExecution } from '../../client/datascience/types';
import { InteractivePanel } from '../../datascience-ui/history-react/interactivePanel';
import { NativeEditor } from '../../datascience-ui/native-editor/nativeEditor';
import { IKeyboardEvent } from '../../datascience-ui/react-common/event';
import { ImageButton } from '../../datascience-ui/react-common/imageButton';
import { updateSettings } from '../../datascience-ui/react-common/settingsReactSide';
import { noop } from '../core';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { createInputEvent, createKeyboardEvent, waitForUpdate } from './reactHelpers';

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

export function waitForMessage(ioc: DataScienceIocContainer, message: string): Promise<void> {
    // Wait for the mounted web panel to send a message back to the data explorer
    const promise = createDeferred<void>();
    let handler: (m: string, p: any) => void;
    handler = (m: string, _p: any) => {
        if (m === message) {
            ioc.removeMessageListener(handler);
            promise.resolve();
        }
    };
    ioc.addMessageListener(handler);
    return promise.promise;
}

export async function waitForMessageResponse(ioc: DataScienceIocContainer, action: () => void): Promise<void> {
    ioc.wrapperCreatedPromise = createDeferred<boolean>();
    action();
    await ioc.wrapperCreatedPromise.promise;
    ioc.wrapperCreatedPromise = undefined;
}

async function testInnerLoop(
    name: string,
    mountFunc: (ioc: DataScienceIocContainer) => ReactWrapper<any, Readonly<{}>, React.Component>,
    testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>,
    getIOC: () => DataScienceIocContainer
) {
    const ioc = getIOC();
    const jupyterExecution = ioc.get<IJupyterExecution>(IJupyterExecution);
    if (await jupyterExecution.isNotebookSupported()) {
        addMockData(ioc, 'a=1\na', 1);
        const wrapper = mountFunc(ioc);
        await testFunc(wrapper);
    } else {
        // tslint:disable-next-line:no-console
        console.log(`${name} skipped, no Jupyter installed.`);
    }
}

export function runDoubleTest(name: string, testFunc: (wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) => Promise<void>, getIOC: () => DataScienceIocContainer) {
    // Just run the test twice. Originally mounted twice, but too hard trying to figure out disposing.
    test(`${name} (interactive)`, async () =>
        testInnerLoop(name, ioc => mountWebView(ioc, <InteractivePanel baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />), testFunc, getIOC));
    test(`${name} (native)`, async () =>
        testInnerLoop(name, ioc => mountWebView(ioc, <NativeEditor baseTheme='vscode-light' codeTheme='light_vs' testMode={true} skipDefault={true} />), testFunc, getIOC));
}

export function mountWebView(ioc: DataScienceIocContainer, node: React.ReactElement): ReactWrapper<any, Readonly<{}>, React.Component> {
    // Setup our webview panel
    ioc.createWebView(() => mount(node));
    return ioc.wrapper!;
}

export function addMockData(ioc: DataScienceIocContainer, code: string, result: string | number | undefined, mimeType?: string, cellType?: string) {
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

export function addContinuousMockData(ioc: DataScienceIocContainer, code: string, resultGenerator: (c: CancellationToken) => Promise<{ result: string; haveMore: boolean }>) {
    if (ioc.mockJupyter) {
        ioc.mockJupyter.addContinuousOutputCell(code, resultGenerator);
    }
}
export function getLastOutputCell(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellType: string): ReactWrapper<any, Readonly<{}>, React.Component> {
    // Skip the edit cell if in the interactive window
    const count = cellType === 'InteractiveCell' ? 2 : 1;
    const foundResult = wrapper.find(cellType);
    assert.ok(foundResult.length >= count, 'Didn\'t find any cells being rendered');
    return foundResult.at(foundResult.length - count);
}

export function verifyHtmlOnCell(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellType: string, html: string | undefined, cellIndex: number | CellPosition) {
    wrapper.update();

    const foundResult = wrapper.find(cellType);
    assert.ok(foundResult.length >= 1, 'Didn\'t find any cells being rendered');

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
    assert.ok(targetCell!, 'Target cell doesn\'t exist');

    // If html is specified, check it
    if (html) {
        // Extract only the first 100 chars from the input string
        const sliced = html.substr(0, min([html.length, 100]));
        const output = targetCell!.find('div.cell-output');
        assert.ok(output.length > 0, 'No output cell found');
        const outHtml = output.html();
        assert.ok(outHtml.includes(sliced), `${outHtml} does not contain ${sliced}`);
    } else {
        const output = targetCell!.find('div.cell-output');
        const outputHtml = output.length > 0 ? output.html() : undefined;
        // html not specified, look for an empty render
        assert.ok(targetCell!.isEmptyRender() || outputHtml === undefined, `Target cell is not empty render, got this instead: ${outputHtml}`);
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
            isSuggesting: false
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

export function isCellSelected(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellType: string, cellIndex: number | CellPosition): boolean {
    try {
        verifyCell(wrapper, cellType, { selector: '.cell-wrapper-selected' }, cellIndex);
        return true;
    } catch {
        return false;
    }
}

export function isCellFocused(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellType: string, cellIndex: number | CellPosition): boolean {
    try {
        verifyCell(wrapper, cellType, { selector: '.cell-wrapper-focused' }, cellIndex);
        return true;
    } catch {
        return false;
    }
}

export function verifyCellIndex(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellId: string, expectedCellIndex: number) {
    const nativeCell = wrapper
        .find(cellId)
        .first()
        .find('NativeCell');
    const secondCell = wrapper.find('NativeCell').at(expectedCellIndex);
    assert.equal(nativeCell.html(), secondCell.html());
}

function verifyCell(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    cellType: string,
    options: { selector: string; shouldNotExist?: boolean },
    cellIndex: number | CellPosition
) {
    const foundResult = wrapper.find(cellType);
    assert.ok(foundResult.length >= 1, 'Didn\'t find any cells being rendered');

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
    assert.ok(targetCell!, 'Target cell doesn\'t exist');

    if (options.shouldNotExist) {
        assert.ok(targetCell!.find(options.selector).length === 0, `Found cells with the matching selector '${options.selector}'`);
    } else {
        assert.ok(targetCell!.find(options.selector).length >= 1, `Didn't find any cells with the matching selector '${options.selector}'`);
    }
}

export function verifyLastCellInputState(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellType: string, state: CellInputState) {
    const lastCell = getLastOutputCell(wrapper, cellType);
    assert.ok(lastCell, 'Last call doesn\'t exist');

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
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    mainClass: React.ComponentClass<any>,
    cellType: string,
    expectedRenders: number,
    updater: () => Promise<void>
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    // Get a render promise with the expected number of renders
    const renderPromise = waitForUpdate(wrapper, mainClass, expectedRenders);

    // Call our function to update the react control
    await updater();

    // Wait for all of the renders to go through
    await renderPromise;

    // Return the result
    return wrapper.find(cellType);
}

function simulateKey(domNode: HTMLTextAreaElement, key: string, shiftDown?: boolean) {
    // Submit a keypress into the textarea. Simulate doesn't work here because the keydown
    // handler is not registered in any react code. It's being handled with DOM events

    // According to this:
    // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Usage_notes
    // The normal events are
    // 1) keydown
    // 2) keypress
    // 3) keyup
    let event = createKeyboardEvent('keydown', { key, code: key, shiftKey: shiftDown });

    // Dispatch. Result can be swallowed. If so skip the next event.
    let result = domNode.dispatchEvent(event);
    if (result) {
        event = createKeyboardEvent('keypress', { key, code: key, shiftKey: shiftDown });
        result = domNode.dispatchEvent(event);
        if (result) {
            event = createKeyboardEvent('keyup', { key, code: key, shiftKey: shiftDown });
            domNode.dispatchEvent(event);

            // Update our value. This will reset selection to zero.
            domNode.value = domNode.value + key;

            // Tell the dom node its selection start has changed. Monaco
            // reads this to determine where the character went.
            domNode.selectionEnd = domNode.value.length;
            domNode.selectionStart = domNode.value.length;

            // Dispatch an input event so we update the textarea
            domNode.dispatchEvent(createInputEvent());
        }
    }
}

async function submitInput(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, mainClass: React.ComponentClass<any>, textArea: HTMLTextAreaElement): Promise<void> {
    // Get a render promise with the expected number of renders (how many updates a the shift + enter will cause)
    // Should be 6 - 1 for the shift+enter and 5 for the new cell.
    const renderPromise = waitForUpdate(wrapper, mainClass, 6);

    // Submit a keypress into the textarea
    simulateKey(textArea, 'Enter', true);

    return renderPromise;
}

function enterKey(_wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, textArea: HTMLTextAreaElement, key: string) {
    // Simulate a key press
    simulateKey(textArea, key);
}

export function getEditor(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>): ReactWrapper<any, Readonly<{}>, React.Component> {
    // Find the last cell. It should have a monacoEditor object
    const cells = wrapper.find('InteractiveCell');
    const lastCell = cells.last();
    return lastCell.find('MonacoEditor');
}

export function typeCode(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, code: string): HTMLTextAreaElement | null {
    // Find the last cell. It should have a monacoEditor object. We need to search
    // through its DOM to find the actual textarea to send input to
    // (we can't actually find it with the enzyme wrappers because they only search
    //  React accessible nodes and the monaco html is not react)
    const editorControl = getEditor(wrapper);
    const ecDom = editorControl.getDOMNode();
    assert.ok(ecDom, 'ec DOM object not found');
    const textArea = ecDom!.querySelector('.overflow-guard')!.querySelector('textarea');
    assert.ok(textArea!, 'Cannot find the textarea inside the monaco editor');
    textArea!.focus();

    // Now simulate entering all of the keys
    for (let i = 0; i < code.length; i += 1) {
        enterKey(wrapper, textArea!, code.charAt(i));
    }

    return textArea;
}

export async function enterInput(
    wrapper: ReactWrapper<any, Readonly<{}>, React.Component>,
    mainClass: React.ComponentClass<any>,
    code: string,
    resultClass: string
): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    // First we have to type the code into the input box
    const textArea = typeCode(wrapper, code);

    // Now simulate a shift enter. This should cause a new cell to be added
    await submitInput(wrapper, mainClass, textArea!);

    // Return the result
    return wrapper.find(resultClass);
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

// The default base set of data science settings to use
export function defaultDataScienceSettings(): IDataScienceSettings {
    return {
        allowImportFromNotebook: true,
        jupyterLaunchTimeout: 10,
        jupyterLaunchRetries: 3,
        enabled: true,
        jupyterServerURI: 'local',
        notebookFileRoot: 'WORKSPACE',
        changeDirOnImportExport: true,
        useDefaultConfigForJupyter: true,
        jupyterInterruptTimeout: 10000,
        searchForJupyter: true,
        showCellInputCode: true,
        collapseCellInputCodeByDefault: true,
        allowInput: true,
        maxOutputSize: 400,
        errorBackgroundColor: '#FFFFFF',
        sendSelectionToInteractiveWindow: false,
        showJupyterVariableExplorer: true,
        variableExplorerExclude: 'module;function;builtin_function_or_method',
        codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
        markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
        enablePlotViewer: true,
        runStartupCommands: '',
        debugJustMyCode: true
    };
}

// Set initial data science settings to use for a test (initially loaded via settingsReactSide.ts)
export function initialDataScienceSettings(newSettings: IDataScienceSettings) {
    const settingsString = JSON.stringify(newSettings);
    updateSettings(settingsString);
}

export function getMainPanel<P>(wrapper: ReactWrapper<any, Readonly<{}>>, mainClass: React.ComponentClass<any>): P | undefined {
    const mainObj = wrapper.find(mainClass);
    if (mainObj) {
        return (mainObj.instance() as any) as P;
    }

    return undefined;
}

// Update data science settings while running (goes through the UpdateSettings channel)
export function updateDataScienceSettings(wrapper: ReactWrapper<any, Readonly<{}>>, mainClass: React.ComponentClass<any>, newSettings: IDataScienceSettings) {
    const settingsString = JSON.stringify(newSettings);
    const mainPanel = getMainPanel(wrapper, mainClass) as any;
    if (mainPanel) {
        mainPanel.stateController.handleMessage(InteractiveWindowMessages.UpdateSettings, settingsString);
    }
    wrapper.update();
}

export function toggleCellExpansion(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, cellType: string) {
    // Find the last cell added
    const lastCell = getLastOutputCell(wrapper, cellType);
    assert.ok(lastCell, 'Last call doesn\'t exist');

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
