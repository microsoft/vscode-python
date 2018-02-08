// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { Message } from 'vscode-debugadapter/lib/messages';
import { DebugProtocol } from 'vscode-debugprotocol';

export class Event extends Message implements DebugProtocol.Event {
    public event: string;

    public constructor(event: string, body?: any) {
        super('event');
        this.event = event;
        if (body) {
            (this as any).body = body;
        }
    }
}
