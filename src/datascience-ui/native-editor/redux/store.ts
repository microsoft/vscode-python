// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Reducer } from 'redux';

import { Identifiers } from '../../../client/datascience/constants';
import { IInteractiveWindowMapping } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../interactive-common/mainState';
import { PostOffice } from '../../react-common/postOffice';
import { combineReducers, createAsyncStore, PostMessageFunc, QueuableAction } from '../../react-common/reduxUtils';
import { computeEditorOptions, loadDefaultSettings } from '../../react-common/settingsReactSide';
import { INativeEditorActionMapping } from './mapping';
import { reducerMap } from './reducers';

function generateDefaultState(skipDefault: boolean, baseTheme: string): IMainState {
    return {
        // tslint:disable-next-line: no-typeof-undefined
        skipDefault,
        testMode: false,
        baseTheme: loadDefaultSettings().ignoreVscodeTheme ? 'vscode-light' : baseTheme,
        editorOptions: computeEditorOptions(),
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
        settings: loadDefaultSettings()
    };
}

function generateRootReducer(skipDefault: boolean, baseTheme: string, postOffice: PostOffice):
    Reducer<IMainState, QueuableAction<INativeEditorActionMapping>> {
    // First create our default state.
    const defaultState = generateDefaultState(skipDefault, baseTheme);

    // Extract out a post message function
    const postMessage: PostMessageFunc<IInteractiveWindowMapping> = (type, payload) => {
        setTimeout(() => postOffice.sendMessage<IInteractiveWindowMapping>(type, payload));
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMainState, INativeEditorActionMapping>(
        defaultState,
        postMessage,
        reducerMap);
}

export function createStore(skipDefault: boolean, baseTheme: string) {
    // Create a post office to listen to store dispatches and allow reducers to
    // send messages
    const postOffice = new PostOffice();

    // Send this into the root reducer
    const store = createAsyncStore<IMainState, QueuableAction<INativeEditorActionMapping>>(
        generateRootReducer(skipDefault, baseTheme, postOffice));

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
