// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { noop } from '../../client/common/utils/misc';
import { DebuggerTypeName, PTVSD_PATH } from '../../client/debugger/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/types';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');

const EXPERIMENTAL_DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'debugAdapter', 'main.js');

const testAdapterFilePath = EXPERIMENTAL_DEBUG_ADAPTER;
const debuggerType = DebuggerTypeName;
suite(`Standard Debugging - Misc tests: ${debuggerType}`, () => {
    let debugClient: DebugClient;
    // All tests in this suite are failed
    // Check https://github.com/Microsoft/vscode-python/issues/4067
    setup(async function() {
        return this.skip();

        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
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
        } catch (ex) {}
        await sleep(1000);
    });
    /**
     * Creates the debug adapter.
     * @returns {DebugClient}
     */
    function createDebugAdapter(): DebugClient {
        return new DebugClient(process.env.NODE_PATH || 'node', testAdapterFilePath, debuggerType);
    }
    function buildLaunchArgs(pythonFile: string, stopOnEntry: boolean = false, showReturnValue: boolean = true): LaunchRequestArguments {
        const env = { PYTHONPATH: PTVSD_PATH };
        // tslint:disable-next-line:no-unnecessary-local-variable
        const options = ({
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            showReturnValue,
            debugOptions: [DebugOptions.RedirectOutput],
            pythonPath: PYTHON_PATH,
            args: [],
            env,
            envFile: '',
            logToFile: false,
            type: debuggerType
        } as any) as LaunchRequestArguments;

        return options;
    }

    // Check https://github.com/Microsoft/vscode-python/issues/4067
    test('Should run program to the end', async function() {
        return this.skip();
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('simplePrint.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('terminated')
        ]);
    });
    // Check https://github.com/Microsoft/vscode-python/issues/4067
    test('test stderr output for Python', async function() {
        return this.skip();
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
