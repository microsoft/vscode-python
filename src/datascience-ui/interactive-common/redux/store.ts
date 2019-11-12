// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as Redux from 'redux';

import { Identifiers } from '../../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../interactive-common/mainState';
import { generateMonacoReducer, IMonacoState } from '../../native-editor/redux/reducers/monaco';
import { PostOffice } from '../../react-common/postOffice';
import { combineReducers, createAsyncStore, QueuableAction } from '../../react-common/reduxUtils';
import { computeEditorOptions, loadDefaultSettings } from '../../react-common/settingsReactSide';
import { createEditableCellVM, generateTestState } from '../mainState';
import { AllowedMessages, createPostableAction, generatePostOfficeSendReducer } from './postOffice';

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

function createSendInfoMiddleware(): Redux.Middleware<{}, IStore> {
    return store => next => action => {
        const prevState = store.getState();
        const res = next(action);
        const afterState = store.getState();

        // If cell vm count changed or selected cell changed, send the message
        if (prevState.main.cellVMs.length !== afterState.main.cellVMs.length ||
            prevState.main.selectedCellId !== afterState.main.selectedCellId ||
            prevState.main.undoStack.length !== afterState.main.undoStack.length ||
            prevState.main.redoStack.length !== afterState.main.redoStack.length) {
            store.dispatch(createPostableAction(InteractiveWindowMessages.SendInfo, {
                cellCount: afterState.main.cellVMs.length,
                undoCount: afterState.main.undoStack.length,
                redoCount: afterState.main.redoStack.length,
                selectedCell: afterState.main.selectedCellId
            }));
        }
        return res;
    };
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

    // Create the update context middle ware. It handles the 'sendInfo' message that
    // requires sending on every cell vm length change
    const updateContext = createSendInfoMiddleware();

    // Use this reducer and middle ware to create a store
    const store = createAsyncStore<IStore, Redux.AnyAction>(
        rootReducer,
        !testMode,
        [updateContext]);

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
