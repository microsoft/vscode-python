// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { expect } from 'chai';
import { Transform } from 'stream';
import { InitializedEvent } from 'vscode-debugadapter/lib/main';
import { ProtocolMessageWriter } from '../../../client/debugger/debugAdapter/Common/protocolWriter';

suite('Debugging - Protocol Writer', () => {
    test('Test request, response and event messages', async () => {
        let dataWritten = '';
        const throughOutStream = new Transform({
            transform: (chunk, _encoding, callback) => {
                dataWritten += (chunk as Buffer).toString('utf8');
                callback(undefined, chunk);
            },
        });

        const message = new InitializedEvent();
        message.seq = 123;
        const writer = new ProtocolMessageWriter();
        writer.write(throughOutStream, message);

        const json = JSON.stringify(message);
        const expectedMessage = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
        expect(dataWritten).to.be.equal(expectedMessage);
    });
});
