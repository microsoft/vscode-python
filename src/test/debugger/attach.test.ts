// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { ChildProcess } from 'child_process';
import * as getFreePort from 'get-port';
import { EOL } from 'os';
import * as path from 'path';
import { ThreadEvent } from 'vscode-debugadapter';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { createDeferred } from '../../client/common/helpers';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { AttachRequestArguments } from '../../client/debugger/Common/Contracts';
import { initialize } from '../initialize';

use(chaiAsPromised);

const fileToDebug = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger.py');
const ptvsdPath = path.join(__dirname, '..', '..', '..', 'pythonFiles', 'PythonTools');
const DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'Main.js');

// tslint:disable-next-line:max-func-body-length
suite('Attach Debugger', () => {
    let debugClient: DebugClient;
    let procToKill: ChildProcess;
    suiteSetup(function () {
        // tslint:disable-next-line:no-invalid-this
        this.skip();
        return initialize();
    });

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
        if (procToKill) {
            procToKill.kill();
        }
    });
    test('Confirm we are able to attach to a running program', async () => {
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

        const completed = createDeferred();
        const expectedOutputs = [
            { value: 'start', deferred: createDeferred() },
            { value: 'Peter Smith', deferred: createDeferred() },
            { value: 'end', deferred: createDeferred() }
        ];
        const startOutputReceived = expectedOutputs[0].deferred.promise;
        const firstOutputReceived = expectedOutputs[1].deferred.promise;
        const secondOutputReceived = expectedOutputs[2].deferred.promise;

        result.out.subscribe(output => {
            if (expectedOutputs[0].value === output.out) {
                expectedOutputs.shift()!.deferred.resolve();
            }
        }, ex => {
            completed.reject(ex);
        }, () => {
            completed.resolve();
        });

        await startOutputReceived;

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
        await debugClient.attachRequest(args);
        await initializePromise;

        // Wait till we get the thread of the program.
        const threadId = await threadIdPromise.promise;
        expect(threadId).to.be.greaterThan(0, 'ThreadId not received');

        // Continue the program.
        await debugClient.continueRequest({ threadId });

        // Value for input prompt.
        result.proc.stdin.write(`Peter Smith${EOL}`);
        await firstOutputReceived;

        result.proc.stdin.write(`${EOL}`);
        await secondOutputReceived;
        await completed.promise;

        await debugClient.waitForEvent('terminated');
    });
});
