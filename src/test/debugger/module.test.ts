// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/core.utils';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { DEBUGGER_TIMEOUT } from './common/constants';
import { DebugClientEx } from './debugClient';

const testAdapterFilePath = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'mainV2.js');
const workspaceDirectory = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5');
let testCounter = 0;
const debuggerType = 'pythonExperimental';
suite(`Module Debugging - Misc tests: ${debuggerType}`, () => {
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
    function buildLauncArgs(): LaunchRequestArguments {
        const env = {};
        // tslint:disable-next-line:no-string-literal
        env['PYTHONPATH'] = `.${path.delimiter}${path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd')}`;

        // tslint:disable-next-line:no-unnecessary-local-variable
        const options: LaunchRequestArguments = {
            module: 'mymod',
            program: '',
            cwd: workspaceDirectory,
            debugOptions: [DebugOptions.RedirectOutput],
            pythonPath: 'python',
            args: [],
            env,
            envFile: '',
            logToFile: false,
            type: debuggerType
        };

        return options;
    }

    test('Test stdout output', async () => {
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLauncArgs()),
            debugClient.waitForEvent('initialized'),
            debugClient.assertOutput('stdout', 'hello world'),
            debugClient.waitForEvent('exited'),
            debugClient.waitForEvent('terminated')
        ]);
    });
});
