// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Stuff common to React and Extensions.

// This forms the base content of every payload in all dispatchers.
export type BaseReduxActionPayload = {
    /**
     * If this property exists, then this is an action that has been dispatched for the solve purpose of:
     * 1. Synchronizing states across different editors (pointing to the same file).
     * 2. Synchronizing states across different editors (pointing to the same file) in different sessions.
     *
     * @type {('syncEditors' | 'syncSessions')}
     */
    broadcastReason?: 'syncEditors' | 'syncSessions';
};
