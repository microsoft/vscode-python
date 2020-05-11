// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as Redux from 'redux';
import { createLogger } from 'redux-logger';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { StartPageMessages } from '../../../client/datascience/startPage/types';
import { isAllowedAction, postActionToExtension } from '../../interactive-common/redux/helpers';
import { forceLoad } from '../../interactive-common/transforms';
import { PostOffice } from '../../react-common/postOffice';
import { combineReducers, createQueueableActionMiddleware, QueuableAction } from '../../react-common/reduxUtils';
import { IDefaultState } from '../startPage';
import { reducerMap } from './reducers';

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

// This special version uses the reducer map from the INativeEditorMapping
export function createStore(skipDefault: boolean, baseTheme: string, testMode: boolean, postOffice: PostOffice) {
    // Create reducer for the main react UI
    const mainReducer = generateMainReducer(skipDefault, testMode, baseTheme, postOffice, reducerMap);

    const middleware = createMiddleWare(testMode).concat([addMessageDirectionMiddleware]);

    return Redux.createStore(mainReducer, Redux.applyMiddleware(...middleware));
}

function generateMainReducer<M>(
    skipDefault: boolean,
    testMode: boolean,
    baseTheme: string,
    postOffice: PostOffice,
    rMap: M
): Redux.Reducer<IDefaultState, QueuableAction<M>> {
    // First create our default state.
    const defaultState = generateDefaultState(skipDefault, testMode, baseTheme, postOffice);

    // Then combine that with our map of state change message to reducer
    return combineReducers<IDefaultState, M>(defaultState, rMap);
}

function generateDefaultState(
    skipDefault: boolean,
    testMode: boolean,
    baseTheme: string,
    postOffice: PostOffice
): IDefaultState {
    if (!skipDefault) {
        return {
            baseTheme,
            postOffice
        };
    } else {
        return {
            skipDefault,
            testMode,
            baseTheme: baseTheme,
            postOffice
        };
    }
}

export interface IStore {
    main: IDefaultState;
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
        const res = next(action);
        // tslint:disable-next-line: no-any
        const sendMessage = (message: any, payload?: any) => {
            setTimeout(() => {
                transformPromise
                    .then(() => postActionToExtension({ queueAction: store.dispatch }, message, payload))
                    .ignoreErrors();
            });
        };

        // Indicate update from extension side
        if (action.type && action.type === StartPageMessages.SendReleaseNotes) {
            sendMessage(StartPageMessages.ReceivedReleaseNotes);
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
    const actionsWithLargePayload = [StartPageMessages.RequestReleaseNotes];
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
                const main = (rootState.main = ({ ...rootState.main } as any) as Partial<IDefaultState>);
                main.baseTheme = reduceLogMessage;
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
