// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this max-func-body-length no-empty no-increment-decrement

import { ChildProcess, spawn } from 'child_process';
import * as getFreePort from 'get-port';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import '../../client/common/extensions';
import { DebugOptions } from '../../client/debugger/Common/Contracts';
import { sleep } from '../common';
import { initialize, IS_APPVEYOR, IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { continueDebugging, createDebugAdapter } from './utils';

const fileToDebug = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd.py');
const ptvsdPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd');

suite('Attach Debugger - Experimental', () => {
    let debugClient: DebugClient;
    let procToKill: ChildProcess;
    suiteSetup(initialize);

    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        const coverageDirectory = path.join(EXTENSION_ROOT_DIR, 'debug_coverage_attach_ptvsd');
        debugClient = await createDebugAdapter(coverageDirectory);
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
    test('Confirm we are able to attach to a running program', async function () {
        this.timeout(20000);
        // Lets skip this test on AppVeyor (very flaky on AppVeyor).
        if (IS_APPVEYOR) {
            return;
        }

        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const customEnv = { ...process.env };

        // Set the path for PTVSD to be picked up.
        // tslint:disable-next-line:no-string-literal
        customEnv['PYTHONPATH'] = ptvsdPath;
        const pythonArgs = ['-m', 'ptvsd', '--server', '--port', `${port}`, '--file', fileToDebug.fileToCommandArgument()];
        procToKill = spawn('python', pythonArgs, { env: customEnv, cwd: path.dirname(fileToDebug) });

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
            debugOptions: [DebugOptions.RedirectOutput]
        });

        await Promise.all([
            initializePromise,
            attachPromise,
            debugClient.waitForEvent('initialized')
        ]);

        await debugClient.configurationDoneRequest();

        const stdOutPromise = debugClient.assertOutput('stdout', 'this is stdout');
        const stdErrPromise = debugClient.assertOutput('stderr', 'this is stderr');

        const breakpointLocation = { path: fileToDebug, column: 1, line: 12 };
        const breakpointPromise = debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });
        const exceptionBreakpointPromise = debugClient.setExceptionBreakpointsRequest({ filters: [] });
        await Promise.all([
            breakpointPromise,
            exceptionBreakpointPromise,
            stdOutPromise, stdErrPromise
        ]);

        await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

        await Promise.all([
            continueDebugging(debugClient),
            debugClient.assertOutput('stdout', 'this is print'),
            debugClient.waitForEvent('exited'),
            debugClient.waitForEvent('terminated')
        ]);
    });
});
