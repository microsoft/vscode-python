// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as getFreePort from 'get-port';
import * as net from 'net';
import * as path from 'path';
import { ThreadEvent } from 'vscode-debugadapter';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { createDeferred } from '../../client/common/helpers';
import { LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

use(chaiAsPromised);

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'Main.js');

// tslint:disable-next-line:max-func-body-length
suite('Standard Debugging', () => {
    let debugClient: DebugClient;
    suiteSetup(initialize);

    setup(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        debugClient = new DebugClient('node', DEBUG_ADAPTER, 'python');
        await debugClient.start();
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            debugClient.stop();
            // tslint:disable-next-line:no-empty
        } catch (ex) { }
    });

    async function testDebuggingWithProvidedPort(port?: number | undefined, host?: string | undefined) {
        const args: LaunchRequestArguments = {
            program: path.join(debugFilesPath, 'simplePrint.py'),
            cwd: debugFilesPath,
            stopOnEntry: false,
            debugOptions: ['RedirectOutput'],
            pythonPath: 'python',
            args: [],
            envFile: '',
            port,
            host
        };
        const threadIdPromise = createDeferred<number>();
        debugClient.on('thread', (data: ThreadEvent) => {
            if (data.body.reason === 'started') {
                threadIdPromise.resolve(data.body.threadId);
            }
        });

        const initializePromise = debugClient.initializeRequest({
            adapterID: 'python',
            linesStartAt1: true,
            columnsStartAt1: true,
            supportsRunInTerminalRequest: true,
            pathFormat: 'path'
        });

        await debugClient.launch(args);
        await initializePromise;

        // Wait till we get the thread of the program.
        const threadId = await threadIdPromise.promise;
        expect(threadId).to.be.greaterThan(0, 'ThreadId not received');

        // Confirm port is in use (if one was provided).
        if (typeof port === 'number' && port > 0) {
            // We know the port 'debuggerPort' was free, now that the debugger has started confirm that this port is no longer free.
            const portBasedOnDebuggerPort = await getFreePort({ host: 'localhost', port });
            expect(portBasedOnDebuggerPort).is.not.equal(port, 'Port assigned to debugger not used by the debugger');
        }

        // Continue the program.
        debugClient.continueRequest({ threadId });

        await debugClient.waitForEvent('terminated');
    }

    test('Confirm debuggig works if both port and host are not provided', async () => {
        await testDebuggingWithProvidedPort();
    });

    test('Confirm debuggig works if port=0', async () => {
        await testDebuggingWithProvidedPort(0, 'localhost');
    });

    test('Confirm debuggig works if port=0 or host=localhost', async () => {
        await testDebuggingWithProvidedPort(0, 'localhost');
    });

    test('Confirm debuggig works if port=0 or host=127.0.0.1', async () => {
        await testDebuggingWithProvidedPort(0, '127.0.0.1');
    });

    test('Confirm debuggig fails when an invalid host is provided', async () => {
        const promise = testDebuggingWithProvidedPort(0, 'xyz123409924ple_ewf');
        expect(promise).to.eventually.be.rejected.and.to.have.property('code', 'ENOTFOUND', 'Debugging failed for some other reason');
    });

    test('Confirm debuggig fails when provided port is in use', async () => {
        // tslint:disable-next-line:no-empty
        const server = net.createServer((s) => { });
        const port = await new Promise<number>((resolve, reject) => server.listen({ host: 'localhost', port: 0 }, () => resolve(server.address().port)));
        try {
            const promise = testDebuggingWithProvidedPort(port);
            expect(promise).to.eventually.be.rejected.and.to.have.property('code', 'EADDRINUSE', 'Debugging failed for some other reason');
        } finally {
            server.close();
        }
    });
});
