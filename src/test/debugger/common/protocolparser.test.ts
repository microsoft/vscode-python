// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Transform } from 'stream';
import { ProtcolParser } from '../../../client/debugger/Common/protocolParser';

suite('Debugging - Protcol Parser', () => {
    test('Test request, response and event messages', async () => {
        const stream = new Transform({
            transform(chunk, _encoding, callback) {
                callback(null, chunk);
            }
        });

        const protocolParser = new ProtcolParser(stream);
        let messagesDetected = 0;
        protocolParser.on('data', () => messagesDetected += 1);
        const requestDetected = new Promise<boolean>(resolve => {
            protocolParser.on('request_initialize', () => resolve(true));
        });
        const responseDetected = new Promise<boolean>(resolve => {
            protocolParser.on('response_initialize', () => resolve(true));
        });
        const eventDetected = new Promise<boolean>(resolve => {
            protocolParser.on('event_initialized', () => resolve(true));
        });

        stream.write('Content-Length: 289\r\n\r\n{"command":"initialize","arguments":{"clientID":"vscode","adapterID":"pythonExperiment","pathFormat":"path","linesStartAt1":true,"columnsStartAt1":true,"supportsVariableType":true,"supportsVariablePaging":true,"supportsRunInTerminalRequest":true,"locale":"en-us"},"type":"request","seq":1}');
        await expect(requestDetected).to.eventually.equal(true, 'request not parsed');

        stream.write('Content-Length: 265\r\n\r\n{"seq":1,"type":"response","request_seq":1,"command":"initialize","success":true,"body":{"supportsEvaluateForHovers":false,"supportsConditionalBreakpoints":true,"supportsConfigurationDoneRequest":true,"supportsFunctionBreakpoints":false,"supportsSetVariable":true}}');
        await expect(responseDetected).to.eventually.equal(true, 'response not parsed');

        stream.write('Content-Length: 63\r\n\r\n{"type": "event", "seq": 1, "event": "initialized", "body": {}}');
        await expect(eventDetected).to.eventually.equal(true, 'event not parsed');

        expect(messagesDetected).to.be.equal(3, 'incorrect number of protocol messages');
    });
});
