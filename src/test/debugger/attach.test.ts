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
import { sleep } from '../common';

use(chaiAsPromised);

const fileToDebug = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger.py');
const ptvsdPath = path.join(__dirname, '..', '..', '..', 'pythonFiles', 'PythonTools');
const DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'Main.js');

// tslint:disable-next-line:max-func-body-length
suite('Attach Debugger', () => {
    let debugClient: DebugClient;
    let procToKill: ChildProcess;
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
            // tslint:disable-next-line:no-empty
            await debugClient.stop().catch(() => { });
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
        console.log('1');
        // Set the path for PTVSD to be picked up.
        // tslint:disable-next-line:no-string-literal
        customEnv['PYTHONPATH'] = ptvsdPath;
        const procService = new ProcessService(new BufferDecoder());
        const result = procService.execObservable('python', [fileToDebug, port.toString()], { env: customEnv, cwd: path.dirname(fileToDebug) });
        procToKill = result.proc;
        console.log('2');
        const completed = createDeferred();
        const expectedOutputs = [
            { value: 'start', deferred: createDeferred() },
            { value: 'attached', deferred: createDeferred() },
            { value: 'Peter Smith', deferred: createDeferred() },
            { value: 'end', deferred: createDeferred() }
        ];
        const startOutputReceived = expectedOutputs[0].deferred.promise;
        const firstOutputReceived = expectedOutputs[1].deferred.promise;
        const secondOutputReceived = expectedOutputs[2].deferred.promise;
        const thirdOutputReceived = expectedOutputs[2].deferred.promise;
        console.log('3');
        result.out.subscribe(output => {
            console.log('output:');
            console.log(output);
            if (expectedOutputs[0].value === output.out) {
                expectedOutputs.shift()!.deferred.resolve();
            }
        }, ex => {
            completed.reject(ex);
        }, () => {
            completed.resolve();
        });
        console.log('4');
        await startOutputReceived;
        console.log('5');
        const threadIdPromise = createDeferred<number>();
        console.log('6');
        debugClient.on('thread', (data: ThreadEvent) => {
            if (data.body.reason === 'started') {
                threadIdPromise.resolve(data.body.threadId);
            }
        });
        console.log('7');
        const initializePromise = debugClient.initializeRequest({
            adapterID: 'python',
            linesStartAt1: true,
            columnsStartAt1: true,
            supportsRunInTerminalRequest: true,
            pathFormat: 'path'
        });
        console.log('8');
        await debugClient.attachRequest(args);
        console.log('9');
        await initializePromise;
        console.log('10');
        // Wait till we get the thread of the program.
        const threadId = await threadIdPromise.promise;
        expect(threadId).to.be.greaterThan(0, 'ThreadId not received');
        await sleep(1000);
        console.log('11');
        await firstOutputReceived;
        // Continue the program.
        // await debugClient.continueRequest({ threadId });
        console.log('12');
        // Value for input prompt.
        result.proc.stdin.write(`Peter Smith${EOL}`);
        await secondOutputReceived;
        console.log('13');
        result.proc.stdin.write(`${EOL}`);
        await thirdOutputReceived;
        console.log('14');
        //await completed.promise;
        console.log('15');
        await debugClient.waitForEvent('terminated');
        console.log('16');
    });
});
