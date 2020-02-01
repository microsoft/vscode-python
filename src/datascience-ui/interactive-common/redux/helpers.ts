// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as Redux from 'redux';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { CssMessages, SharedMessages } from '../../../client/datascience/messages';
import { CommonAction, CommonActionType } from './reducers/types';

const AllowedMessages = [...Object.values(InteractiveWindowMessages), ...Object.values(CssMessages), ...Object.values(SharedMessages)];
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
