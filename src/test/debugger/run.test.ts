// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this no-require-imports no-require-imports no-var-requires

import { expect } from 'chai';
import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/core.utils';
import { DebuggerTypeName, PTVSD_PATH } from '../../client/debugger/Common/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { createDebugAdapter } from './utils';

const isProcessRunning = require('is-running') as (number) => boolean;

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');
const debuggerType = DebuggerTypeName;
suite('Run without Debugging', () => {
    let debugClient: DebugClient;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        const coverageDirectory = path.join(EXTENSION_ROOT_DIR, `debug_coverage_nodebug${this.currentTest.title}`);
        debugClient = await createDebugAdapter(coverageDirectory);
    });
    teardown(async () => {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        await sleep(1000);
        try {
            await debugClient.stop().catch(noop);
            // tslint:disable-next-line:no-empty
        } catch (ex) { }
        await sleep(1000);
    });
    function buildLauncArgs(pythonFile: string, stopOnEntry: boolean = false): LaunchRequestArguments {
        // tslint:disable-next-line:no-unnecessary-local-variable
        const options: LaunchRequestArguments = {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            noDebug: true,
            debugOptions: [DebugOptions.RedirectOutput],
            pythonPath: PYTHON_PATH,
            args: [],
            env: { PYTHONPATH: PTVSD_PATH },
            envFile: '',
            logToFile: false,
            type: debuggerType
        };

        return options;
    }

    test('Should run program to the end', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('simplePrint.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('test stderr output for Python', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('stdErrOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.assertOutput('stderr', 'error output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Test stdout output', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('stdOutOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.assertOutput('stdout', 'normal output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Should kill python process when ending debug session', async function () {
        return this.skip();
        const processIdOutput = new Promise<number>(resolve => {
            debugClient.on('output', (event: DebugProtocol.OutputEvent) => {
                if (event.event === 'output' && event.body.category === 'stdout') {
                    resolve(parseInt(event.body.output.trim(), 10));
                }
            });
        });
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs('sampleWithSleep.py', false)),
            debugClient.waitForEvent('initialized'),
            processIdOutput
        ]);

        const processId = await processIdOutput;
        expect(processId).to.be.greaterThan(0, 'Invalid process id');

        await debugClient.stop();
        await sleep(1000);

        // Confirm the process is dead
        expect(isProcessRunning(processId)).to.be.equal(false, 'Python program is still alive');
    });
});
