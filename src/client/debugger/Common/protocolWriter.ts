// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { Socket } from 'net';
import { Message } from 'vscode-debugadapter/lib/messages';
import { IProtocolMessageWriter } from '../types';

@injectable()
export class ProtocolMessageWriter implements IProtocolMessageWriter {
    public write(stream: Socket | NodeJS.WriteStream, message: Message): void {
        const json = JSON.stringify(message);
        const content = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
        stream.write(content, 'utf8');
    }
}
