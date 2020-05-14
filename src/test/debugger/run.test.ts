// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this no-require-imports no-require-imports no-var-requires

import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { noop } from '../../client/common/utils/misc';
import { DebuggerTypeName } from '../../client/debugger/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/types';
import { PYTHON_PATH, sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { createDebugAdapter } from './utils';

const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');
const debuggerType = DebuggerTypeName;
suite('Run without Debugging', () => {
    let debugClient: DebugClient;
    setup(async function () {
        // https://github.com/microsoft/vscode-python/issues/11704
        return this.skip();
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        debugClient = await createDebugAdapter();
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
    function buildLaunchArgs(
        pythonFile: string,
        stopOnEntry: boolean = false,
        showReturnValue: boolean = true
    ): LaunchRequestArguments {
        // tslint:disable-next-line:no-unnecessary-local-variable
        return {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            showReturnValue,
            noDebug: true,
            debugOptions: [DebugOptions.RedirectOutput],
            pythonPath: PYTHON_PATH,
            args: [],
            env: {},
            envFile: '',
            logToFile: false,
            type: debuggerType,
            name: '',
            request: 'launch'
        };
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
