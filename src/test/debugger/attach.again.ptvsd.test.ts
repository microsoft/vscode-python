// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this max-func-body-length no-empty no-increment-decrement

import { expect } from 'chai';
import { ChildProcess, spawn } from 'child_process';
import * as getFreePort from 'get-port';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import '../../client/common/extensions';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { sleep } from '../common';
import { initialize, IS_APPVEYOR, IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';
import { DebugClientEx } from './debugClient';

const fileToDebug = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd.re-attach.py');
const ptvsdPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd');
const DEBUG_ADAPTER = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'mainV2.js');

suite('Attach Debugger - detach and again again - Experimental', () => {
    let debugClient1: DebugClient;
    let debugClient2: DebugClient;
    let procToKill: ChildProcess;
    suiteSetup(initialize);

    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await sleep(1000);
        try {
            if (debugClient1) {
                await debugClient1.disconnectRequest();
            }
        } catch (ex) { }
        try {
            if (debugClient2) {
                await debugClient2.disconnectRequest();
            }
        } catch (ex) { }
        if (procToKill) {
            try {
                procToKill.kill();
            } catch { }
        }
    });
    async function startDebugger() {
        await sleep(1000);
        const debugClient = createDebugAdapter();
        debugClient.defaultTimeout = DEBUGGER_TIMEOUT;
        await debugClient.start();
        return debugClient;
    }
    /**
     * Creates the debug aimport { AttachRequestArguments } from '../../client/debugger/Common/Contracts';
     * We do not need to support code coverage on AppVeyor, lets use the standard test adapter.
     * @returns {DebugClient}
     */
    function createDebugAdapter(): DebugClient {
        if (IS_WINDOWS) {
            return new DebugClient('node', DEBUG_ADAPTER, 'pythonExperimental');
        } else {
            const coverageDirectory = path.join(EXTENSION_ROOT_DIR, 'debug_coverage_attach_ptvsd');
            return new DebugClientEx(DEBUG_ADAPTER, 'pythonExperimental', coverageDirectory, { cwd: EXTENSION_ROOT_DIR });
        }
    }
    async function startRemoteProcess() {
        const port = await getFreePort({ host: 'localhost', port: 9091 });
        const customEnv = { ...process.env };

        // Set the path for PTVSD to be picked up.
        // tslint:disable-next-line:no-string-literal
        customEnv['PYTHONPATH'] = ptvsdPath;
        const pythonArgs = ['-m', 'ptvsd', '--server', '--port', `${port}`, '--file', fileToDebug.fileToCommandArgument()];
        procToKill = spawn('python', pythonArgs, { env: customEnv, cwd: path.dirname(fileToDebug) });
        // wait for socket server to start.
        await sleep(1000);
        return port;
    }

    async function waitForDebuggerCondfigurationDone(debugClient: DebugClient, port: number) {
        // Send initialize, attach
        const initializePromise = debugClient.initializeRequest({
            adapterID: 'pythonExperimental',
            linesStartAt1: true,
            columnsStartAt1: true,
            supportsRunInTerminalRequest: true,
            pathFormat: 'path',
            supportsVariableType: true,
            supportsVariablePaging: true
        });
        const attachPromise = debugClient.attachRequest({
            localRoot: path.dirname(fileToDebug),
            remoteRoot: path.dirname(fileToDebug),
            type: 'pythonExperimental',
            port: port,
            host: 'localhost',
            logToFile: false,
            debugOptions: ['RedirectOutput']
        });

        await Promise.all([
            initializePromise,
            attachPromise,
            debugClient.waitForEvent('initialized')
        ]);

        await debugClient.configurationDoneRequest();
    }
    async function testAttaching(debugClient: DebugClient, port: number) {
        await waitForDebuggerCondfigurationDone(debugClient, port);
        let threads = await debugClient.threadsRequest();
        expect(threads).to.be.not.equal(undefined, 'no threads response');
        expect(threads.body.threads).to.be.lengthOf(1);

        await debugClient.setExceptionBreakpointsRequest({ filters: [] });
        const breakpointLocation = { path: fileToDebug, column: 1, line: 7 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        await debugClient.setBreakpointsRequest({ lines: [], breakpoints: [], source: { path: breakpointLocation.path } });

        threads = await debugClient.threadsRequest();
        expect(threads).to.be.not.equal(undefined, 'no threads response');
        expect(threads.body.threads).to.be.lengthOf(1);

        await debugClient.continueRequest({ threadId: threads.body.threads[0].id });
    }

    test('Confirm we are able to attach, detach and attach to a running program', async function () {
        this.timeout(20000);
        // Lets skip this test on AppVeyor (very flaky on AppVeyor).
        if (IS_APPVEYOR) {
            return;
        }

        let debugClient = debugClient1 = await startDebugger();

        const port = await startRemoteProcess();
        await testAttaching(debugClient, port);
        await debugClient.disconnectRequest({});
        debugClient = await startDebugger();
        await testAttaching(debugClient, port);

        const terminatedPromise = debugClient.waitForEvent('terminated');
        procToKill.kill();
        await terminatedPromise;
    });

    test('Confirm we are unable to attach if already attached to a running program', async function () {
        this.timeout(200000);
        // Lets skip this test on AppVeyor (very flaky on AppVeyor).
        if (IS_APPVEYOR) {
            return;
        }

        debugClient1 = await startDebugger();

        const port = await startRemoteProcess();
        await testAttaching(debugClient1, port);

        debugClient2 = await startDebugger();
        // Send initialize, attach
        const initializePromise = debugClient2.initializeRequest({
            adapterID: 'pythonExperimental',
            linesStartAt1: true,
            columnsStartAt1: true,
            supportsRunInTerminalRequest: true,
            pathFormat: 'path',
            supportsVariableType: true,
            supportsVariablePaging: true
        });

        const attachMustFail = 'A debugger is already attached to this process';
        const attachPromise = debugClient2.attachRequest({
            localRoot: path.dirname(fileToDebug),
            remoteRoot: path.dirname(fileToDebug),
            type: 'pythonExperimental',
            port: port,
            host: 'localhost',
            logToFile: true,
            debugOptions: ['RedirectOutput']
        }).catch(() => Promise.resolve(attachMustFail));
        // tslint:disable-next-line:no-unused-variable
        const [_, attachResponse] = await Promise.all([initializePromise, attachPromise]);
        expect(attachResponse).to.be.equal(attachMustFail);
    });
});
