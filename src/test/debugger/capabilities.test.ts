// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import { expect } from 'chai';
import { ChildProcess, spawn } from 'child_process';
import * as getFreePort from 'get-port';
import { connect, Socket } from 'net';
import * as path from 'path';
import { PassThrough } from 'stream';
import { Message } from 'vscode-debugadapter/lib/messages';
import { DebugProtocol } from 'vscode-debugprotocol';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { createDeferred } from '../../client/common/helpers';
import { ProtocolParser } from '../../client/debugger/Common/protocolParser';
import { ProtocolMessageWriter } from '../../client/debugger/Common/protocolWriter';
import { PythonDebugger } from '../../client/debugger/mainV2';
import { sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';

class Request extends Message implements DebugProtocol.InitializeRequest {
    // tslint:disable-next-line:no-banned-terms
    public arguments: any;
    constructor(public command: string, args: any) {
        super('request');
        this.arguments = args;
    }
}

suite('Debugging - Capabilities', () => {
    let disposables: { dispose?: Function; destroy?: Function }[];
    let proc: ChildProcess;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        disposables = [];
    });
    teardown(() => {
        disposables.forEach(disposable => {
            try {
                disposable.dispose!();
                // tslint:disable-next-line:no-empty
            } catch { }
            try {
                disposable.destroy!();
                // tslint:disable-next-line:no-empty
            } catch { }
        });
        try {
            proc.kill();
            // tslint:disable-next-line:no-empty
        } catch { }
    });
    test('Compare capabilities', async () => {
        const protocolWriter = new ProtocolMessageWriter();
        const initializeRequest: DebugProtocol.InitializeRequest = new Request('initialize', { pathFormat: 'path' });

        const debugClient = new PythonDebugger(undefined as any);
        const inStream = new PassThrough();
        const outStream = new PassThrough();
        disposables.push(inStream);
        disposables.push(outStream);
        debugClient.start(inStream, outStream);
        const debugClientProtocolParser = new ProtocolParser();
        debugClientProtocolParser.connect(outStream);
        disposables.push(debugClientProtocolParser);
        const expectedResponsePromise = new Promise<DebugProtocol.InitializeResponse>(resolve => debugClientProtocolParser.once('response_initialize', resolve));
        protocolWriter.write(inStream, initializeRequest);
        const expectedResponse = await expectedResponsePromise;

        const host = 'localhost';
        const port = await getFreePort({ host });
        const env = { ...process.env };
        env.PYTHONPATH = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd');
        proc = spawn('python', ['-m', 'ptvsd', '--server', '--port', `${port}`, '--file', 'someFile.py'], { cwd: __dirname, env });
        // Wait for the socket server to start.
        // Keep trying till we timeout.
        let socket: Socket | undefined;
        for (let index = 0; index < 1000; index += 1) {
            try {
                const connected = createDeferred();
                socket = connect({ port, host }, () => connected.resolve(socket));
                socket.on('error', connected.reject.bind(connected));
                await connected.promise;
                break;
            } catch {
                await sleep(500);
            }
        }
        const protocolParser = new ProtocolParser();
        protocolParser.connect(socket!);
        disposables.push(protocolParser);
        const actualResponsePromise = new Promise<DebugProtocol.InitializeResponse>(resolve => protocolParser.once('response_initialize', resolve));
        protocolWriter.write(socket!, initializeRequest);
        const actualResponse = await actualResponsePromise;

        expect(actualResponse.body).to.deep.equal(expectedResponse.body);
    });
});
