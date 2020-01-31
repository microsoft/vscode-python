// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Stuff common to React and Extensions.

type BaseData = {
    /**
     * If this property exists, then this is an action that has been dispatched for the solve purpose of:
     * 1. Synchronizing states across different editors (pointing to the same file).
     * 2. Synchronizing states across different editors (pointing to the same file) in different sessions.
     *
     * @type {('syncEditors' | 'syncSessions')}
     */
    broadcastReason?: 'syncEditors' | 'syncSessions';
    /**
     * Tells us whether this message is incoming for reducer use or
     * whether this is a message that needs to be sent out to extension (from reducer).
     */
    messageDirection?: 'incoming' | 'outgoing';
};

type BaseDataWithPayload<T> = {
    /**
     * If this property exists, then this is an action that has been dispatched for the solve purpose of:
     * 1. Synchronizing states across different editors (pointing to the same file).
     * 2. Synchronizing states across different editors (pointing to the same file) in different sessions.
     *
     * @type {('syncEditors' | 'syncSessions')}
     */
    broadcastReason?: 'syncEditors' | 'syncSessions';
    /**
     * Tells us whether this message is incoming for reducer use or
     * whether this is a message that needs to be sent out to extension (from reducer).
     */
    messageDirection?: 'incoming' | 'outgoing';
    data: T;
};

// This forms the base content of every payload in all dispatchers.
export type BaseReduxActionPayload<T = never | undefined> = T extends never ? (T extends undefined ? BaseData : BaseDataWithPayload<T>) : BaseDataWithPayload<T>;
