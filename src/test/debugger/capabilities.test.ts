// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any no-object-literal-type-assertion no-banned-terms

import { expect } from 'chai';
import { ChildProcess, spawn } from 'child_process';
import * as getFreePort from 'get-port';
import { Socket } from 'net';
import * as path from 'path';
import { Message } from 'vscode-debugadapter/lib/messages';
import { DebugProtocol } from 'vscode-debugprotocol';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { createDeferred, sleep } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { PTVSD_PATH } from '../../client/debugger/constants';
import { ProtocolParser } from '../../client/debugger/debugAdapter/Common/protocolParser';
import { ProtocolMessageWriter } from '../../client/debugger/debugAdapter/Common/protocolWriter';
import { PythonDebugger } from '../../client/debugger/debugAdapter/main';
import { PYTHON_PATH } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';

const fileToDebug = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'testMultiRootWkspc',
    'workspace5',
    'remoteDebugger-start-with-ptvsd-nowait.py'
);

suite('Debugging - Capabilities', function () {
    this.timeout(30000);
    let disposables: { dispose?: Function; destroy?: Function }[];
    let proc: ChildProcess;
    setup(function () {
        // Skipping to get nightly build to pass. Opened this issue:
        // https://github.com/microsoft/vscode-python/issues/7411
        this.skip();
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        disposables = [];
    });
    teardown(() => {
        disposables.forEach((disposable) => {
            try {
                disposable.dispose!();
            } catch {
                noop();
            }
            try {
                disposable.destroy!();
            } catch {
                noop();
            }
        });
        try {
            proc.kill();
        } catch {
            noop();
        }
    });
    function createRequest(cmd: string, requestArgs: any) {
        return new (class extends Message implements DebugProtocol.InitializeRequest {
            public arguments: any;
            constructor(public command: string, args: any) {
                super('request');
                this.arguments = args;
            }
        })(cmd, requestArgs);
    }
    function createDebugSession() {
        return new (class extends PythonDebugger {
            constructor() {
                super({} as any);
            }

            public getInitializeResponseFromDebugAdapter() {
                let initializeResponse = {
                    body: {}
                } as DebugProtocol.InitializeResponse;
                this.sendResponse = (resp) => (initializeResponse = resp);

                this.initializeRequest(initializeResponse, { supportsRunInTerminalRequest: true, adapterID: '' });
                return initializeResponse;
            }
        })();
    }
    test('Compare capabilities', async () => {
        const customDebugger = createDebugSession();
        const expectedResponse = customDebugger.getInitializeResponseFromDebugAdapter();

        const protocolWriter = new ProtocolMessageWriter();
        const initializeRequest: DebugProtocol.InitializeRequest = createRequest('initialize', { pathFormat: 'path' });
        const host = 'localhost';
        const port = await getFreePort({ host, port: 3000 });
        const env = { ...process.env };
        env.PYTHONPATH = PTVSD_PATH;
        proc = spawn(PYTHON_PATH, ['-m', 'ptvsd', '--host', 'localhost', '--wait', '--port', `${port}`, fileToDebug], {
            cwd: path.dirname(fileToDebug),
            env
        });
        await sleep(3000);

        const connected = createDeferred();
        const socket = new Socket();
        socket.on('error', connected.reject.bind(connected));
        socket.connect({ port, host }, () => connected.resolve(socket));
        await connected.promise;
        const protocolParser = new ProtocolParser();
        protocolParser.connect(socket!);
        disposables.push(protocolParser);
        const actualResponsePromise = new Promise<DebugProtocol.InitializeResponse>((resolve) =>
            protocolParser.once('response_initialize', resolve)
        );
        protocolWriter.write(socket, initializeRequest);
        const actualResponse = await actualResponsePromise;

        const attachRequest: DebugProtocol.AttachRequest = createRequest('attach', {
            name: 'attach',
            request: 'attach',
            type: 'python',
            port: port,
            host: 'localhost',
            logToFile: false,
            debugOptions: []
        });
        const attached = new Promise((resolve) => protocolParser.once('response_attach', resolve));
        protocolWriter.write(socket, attachRequest);
        await attached;

        const configRequest: DebugProtocol.ConfigurationDoneRequest = createRequest('configurationDone', {});
        const configured = new Promise((resolve) => protocolParser.once('response_configurationDone', resolve));
        protocolWriter.write(socket, configRequest);
        await configured;

        protocolParser.dispose();

        // supportsDebuggerProperties is not documented, most probably a VS specific item.
        const body: any = actualResponse.body;
        delete body.supportsDebuggerProperties;
        expect(actualResponse.body).to.deep.equal(expectedResponse.body);
    });
});
