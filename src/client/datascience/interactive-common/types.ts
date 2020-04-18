// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CommonActionType } from '../../../datascience-ui/interactive-common/redux/reducers/types';
import { CssMessages, SharedMessages } from '../messages';
import { InteractiveWindowMessages } from './interactiveWindowTypes';
import { MessageType } from './synchronization';

// Stuff common to React and Extensions.

type BaseData = {
    messageType?: MessageType;
    /**
     * Tells us whether this message is incoming for reducer use or
     * whether this is a message that needs to be sent out to extension (from reducer).
     */
    messageDirection?: 'incoming' | 'outgoing';
};

type BaseDataWithPayload<T> = {
    messageType?: MessageType;
    /**
     * Tells us whether this message is incoming for reducer use or
     * whether this is a message that needs to be sent out to extension (from reducer).
     */
    messageDirection?: 'incoming' | 'outgoing';
    data: T;
};

// This forms the base content of every payload in all dispatchers.
export type BaseReduxActionPayload<T = never | undefined> = T extends never
    ? T extends undefined
        ? BaseData
        : BaseDataWithPayload<T>
    : BaseDataWithPayload<T>;
export type SyncPayload = {
    type: InteractiveWindowMessages | SharedMessages | CommonActionType | CssMessages;
    // tslint:disable-next-line: no-any
    payload: BaseReduxActionPayload<any>;
};
