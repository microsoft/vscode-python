// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fastDeepEqual from 'fast-deep-equal';
import * as path from 'path';
import * as Redux from 'redux';
import { createLogger } from 'redux-logger';

import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { Identifiers } from '../../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { MessageType } from '../../../client/datascience/interactive-common/synchronization';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { CssMessages } from '../../../client/datascience/messages';
import { CellState } from '../../../client/datascience/types';
import { getSelectedAndFocusedInfo, IMainState, ServerStatus } from '../../interactive-common/mainState';
import { getLocString } from '../../react-common/locReactSide';
import { PostOffice } from '../../react-common/postOffice';
import { combineReducers, createQueueableActionMiddleware, QueuableAction } from '../../react-common/reduxUtils';
import { computeEditorOptions, getDefaultSettings } from '../../react-common/settingsReactSide';
import { createEditableCellVM, generateTestState } from '../mainState';
import { forceLoad } from '../transforms';
import { isAllowedAction, isAllowedMessage, postActionToExtension } from './helpers';
import { generatePostOfficeSendReducer } from './postOffice';
import { generateMonacoReducer, IMonacoState } from './reducers/monaco';
import { generateVariableReducer, IVariableState } from './reducers/variables';

function generateDefaultState(
    skipDefault: boolean,
    testMode: boolean,
    baseTheme: string,
    editable: boolean
): IMainState {
    if (!skipDefault) {
        return generateTestState('', editable);
    } else {
        return {
            // tslint:disable-next-line: no-typeof-undefined
            skipDefault,
            testMode,
            baseTheme: baseTheme,
            cellVMs: [],
            busy: true,
            undoStack: [],
            redoStack: [],
            submittedText: false,
            currentExecutionCount: 0,
            debugging: false,
            knownDark: false,
            dirty: false,
            editCellVM: editable ? undefined : createEditableCellVM(0),
            isAtBottom: true,
            font: {
                size: 14,
                family: "Consolas, 'Courier New', monospace"
            },
            codeTheme: Identifiers.GeneratedThemeName,
            focusPending: 0,
            monacoReady: testMode, // When testing, monaco starts out ready
            loaded: false,
            kernel: {
                displayName: getLocString('DataScience.noKernel', 'No Kernel'),
                localizedUri: getLocString('DataScience.serverNotStarted', 'Not Started'),
                jupyterServerStatus: ServerStatus.NotStarted
            },
            settings: testMode ? getDefaultSettings() : undefined, // When testing, we don't send (or wait) for the real settings.
            editorOptions: testMode ? computeEditorOptions(getDefaultSettings()) : undefined
        };
    }
}

function generateMainReducer<M>(
    skipDefault: boolean,
    testMode: boolean,
    baseTheme: string,
    editable: boolean,
    reducerMap: M
): Redux.Reducer<IMainState, QueuableAction<M>> {
    // First create our default state.
    const defaultState = generateDefaultState(skipDefault, testMode, baseTheme, editable);

    // Then combine that with our map of state change message to reducer
    return combineReducers<IMainState, M>(defaultState, reducerMap);
}

function createSendInfoMiddleware(): Redux.Middleware<{}, IStore> {
    return (store) => (next) => (action) => {
        const prevState = store.getState();
        const res = next(action);
        const afterState = store.getState();

        // If the action is part of a sync message, then do not send it to the extension.
        const messageType = (action?.payload as BaseReduxActionPayload).messageType ?? MessageType.other;
        const isSyncMessage =
            (messageType & MessageType.syncAcrossSameNotebooks) === MessageType.syncAcrossSameNotebooks &&
            (messageType & MessageType.syncAcrossSameNotebooks) === MessageType.syncWithLiveShare;
        if (isSyncMessage) {
            return res;
        }

        // If cell vm count changed or selected cell changed, send the message
        const currentSelection = getSelectedAndFocusedInfo(afterState.main);
        if (
            prevState.main.cellVMs.length !== afterState.main.cellVMs.length ||
            getSelectedAndFocusedInfo(prevState.main).selectedCellId !== currentSelection.selectedCellId ||
            prevState.main.undoStack.length !== afterState.main.undoStack.length ||
            prevState.main.redoStack.length !== afterState.main.redoStack.length
        ) {
            postActionToExtension({ queueAction: store.dispatch }, InteractiveWindowMessages.SendInfo, {
                cellCount: afterState.main.cellVMs.length,
                undoCount: afterState.main.undoStack.length,
                redoCount: afterState.main.redoStack.length,
                selectedCell: currentSelection.selectedCellId
            });
        }
        return res;
    };
}

