// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/core.utils';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { DebuggerTypeName, PTVSD_PATH } from '../../client/debugger/Common/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';
import { DebugClientEx } from './debugClient';

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const EXPERIMENTAL_DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'mainV2.js');

let testCounter = 0;
const testAdapterFilePath = EXPERIMENTAL_DEBUG_ADAPTER;
const debuggerType = DebuggerTypeName;
suite(`Standard Debugging - Misc tests: ${debuggerType}`, () => {

    let debugClient: DebugClient;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        debugClient = createDebugAdapter();
        debugClient.defaultTimeout = DEBUGGER_TIMEOUT;
        await debugClient.start();
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
    /**
     * Creates the debug adapter.
     * We do not need to support code coverage on AppVeyor, lets use the standard test adapter.
     * @returns {DebugClient}
     */
    function createDebugAdapter(): DebugClient {
        if (IS_WINDOWS) {
            return new DebugClient('node', testAdapterFilePath, debuggerType);
        } else {
            const coverageDirectory = path.join(EXTENSION_ROOT_DIR, `debug_coverage${testCounter += 1}`);
            return new DebugClientEx(testAdapterFilePath, debuggerType, coverageDirectory, { cwd: EXTENSION_ROOT_DIR });
        }
    }
    function buildLaunchArgs(pythonFile: string, stopOnEntry: boolean = false): LaunchRequestArguments {
        const env = { PYTHONPATH: PTVSD_PATH };
        // tslint:disable-next-line:no-unnecessary-local-variable
        const options: LaunchRequestArguments = {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            debugOptions: [DebugOptions.RedirectOutput],
            pythonPath: PYTHON_PATH,
            args: [],
            env,
            envFile: '',
            logToFile: false,
            type: debuggerType
        };

        return options;
    }

    test('Should run program to the end', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('simplePrint.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('test stderr output for Python', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('stdErrOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            //TODO: ptvsd does not differentiate.
            debugClient.assertOutput('stderr', 'error output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    test('Test stdout output', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('stdOutOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.assertOutput('stdout', 'normal output'),
            debugClient.waitForEvent('terminated')
        ]);
    });
});
