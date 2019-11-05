// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as Redux from 'redux';

import { Identifiers } from '../../../client/datascience/constants';
import { IInteractiveWindowMapping } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../interactive-common/mainState';
import { PostOffice } from '../../react-common/postOffice';
import { generateMonacoReducer, IMonacoState } from '../../react-common/redux/reducers/monaco';
import { combineReducers, createAsyncStore, PostMessageFunc, QueuableAction } from '../../react-common/reduxUtils';
import { computeEditorOptions, loadDefaultSettings } from '../../react-common/settingsReactSide';

function generateDefaultState(skipDefault: boolean, baseTheme: string): IMainState {
    const defaultSettings = loadDefaultSettings();
    return {
        // tslint:disable-next-line: no-typeof-undefined
        skipDefault,
        testMode: false,
        baseTheme: defaultSettings.ignoreVscodeTheme ? 'vscode-light' : baseTheme,
        editorOptions: computeEditorOptions(defaultSettings),
        cellVMs: [],
        busy: true,
        undoStack: [],
        redoStack: [],
        submittedText: false,
        currentExecutionCount: 0,
        variables: [],
        pendingVariableCount: 0,
        debugging: false,
        knownDark: false,
        variablesVisible: false,
        editCellVM: undefined,
        enableGather: false,
        isAtBottom: true,
        font: {
            size: 14,
            family: 'Consolas, \'Courier New\', monospace'
        },
        codeTheme: Identifiers.GeneratedThemeName,
        settings: defaultSettings,
        activateCount: 0,
        monacoReady: false
    };
}

function generateReactReducer<M>(skipDefault: boolean, baseTheme: string, postOffice: PostOffice, reducerMap: M): Redux.Reducer<IMainState, QueuableAction<M>> {
    // First create our default state.
    const defaultState = generateDefaultState(skipDefault, baseTheme);

    // Extract out a post message function
    const postMessage: PostMessageFunc<IInteractiveWindowMapping> = (type, payload) => {
        setTimeout(() => postOffice.sendMessage<IInteractiveWindowMapping>(type, payload));
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMainState, M>(
        defaultState,
        postMessage,
        reducerMap);
}

export function createStore<M>(skipDefault: boolean, baseTheme: string, testMode: boolean, reducerMap: M) {
    // Create a post office to listen to store dispatches and allow reducers to
    // send messages
    const postOffice = new PostOffice();

    // Create reducer for the main react UI
    const reactReducer = generateReactReducer(skipDefault, baseTheme, postOffice, reducerMap);

    // Create another reducer for handling monaco state
    const monacoReducer = generateMonacoReducer(testMode, postOffice);

    // Combine these together
    const rootReducer = Redux.combineReducers({
        react: reactReducer,
        monaco: monacoReducer
    });

    // Send this into the root reducer
    const store = createAsyncStore<{ react: IMainState, monaco: IMonacoState }, Redux.AnyAction>(
        rootReducer);

    // Make all messages from the post office dispatch to the store.
    postOffice.addHandler({
        // tslint:disable-next-line: no-any
        handleMessage(message: string, payload: any): boolean {
            store.dispatch({ type: message, ...payload });
            return true;
        }
    });

    return store;
}