function createTestLogger() {
    const logFileEnv = process.env.VSC_PYTHON_WEBVIEW_LOG_FILE;
    if (logFileEnv) {
        // tslint:disable-next-line: no-require-imports
        const log4js = require('log4js') as typeof import('log4js');
        const logFilePath = path.isAbsolute(logFileEnv) ? logFileEnv : path.join(EXTENSION_ROOT_DIR, logFileEnv);
        log4js.configure({
            appenders: { reduxLogger: { type: 'file', filename: logFilePath } },
            categories: { default: { appenders: ['reduxLogger'], level: 'debug' } }
        });
        return log4js.getLogger();
    }
}

function createTestMiddleware(): Redux.Middleware<{}, IStore> {
    // Make sure all dynamic imports are loaded.
    const transformPromise = forceLoad();

    return (store) => (next) => (action) => {
        const prevState = store.getState();
        const res = next(action);
        const afterState = store.getState();
        // tslint:disable-next-line: no-any
        const sendMessage = (message: any, payload?: any) => {
            setTimeout(() => {
                transformPromise
                    .then(() => postActionToExtension({ queueAction: store.dispatch }, message, payload))
                    .ignoreErrors();
            });
        };

        // Special case for focusing a cell
        const previousSelection = getSelectedAndFocusedInfo(prevState.main);
        const currentSelection = getSelectedAndFocusedInfo(afterState.main);
        if (previousSelection.focusedCellId !== currentSelection.focusedCellId && currentSelection.focusedCellId) {
            // Send async so happens after render state changes (so our enzyme wrapper is up to date)
            sendMessage(InteractiveWindowMessages.FocusedCellEditor, { cellId: action.payload.cellId });
        }
        // Special case for unfocusing a cell
        if (previousSelection.focusedCellId !== currentSelection.focusedCellId && !currentSelection.focusedCellId) {
            // Send async so happens after render state changes (so our enzyme wrapper is up to date)
            sendMessage(InteractiveWindowMessages.UnfocusedCellEditor);
        }

        // Indicate settings updates
        if (!fastDeepEqual(prevState.main.settings, afterState.main.settings)) {
            // Send async so happens after render state changes (so our enzyme wrapper is up to date)
            sendMessage(InteractiveWindowMessages.SettingsUpdated);
        }

        // Indicate clean changes
        if (prevState.main.dirty && !afterState.main.dirty) {
            sendMessage(InteractiveWindowMessages.NotebookClean);
        }

        // Indicate dirty changes
        if (!prevState.main.dirty && afterState.main.dirty) {
            sendMessage(InteractiveWindowMessages.NotebookDirty);
        }

        // Indicate variables complete
        if (!fastDeepEqual(prevState.variables.variables, afterState.variables.variables)) {
            sendMessage(InteractiveWindowMessages.VariablesComplete);
        }

        // Indicate update from extension side
        if (action.type && action.type === InteractiveWindowMessages.UpdateModel) {
            sendMessage(InteractiveWindowMessages.ReceivedUpdateModel);
        }

        // Special case for rendering complete
        const prevFinished = prevState.main.cellVMs
            .filter((c) => c.cell.state === CellState.finished || c.cell.state === CellState.error)
            .map((c) => c.cell.id);
        const afterFinished = afterState.main.cellVMs
            .filter((c) => c.cell.state === CellState.finished || c.cell.state === CellState.error)
            .map((c) => c.cell.id);
        if (
            afterFinished.length > prevFinished.length ||
            (afterFinished.length !== prevFinished.length &&
                afterState.main.cellVMs.length !== prevState.main.cellVMs.length)
        ) {
            const diff = afterFinished.filter((r) => prevFinished.indexOf(r) < 0);
            // Send async so happens after the render is actually finished.
            sendMessage(InteractiveWindowMessages.ExecutionRendered, { ids: diff });
        }

        // Entering break state in a native cell
        const prevBreak = prevState.main.cellVMs.find((cvm) => cvm.currentStack);
        const newBreak = afterState.main.cellVMs.find((cvm) => cvm.currentStack);
        if (prevBreak !== newBreak || !fastDeepEqual(prevBreak?.currentStack, newBreak?.currentStack)) {
            sendMessage(InteractiveWindowMessages.ShowingIp);
        }

        if (action.type !== 'action.postOutgoingMessage') {
            sendMessage(`DISPATCHED_ACTION_${action.type}`, {});
        }
        return res;
    };
}

