import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs-extra';
import * as getFreePort from 'get-port';
import * as net from 'net';
import * as path from 'path';
import { CancellationTokenSource } from 'vscode';
import { ThreadEvent } from 'vscode-debugadapter';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';
import { createDeferred } from '../../client/common/helpers';
import { execPythonFile } from '../../client/common/utils';
import { LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { MockProcessService } from '../mocks/proc';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

use(chaiAsPromised);

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'Main.js');
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

// tslint:disable-next-line:max-func-body-length
suite('Standard Debugging', () => {
    let debugClient: DebugClient;
    suiteSetup(initialize);

    setup(async () => {
        await initializeTest();
        debugClient = new DebugClient('node', DEBUG_ADAPTER, 'python');
        return debugClient.start();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        debugClient.stop();
        await closeActiveWindows();
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

        const launchResponse = await debugClient.launch(args);
        const initializeResponse = await initializePromise;

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

    test('Confirm debuggig works if no port or host is provided', async () => {
        await testDebuggingWithProvidedPort(undefined, 'localhost');
    });

    test('Confirm debuggig works if port=0 or host is not provided', async () => {
        await testDebuggingWithProvidedPort(0);
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
        const promise = testDebuggingWithProvidedPort(port);
        expect(promise).to.eventually.be.rejected.and.to.have.property('code', 'EADDRINUSE', 'Debugging failed for some other reason');
    });
});
