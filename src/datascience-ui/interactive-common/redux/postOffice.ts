// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as Redux from 'redux';

import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { CssMessages, SharedMessages } from '../../../client/datascience/messages';
import { PostOffice } from '../../react-common/postOffice';

export const AllowedMessages = [...Object.values(InteractiveWindowMessages), ...Object.values(CssMessages), ...Object.values(SharedMessages)];

// Actions created from messages
export function createPostableAction<M extends IInteractiveWindowMapping, T extends keyof M = keyof M>(message: T, payload?: M[T]): Redux.AnyAction {
    const newPayload: BaseReduxActionPayload<M[T]> = ({
        data: payload,
        messageDirection: 'outgoing'
        // tslint:disable-next-line: no-any
    } as any) as BaseReduxActionPayload<M[T]>;
    return { type: `${message}`, payload: newPayload };
}

export function generatePostOfficeSendReducer(postOffice: PostOffice): Redux.Reducer<{}, Redux.AnyAction> {
    // tslint:disable-next-line: no-function-expression
    return function(_state: {} | undefined, action: Redux.AnyAction): {} {
        // Make sure a valid message
        // tslint:disable-next-line: no-any
        const payload: BaseReduxActionPayload<{}> | undefined = action.payload;
        if (AllowedMessages.find(k => k === action.type) && payload?.messageDirection === 'outgoing') {
            // Just post this to the post office.
            // tslint:disable-next-line: no-any
            postOffice.sendMessage<IInteractiveWindowMapping>(action.type, payload.data as any);
            console.error(`Send Message ${action.type}`);
        }

        // We don't modify the state.
        return {};
    };
}