function createMiddleWare(testMode: boolean): Redux.Middleware<{}, IStore>[] {
    // Create the middleware that modifies actions to queue new actions
    const queueableActions = createQueueableActionMiddleware();

    // Create the update context middle ware. It handles the 'sendInfo' message that
    // requires sending on every cell vm length change
    const updateContext = createSendInfoMiddleware();

    // Create the test middle ware. It sends messages that are used for testing only
    // Or if testing in UI Test.
    // tslint:disable-next-line: no-any
    const acquireVsCodeApi = (window as any).acquireVsCodeApi as Function;
    const isUITest = acquireVsCodeApi && acquireVsCodeApi().handleMessage ? true : false;
    const testMiddleware = testMode || isUITest ? createTestMiddleware() : undefined;

    // Create the logger if we're not in production mode or we're forcing logging
    const reduceLogMessage = '<payload too large to displayed in logs (at least on CI)>';
    const actionsWithLargePayload = [
        InteractiveWindowMessages.LoadOnigasmAssemblyResponse,
        CssMessages.GetCssResponse,
        InteractiveWindowMessages.LoadTmLanguageResponse
    ];
    const logger = createLogger({
        // tslint:disable-next-line: no-any
        stateTransformer: (state: any) => {
            if (!state || typeof state !== 'object') {
                return state;
            }
            // tslint:disable-next-line: no-any
            const rootState = { ...state } as any;
            if ('main' in rootState && typeof rootState.main === 'object') {
                // tslint:disable-next-line: no-any
                const main = (rootState.main = ({ ...rootState.main } as any) as Partial<IMainState>);
                main.rootCss = reduceLogMessage;
                main.rootStyle = reduceLogMessage;
                // tslint:disable-next-line: no-any
                main.editorOptions = reduceLogMessage as any;
                // tslint:disable-next-line: no-any
                main.settings = reduceLogMessage as any;
            }
            rootState.monaco = reduceLogMessage;

            return rootState;
        },
        // tslint:disable-next-line: no-any
        actionTransformer: (action: any) => {
            if (!action) {
                return action;
            }
            if (actionsWithLargePayload.indexOf(action.type) >= 0) {
                return { ...action, payload: reduceLogMessage };
            }
            return action;
        },
        logger: testMode ? createTestLogger() : window.console
    });
    const loggerMiddleware =
        process.env.VSC_PYTHON_FORCE_LOGGING !== undefined && !process.env.VSC_PYTHON_DS_NO_REDUX_LOGGING
            ? logger
            : undefined;

    const results: Redux.Middleware<{}, IStore>[] = [];
    results.push(queueableActions);
    results.push(updateContext);
    if (testMiddleware) {
        results.push(testMiddleware);
    }
    if (loggerMiddleware) {
        results.push(loggerMiddleware);
    }

    return results;
}

export interface IStore {
    main: IMainState;
    variables: IVariableState;
    monaco: IMonacoState;
    post: {};
}

export interface IMainWithVariables extends IMainState {
    variableState: IVariableState;
}

/**
 * Middleware that will ensure all actions have `messageDirection` property.
 */
const addMessageDirectionMiddleware: Redux.Middleware = (_store) => (next) => (action: Redux.AnyAction) => {
    if (isAllowedAction(action)) {
        // Ensure all dispatched messages have been flagged as `incoming`.
        const payload: BaseReduxActionPayload<{}> = action.payload || {};
        if (!payload.messageDirection) {
            action.payload = { ...payload, messageDirection: 'incoming' };
        }
    }

    return next(action);
};

export function createStore<M>(
    skipDefault: boolean,
    baseTheme: string,
    testMode: boolean,
    editable: boolean,
    reducerMap: M,
    postOffice: PostOffice
) {
    // Create reducer for the main react UI
    const mainReducer = generateMainReducer(skipDefault, testMode, baseTheme, editable, reducerMap);

    // Create reducer to pass window messages to the other side
    const postOfficeReducer = generatePostOfficeSendReducer(postOffice);

    // Create another reducer for handling monaco state
    const monacoReducer = generateMonacoReducer(testMode, postOffice);

    // Create another reducer for handling variable state
    const variableReducer = generateVariableReducer();

    // Combine these together
    const rootReducer = Redux.combineReducers<IStore>({
        main: mainReducer,
        variables: variableReducer,
        monaco: monacoReducer,
        post: postOfficeReducer
    });

    // Create our middleware
    const middleware = createMiddleWare(testMode).concat([addMessageDirectionMiddleware]);

    // Use this reducer and middle ware to create a store
    const store = Redux.createStore(rootReducer, Redux.applyMiddleware(...middleware));

    // Make all messages from the post office dispatch to the store, changing the type to
    // turn them into actions.
    postOffice.addHandler({
        // tslint:disable-next-line: no-any
        handleMessage(message: string, payload?: any): boolean {
            // Double check this is one of our messages. React will actually post messages here too during development
            if (isAllowedMessage(message)) {
                const basePayload: BaseReduxActionPayload = { data: payload };
                if (message === InteractiveWindowMessages.Sync) {
                    // This is a message that has been sent from extension purely for synchronization purposes.
                    // Unwrap the message.
                    message = payload.type;
                    // This is a message that came in as a result of an outgoing message from another view.
                    basePayload.messageDirection = 'outgoing';
                    basePayload.messageType = payload.payload.messageType ?? MessageType.syncAcrossSameNotebooks;
                    basePayload.data = payload.payload.data;
                } else {
                    // Messages result of some user action.
                    basePayload.messageType = basePayload.messageType ?? MessageType.other;
                }
                store.dispatch({ type: message, payload: basePayload });
            }
            return true;
        }
    });

    return store;
}
