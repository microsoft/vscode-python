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
    let debugClient: DebugClient;
    let procToKill: ChildProcess;
    suiteSetup(initialize);

    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        await startDebugger();
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await sleep(1000);
        try {
            await debugClient.stop().catch(() => { });
        } catch (ex) { }
        if (procToKill) {
            try {
                procToKill.kill();
            } catch { }
        }
    });
    async function startDebugger() {
        await sleep(1000);
        debugClient = createDebugAdapter();
        debugClient.defaultTimeout = DEBUGGER_TIMEOUT;
        await debugClient.start();
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

    async function waitForDebuggerCondfigurationDone(port: number) {
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
    async function testAttaching(port: number) {
        await waitForDebuggerCondfigurationDone(port);
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

        const port = await startRemoteProcess();
        await testAttaching(port);
        await debugClient.disconnectRequest({});
        await startDebugger();
        await testAttaching(port);

        const terminatedPromise = debugClient.waitForEvent('terminated');
        procToKill.kill();
        await terminatedPromise;
    });
});
