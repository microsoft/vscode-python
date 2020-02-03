// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as Redux from 'redux';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { shouldRebroadcast } from '../../../client/datascience/interactive-common/syncrhonization';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { CssMessages, SharedMessages } from '../../../client/datascience/messages';
import { CommonAction, CommonActionType } from './reducers/types';

const AllowedMessages = [...Object.values(InteractiveWindowMessages), ...Object.values(CssMessages), ...Object.values(SharedMessages), ...Object.values(CommonActionType)];
export function isAllowedMessage(message: string) {
    // tslint:disable-next-line: no-any
    return AllowedMessages.includes(message as any);
}
export function isAllowedAction(action: Redux.AnyAction) {
    return isAllowedMessage(action.type);
}

export function createIncomingActionWithPayload<T>(type: CommonActionType | InteractiveWindowMessages, data: T): CommonAction<T> {
    console.error(`Create ${type}`);
    // tslint:disable-next-line: no-any
    return { type, payload: ({ data, messageDirection: 'incoming' } as any) as BaseReduxActionPayload<T> };
}
export function createIncomingAction(type: CommonActionType | InteractiveWindowMessages): CommonAction {
    console.error(`Create ${type}`);
    return { type, payload: { messageDirection: 'incoming', data: undefined } };
}

// Actions created from messages
export function createPostableAction<M extends IInteractiveWindowMapping, T extends keyof M = keyof M>(message: T, payload?: M[T]): Redux.AnyAction {
    const newPayload: BaseReduxActionPayload<M[T]> = ({
        data: payload,
        messageDirection: 'outgoing'
        // tslint:disable-next-line: no-any
    } as any) as BaseReduxActionPayload<M[T]>;
    return { type: `${message}`, payload: newPayload };
}

type Dispatcher = (action: Redux.AnyAction) => Redux.AnyAction;
/**
 * Checks whether a message needs to be re-broadcasted.
 */
export function reBroadcastMessageIfRequired(
    storeDispatcher: Dispatcher,
    message: InteractiveWindowMessages | SharedMessages | CommonActionType | CssMessages,
    payload?: BaseReduxActionPayload<{}>
) {
    if (typeof payload?.messageType === 'number' || payload?.messageDirection === 'outgoing' || message === InteractiveWindowMessages.Sync) {
        return;
    }
    console.error(`Check to Rebroadcast Message ${message}`);
    // Check if we need to re-broadcast this message to other editors/sessions.
    // tslint:disable-next-line: no-any
    const result = shouldRebroadcast(message as any);
    if (result[0]) {
        // Mark message as incoming, to indicate this will be sent into the other webviews.
        // tslint:disable-next-line: no-any
        const syncPayloadData: BaseReduxActionPayload<any> = { data: payload?.data, messageType: result[1], messageDirection: 'incoming' };
        // tslint:disable-next-line: no-any
        const syncPayload = { type: message, payload: syncPayloadData } as any;
        // Send this out.
        console.error(`Rebroadcast Message ${message}`);
        console.error(syncPayload);
        storeDispatcher(createPostableAction(InteractiveWindowMessages.Sync, syncPayload));
    }
}
export function reBroadcastMessageIfRequiredX(
    storeDispatcher: Function,
    message: InteractiveWindowMessages | SharedMessages | CommonActionType | CssMessages,
    payload?: BaseReduxActionPayload<{}>
) {
    console.error(`Check to Rebroadcast Messagexx11 ${message}`);
    if (typeof payload?.messageType === 'number' || payload?.messageDirection === 'outgoing' || message === InteractiveWindowMessages.Sync) {
        return;
    }
    console.error(`Check to Rebroadcast Messagexx222 ${message}`);
    // Check if we need to re-broadcast this message to other editors/sessions.
    // tslint:disable-next-line: no-any
    const result = shouldRebroadcast(message as any);
    if (result[0]) {
        // Mark message as incoming, to indicate this will be sent into the other webviews.
        // tslint:disable-next-line: no-any
        const syncPayloadData: BaseReduxActionPayload<any> = { data: payload?.data, messageType: result[1], messageDirection: 'incoming' };
        // tslint:disable-next-line: no-any
        const syncPayload = { type: message, payload: syncPayloadData } as any;
        // Send this out.
        console.error(`Rebroadcast Message ${message}`);
        console.error(syncPayload);
        const action = createPostableAction(InteractiveWindowMessages.Sync, syncPayload);
        storeDispatcher(action.type, action.payload);
    }
}
