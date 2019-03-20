// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { ReactWrapper } from 'enzyme';
import { min } from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { CancellationToken } from 'vscode';

import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { IDataScienceSettings } from '../../client/common/types';
import { HistoryMessages } from '../../client/datascience/history/historyTypes';
import { IHistory } from '../../client/datascience/types';
import { CellButton } from '../../datascience-ui/history-react/cellButton';
import { MainPanel } from '../../datascience-ui/history-react/MainPanel';
import { updateSettings } from '../../datascience-ui/react-common/settingsReactSide';
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

export function getLastOutputCell(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>): ReactWrapper<any, Readonly<{}>, React.Component> {
    // Skip the edit cell
    const foundResult = wrapper.find('Cell');
    assert.ok(foundResult.length >= 2, 'Didn\'t find any cells being rendered');
    return foundResult.at(foundResult.length - 2);
}

export function verifyHtmlOnCell(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, html: string | undefined, cellIndex: number | CellPosition) {
    const foundResult = wrapper.find('Cell');
    assert.ok(foundResult.length >= 1, 'Didn\'t find any cells being rendered');

    let targetCell: ReactWrapper;
    // Get the correct result that we are dealing with
    if (typeof cellIndex === 'number') {
        if (cellIndex >= 0 && cellIndex <= (foundResult.length - 1)) {
            targetCell = foundResult.at(cellIndex);
        }
    } else if (typeof cellIndex === 'string') {
        switch (cellIndex) {
            case CellPosition.First:
                targetCell = foundResult.first();
                break;

            case CellPosition.Last:
                // Skip the input cell on these checks.
                targetCell = getLastOutputCell(wrapper);
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
        // html not specified, look for an empty render
        assert.ok(targetCell!.isEmptyRender(), 'Target cell is not empty render');
    }
}

export function verifyLastCellInputState(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, state: CellInputState) {

    const lastCell = getLastOutputCell(wrapper);
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

export async function getCellResults(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, expectedRenders: number, updater: () => Promise<void>): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {

    // Get a render promise with the expected number of renders
    const renderPromise = waitForUpdate(wrapper, MainPanel, expectedRenders);

    // Call our function to update the react control
    await updater();

    // Wait for all of the renders to go through
    await renderPromise;

    // Return the result
    return wrapper.find('Cell');
}

export async function addCode(historyProvider: () => Promise<IHistory>, wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, code: string, expectedRenderCount: number = 5): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {
    // Adding code should cause 5 renders to happen.
    // 1) Input
    // 2) Status ready
    // 3) Execute_Input message
    // 4) Output message (if there's only one)
    // 5) Status finished
    return getCellResults(wrapper, expectedRenderCount, async () => {
        const history = await historyProvider();
        await history.addCode(code, 'foo.py', 2);
    });
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

            // Dispatch an input event so we update the textarea
            domNode.value = domNode.value + key;
            domNode.dispatchEvent(createInputEvent());
        }
    }

}

async function submitInput(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, textArea: HTMLTextAreaElement): Promise<void> {
    // Get a render promise with the expected number of renders (how many updates a the shift + enter will cause)
    // Should be 6 - 1 for the shift+enter and 5 for the new cell.
    const renderPromise = waitForUpdate(wrapper, MainPanel, 6);

    // Submit a keypress into the textarea
    simulateKey(textArea, '\n', true);

    return renderPromise;
}

function enterKey(_wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, textArea: HTMLTextAreaElement, key: string) {
    // Simulate a key press
    simulateKey(textArea, key);
}

export async function enterInput(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, code: string): Promise<ReactWrapper<any, Readonly<{}>, React.Component>> {

    // First we have to type the code into the input box

    // Find the last cell. It should have a CodeMirror object. We need to search
    // through its DOM to find the actual codemirror textarea to send input to
    // (we can't actually find it with the enzyme wrappers because they only search
    //  React accessible nodes and the codemirror html is not react)
    const cells = wrapper.find('Cell');
    const lastCell = cells.last();
    const rcm = lastCell.find('div.ReactCodeMirror');
    const rcmDom = rcm.getDOMNode();
    assert.ok(rcmDom, 'rcm DOM object not found');
    const textArea = rcmDom!.querySelector('.CodeMirror')!.querySelector('textarea');
    assert.ok(textArea!, 'Cannot find the textarea inside the code mirror');
    textArea!.focus();

    // Now simulate entering all of the keys
    for (let i = 0; i < code.length; i += 1) {
        enterKey(wrapper, textArea!, code.charAt(i));
    }

    // Now simulate a shift enter. This should cause a new cell to be added
    await submitInput(wrapper, textArea!);

    // Return the result
    return wrapper.find('Cell');
}

export function findButton(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>, index: number): ReactWrapper<any, Readonly<{}>, React.Component> | undefined {
    const mainObj = wrapper.find(MainPanel);
    if (mainObj) {
        const buttons = mainObj.find(CellButton);
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
        codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
        markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)'
    };
}

// Set initial data science settings to use for a test (initially loaded via settingsReactSide.ts)
export function initialDataScienceSettings(newSettings: IDataScienceSettings) {
    const settingsString = JSON.stringify(newSettings);
    updateSettings(settingsString);
}

export function getMainPanel(wrapper: ReactWrapper<any, Readonly<{}>>): MainPanel | undefined {
    const mainObj = wrapper.find(MainPanel);
    if (mainObj) {
        return mainObj.instance() as MainPanel;
    }

    return undefined;
}

// Update data science settings while running (goes through the UpdateSettings channel)
export function updateDataScienceSettings(wrapper: ReactWrapper<any, Readonly<{}>>, newSettings: IDataScienceSettings) {
    const settingsString = JSON.stringify(newSettings);
    const mainPanel = getMainPanel(wrapper);
    if (mainPanel) {
        mainPanel.handleMessage(HistoryMessages.UpdateSettings, settingsString);
    }
    wrapper.update();
}

export function toggleCellExpansion(wrapper: ReactWrapper<any, Readonly<{}>, React.Component>) {
    // Find the last cell added
    const lastCell = getLastOutputCell(wrapper);
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
