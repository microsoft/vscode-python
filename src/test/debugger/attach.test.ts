// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-invalid-this max-func-body-length no-empty no-increment-decrement

import { expect } from 'chai';
import { ChildProcess } from 'child_process';
import * as getFreePort from 'get-port';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { createDeferred } from '../../client/common/helpers';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { AttachRequestArguments } from '../../client/debugger/Common/Contracts';
import { sleep } from '../common';
import { initialize, IS_APPVEYOR, IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';

const fileToDebug = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger.py');
const ptvsdPath = path.join(__dirname, '..', '..', '..', 'pythonFiles', 'PythonTools');
const DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'Main.js');

suite('Attach Debugger', () => {
    let debugClient: DebugClient;
    let procToKill: ChildProcess;
    suiteSetup(initialize);

    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        await sleep(1000);
        debugClient = new DebugClient('node', DEBUG_ADAPTER, 'python');
        await debugClient.start();
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
    test('Confirm we are able to attach to a running program', async () => {
        // Lets skip this test on AppVeyor (very flaky on AppVeyor).
        if (IS_APPVEYOR) {
            return;
        }

        const port = await getFreePort({ host: 'localhost', port: 3000 });
        const args: AttachRequestArguments = {
            localRoot: path.dirname(fileToDebug),
            remoteRoot: path.dirname(fileToDebug),
            port: port,
            host: 'localhost',
            secret: 'super_secret'
        };

        const customEnv = { ...process.env };

        // Set the path for PTVSD to be picked up.
        // tslint:disable-next-line:no-string-literal
        customEnv['PYTHONPATH'] = ptvsdPath;
        const procService = new ProcessService(new BufferDecoder());
        const result = procService.execObservable('python', [fileToDebug, port.toString()], { env: customEnv, cwd: path.dirname(fileToDebug) });
        procToKill = result.proc;

        const expectedOutputs = [
            { value: 'start', deferred: createDeferred() },
            { value: 'attached', deferred: createDeferred() },
            { value: 'end', deferred: createDeferred() }
        ];
        const startOutputReceived = expectedOutputs[0].deferred.promise;
        const attachedOutputReceived = expectedOutputs[1].deferred.promise;
        const lastOutputReceived = expectedOutputs[2].deferred.promise;

        result.out.subscribe(output => {
            if (expectedOutputs[0].value === output.out) {
                expectedOutputs.shift()!.deferred.resolve();
            }
        });

        await startOutputReceived;

        const initializePromise = debugClient.initializeRequest({
            adapterID: 'python',
            linesStartAt1: true,
            columnsStartAt1: true,
            supportsRunInTerminalRequest: true,
            pathFormat: 'path'
        });
        await debugClient.attachRequest(args);
        await initializePromise;

        // Wait till we attach.
        await attachedOutputReceived;

        // Add a breakpoint.
        const breakpointLocation = { path: fileToDebug, column: 0, line: 16 };
        await debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });

        await debugClient.assertStoppedLocation('breakpoint', breakpointLocation);

        // Get thread to continue.
        const threads = await debugClient.threadsRequest();
        expect(threads).to.be.not.equal(undefined, 'no threads response');
        expect(threads.body.threads).to.be.lengthOf(1);

        // Continue the program.
        await debugClient.continueRequest({ threadId: threads.body.threads[0].id });

        await lastOutputReceived;
        await debugClient.waitForEvent('terminated');
    });
});
