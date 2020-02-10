// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as Redux from 'redux';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { CssMessages, SharedMessages } from '../../../client/datascience/messages';
import { QueueAnotherFunc } from '../../react-common/reduxUtils';
import { CommonAction, CommonActionType, CommonActionTypeMapping } from './reducers/types';

const AllowedMessages = [...Object.values(InteractiveWindowMessages), ...Object.values(CssMessages), ...Object.values(SharedMessages), ...Object.values(CommonActionType)];
export function isAllowedMessage(message: string) {
    // tslint:disable-next-line: no-any
    return AllowedMessages.includes(message as any);
}
export function isAllowedAction(action: Redux.AnyAction) {
    return isAllowedMessage(action.type);
}

export function createIncomingActionWithPayload<M extends IInteractiveWindowMapping & CommonActionTypeMapping, K extends keyof M>(type: K, data: M[K]): CommonAction<M[K]> {
    // tslint:disable-next-line: no-any
    return { type, payload: { data, messageDirection: 'incoming' } as any } as any;
}
export function createIncomingAction(type: CommonActionType | InteractiveWindowMessages): CommonAction {
    return { type, payload: { messageDirection: 'incoming', data: undefined } };
}

type ReducerArg = {
    // tslint:disable-next-line: no-any
    queueAction: QueueAnotherFunc<any>;
    // tslint:disable-next-line: no-any
    payload?: BaseReduxActionPayload<any>;
};
/**
 * Post a message to the extension (via dispatcher actions).
 */
export function postActionToExtension<K, M extends IInteractiveWindowMapping, T extends keyof M = keyof M>(originalReducerArg: ReducerArg, message: T, payload?: M[T]): void;
/**
 * Post a message to the extension (via dispatcher actions).
 */
// tslint:disable-next-line: unified-signatures
export function postActionToExtension<K, M extends IInteractiveWindowMapping, T extends keyof M = keyof M>(originalReducerArg: ReducerArg, message: T, payload?: M[T]): void;
// tslint:disable-next-line: no-any
export function postActionToExtension(originalReducerArg: ReducerArg, message: any, payload?: any) {
    // tslint:disable-next-line: no-any
    const newPayload: BaseReduxActionPayload<any> = ({
        data: payload,
        messageDirection: 'outgoing'
        // tslint:disable-next-line: no-any
    } as any) as BaseReduxActionPayload<any>;
    const action = { type: CommonActionType.PostOutgoingMessage, payload: { payload: newPayload, type: message } };
    originalReducerArg.queueAction(action);
}
export function unwrapPostableAction(action: Redux.AnyAction): { type: keyof IInteractiveWindowMapping; payload?: BaseReduxActionPayload<{}> } {
    // Unwrap the payload that was created in `createPostableAction`.
    const type = action.type;
    const payload: BaseReduxActionPayload<{}> | undefined = action.payload;
    return { type, payload };
}

export function reBroadcastMessageIfRequired(
    _dispatcher: Function,
    message: InteractiveWindowMessages | SharedMessages | CommonActionType | CssMessages,
    payload?: BaseReduxActionPayload<{}>
) {
    if (typeof payload?.messageType === 'number' || message === InteractiveWindowMessages.Sync) {
        return;
    }
    if (payload?.messageDirection === 'outgoing') {
        return;
    }
    // Temporarily disabled.
    // // Check if we need to re-broadcast this message to other editors/sessions.
    // // tslint:disable-next-line: no-any
    // const result = shouldRebroadcast(message as any);
    // if (result[0]) {
    //     // Mark message as incoming, to indicate this will be sent into the other webviews.
    //     // tslint:disable-next-line: no-any
    //     const syncPayloadData: BaseReduxActionPayload<any> = { data: payload?.data, messageType: result[1], messageDirection: 'incoming' };
    //     // tslint:disable-next-line: no-any
    //     const syncPayload = { type: message, payload: syncPayloadData } as any;
    //     // Send this out.
    //     dispatcher(InteractiveWindowMessages.Sync, syncPayload);
    // }
}
