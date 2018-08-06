// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import { expect } from 'chai';
import { ChildProcess, spawn } from 'child_process';
import * as getFreePort from 'get-port';
import { Socket } from 'net';
import * as path from 'path';
import { PassThrough } from 'stream';
import { Message } from 'vscode-debugadapter/lib/messages';
import { DebugProtocol } from 'vscode-debugprotocol';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { sleep } from '../../client/common/core.utils';
import { createDeferred } from '../../client/common/helpers';
import { PTVSD_PATH } from '../../client/debugger/Common/constants';
import { ProtocolParser } from '../../client/debugger/Common/protocolParser';
import { ProtocolMessageWriter } from '../../client/debugger/Common/protocolWriter';
import { PythonDebugger } from '../../client/debugger/mainV2';
import { PYTHON_PATH } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';

class Request extends Message implements DebugProtocol.InitializeRequest {
    // tslint:disable-next-line:no-banned-terms
    public arguments: any;
    constructor(public command: string, args: any) {
        super('request');
        this.arguments = args;
    }
}

const fileToDebug = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd.py');

suite('Debugging - Capabilities', () => {
    let disposables: { dispose?: Function; destroy?: Function }[];
    let proc: ChildProcess;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        this.timeout(30000);
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
        const port = await getFreePort({ host, port: 3000 });
        const env = { ...process.env };
        env.PYTHONPATH = PTVSD_PATH;
        proc = spawn(PYTHON_PATH, ['-m', 'ptvsd', '--server', '--port', `${port}`, '--file', fileToDebug], { cwd: path.dirname(fileToDebug), env });
        await sleep(3000);

        const connected = createDeferred();
        const socket = new Socket();
        socket.on('error', connected.reject.bind(connected));
        socket.connect({ port, host }, () => connected.resolve(socket));
        await connected.promise;
        const protocolParser = new ProtocolParser();
        protocolParser.connect(socket!);
        disposables.push(protocolParser);
        const actualResponsePromise = new Promise<DebugProtocol.InitializeResponse>(resolve => protocolParser.once('response_initialize', resolve));
        protocolWriter.write(socket!, initializeRequest);
        const actualResponse = await actualResponsePromise;

        // supportsDebuggerProperties is not documented, most probably a VS specific item.
        const body: any = actualResponse.body;
        delete body.supportsDebuggerProperties;
        expect(actualResponse.body).to.deep.equal(expectedResponse.body);
    });
});
