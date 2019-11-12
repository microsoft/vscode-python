// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as Redux from 'redux';

import { Identifiers } from '../../../client/datascience/constants';
import { IMainState } from '../../interactive-common/mainState';
import { generateMonacoReducer, IMonacoState } from '../../native-editor/redux/reducers/monaco';
import { PostOffice } from '../../react-common/postOffice';
import { combineReducers, createAsyncStore, QueuableAction } from '../../react-common/reduxUtils';
import { computeEditorOptions, loadDefaultSettings } from '../../react-common/settingsReactSide';
import { createEditableCellVM, generateTestState } from '../mainState';
import { AllowedMessages, generatePostOfficeSendReducer } from './postOffice';

function generateDefaultState(skipDefault: boolean, testMode: boolean, baseTheme: string, editable: boolean): IMainState {
    const defaultSettings = loadDefaultSettings();
    if (!skipDefault) {
        return generateTestState('', editable);
    } else {
        return {
            // tslint:disable-next-line: no-typeof-undefined
            skipDefault,
            testMode,
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
            editCellVM: editable ? undefined : createEditableCellVM(0),
            isAtBottom: true,
            font: {
                size: 14,
                family: 'Consolas, \'Courier New\', monospace'
            },
            codeTheme: Identifiers.GeneratedThemeName,
            settings: defaultSettings,
            activateCount: 0,
            monacoReady: testMode, // When testing, monaco starts out ready
            loaded: false
        };
    }
}

function generateMainReducer<M>(skipDefault: boolean, testMode: boolean, baseTheme: string, editable: boolean, reducerMap: M): Redux.Reducer<IMainState, QueuableAction<M>> {
    // First create our default state.
    const defaultState = generateDefaultState(skipDefault, testMode, baseTheme, editable);

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMainState, M>(
        defaultState,
        reducerMap);
}

export interface IStore {
    main: IMainState;
    monaco: IMonacoState;
    post: {};
}

export function createStore<M>(skipDefault: boolean, baseTheme: string, testMode: boolean, editable: boolean, reducerMap: M) {
    // Create a post office to listen to store dispatches and allow reducers to
    // send messages
    const postOffice = new PostOffice();

    // Create reducer for the main react UI
    const mainReducer = generateMainReducer(skipDefault, testMode, baseTheme, editable, reducerMap);

    // Create reducer to pass window messages to the other side
    const postOfficeReducer = generatePostOfficeSendReducer(postOffice);

    // Create another reducer for handling monaco state
    const monacoReducer = generateMonacoReducer(testMode);

    // Combine these together
    const rootReducer = Redux.combineReducers<IStore>({
        main: mainReducer,
        monaco: monacoReducer,
        post: postOfficeReducer
    });

    // Send this into the root reducer
    const store = createAsyncStore<IStore, Redux.AnyAction>(
        rootReducer,
        !testMode);

    // Make all messages from the post office dispatch to the store, changing the type to
    // turn them into actions.
    postOffice.addHandler({
        // tslint:disable-next-line: no-any
        handleMessage(message: string, payload: any): boolean {
            // Double check this is one of our messages. React will actually post messages here too during development
            if (AllowedMessages.find(k => k === message)) {
                // Prefix message type with 'action.' so that we can:
                // - Have one reducer for incoming
                // - Have another reducer for outgoing
                store.dispatch({ type: `action.${message}`, payload });
            }
            return true;
        }
    });

    return store;
}
