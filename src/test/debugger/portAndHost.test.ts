// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as getFreePort from 'get-port';
import * as net from 'net';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { noop } from '../../client/common/utils/misc';
import { DebuggerTypeName } from '../../client/debugger/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/types';
import { PYTHON_PATH } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';

use(chaiAsPromised);

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const EXPERIMENTAL_DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'debugAdapter', 'main.js');

const testAdapterFilePath = EXPERIMENTAL_DEBUG_ADAPTER;
const debuggerType = DebuggerTypeName;
// tslint:disable-next-line:max-func-body-length
suite(`Standard Debugging of ports and hosts: ${debuggerType}`, () => {
    let debugClient: DebugClient;
    suiteSetup(async function() {
        // https://github.com/microsoft/vscode-python/issues/9383
        // tslint:disable-next-line:no-invalid-this
        return this.skip();
    });
    setup(async function() {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        debugClient = new DebugClient(process.env.NODE_PATH || 'node', testAdapterFilePath, debuggerType);
        debugClient.defaultTimeout = DEBUGGER_TIMEOUT;
        await debugClient.start();
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            debugClient.stop().catch(noop);
            // tslint:disable-next-line:no-empty
        } catch (ex) {}
    });

    function buildLaunchArgs(
        pythonFile: string,
        stopOnEntry: boolean = false,
        port?: number,
        host?: string,
        showReturnValue: boolean = true
    ): LaunchRequestArguments {
        return {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            showReturnValue,
            logToFile: false,
            debugOptions: [DebugOptions.RedirectOutput],
            pythonPath: PYTHON_PATH,
            args: [],
            envFile: '',
            host,
            port,
            type: debuggerType,
            name: '',
            request: 'launch'
        };
    }

    async function testDebuggingWithProvidedPort(port?: number | undefined, host?: string | undefined) {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('startAndWait.py', false, port, host)),
            debugClient.waitForEvent('initialized')
        ]);

        // Confirm port is in use (if one was provided).
        if (typeof port === 'number' && port > 0) {
            // We know the port 'debuggerPort' was free, now that the debugger has started confirm that this port is no longer free.
            const portBasedOnDebuggerPort = await getFreePort({ host: 'localhost', port });
            expect(portBasedOnDebuggerPort).is.not.equal(port, 'Port assigned to debugger not used by the debugger');
        }
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
        let exception: Error | undefined;
        try {
            await promise;
        } catch (ex) {
            exception = ex;
        }
        expect(exception!.message).contains('ENOTFOUND', 'Debugging failed for some other reason');
    });
    test('Confirm debuggig fails when provided port is in use', async () => {
        const server = net.createServer(noop);
        const port = await new Promise<number>(resolve =>
            server.listen({ host: 'localhost', port: 0 }, () => resolve((server.address() as net.AddressInfo).port))
        );
        let exception: Error | undefined;
        try {
            await testDebuggingWithProvidedPort(port);
        } catch (ex) {
            exception = ex;
        } finally {
            server.close();
        }
        expect(exception!.message).contains('EADDRINUSE', 'Debugging failed for some other reason');
    });
});
