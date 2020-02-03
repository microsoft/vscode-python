// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as Redux from 'redux';

import { IInteractiveWindowMapping } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { PostOffice } from '../../react-common/postOffice';
import { isAllowedAction, reBroadcastMessageIfRequiredX } from './helpers';
import { CommonActionType } from './reducers/types';

export function generatePostOfficeSendReducer(postOffice: PostOffice): Redux.Reducer<{}, Redux.AnyAction> {
    // tslint:disable-next-line: no-function-expression
    return function(_state: {} | undefined, action: Redux.AnyAction): {} {
        // Make sure a valid message
        if (action.type === CommonActionType.PostOutgoingMessage) {
            // Unwrap the payload that was created in `createPostableAction`.
            const type = action.payload.type;
            const payload: BaseReduxActionPayload<{}> | undefined = action.payload.payload;
            if (isAllowedAction(type)) {
                if (payload?.messageDirection === 'outgoing') {
                    // Just post this to the post office.
                    // tslint:disable-next-line: no-any
                    postOffice.sendMessage<IInteractiveWindowMapping>(action.type, payload.data as any);
                }

                if (payload?.messageDirection === 'incoming' && typeof payload?.messageType !== 'number') {
                    setTimeout(() => {
                        reBroadcastMessageIfRequiredX(postOffice.sendMessage.bind(postOffice), action.type, action?.payload);
                    }, 1);
                }
            }
        }

        // We don't modify the state.
        return {};
    };
}
