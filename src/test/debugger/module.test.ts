// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any

import * as path from 'path';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/core.utils';
import { PTVSD_PATH } from '../../client/debugger/Common/constants';
import { DebugOptions, LaunchRequestArguments } from '../../client/debugger/Common/Contracts';
import { sleep } from '../common';
import { IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../initialize';
import { createDebugAdapter } from './utils';

const workspaceDirectory = path.join(EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5');
const debuggerType = 'pythonExperimental';
suite(`Module Debugging - Misc tests: ${debuggerType}`, () => {
    let debugClient: DebugClient;
    setup(async function () {
        if (!IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            this.skip();
        }
        const coverageDirectory = path.join(EXTENSION_ROOT_DIR, 'debug_coverage_module');
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
    function buildLauncArgs(): LaunchRequestArguments {
        const env = {};
        // tslint:disable-next-line:no-string-literal
        env['PYTHONPATH'] = `.${path.delimiter}${PTVSD_PATH}`;

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
            debugClient.assertOutput('stdout', 'Hello world!'),
            debugClient.waitForEvent('exited'),
            debugClient.waitForEvent('terminated')
        ]);
    });
});
