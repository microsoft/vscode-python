// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { runTests } from 'vscode-test';
import { traceError, traceVerbose } from '../client/common/logger';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from './constants';

const workspacePath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc', 'multi.code-workspace');
process.env.IS_CI_SERVER_TEST_DEBUGGER = '1';
process.env.VSC_PYTHON_CI_TEST = '1';

function start() {
    traceVerbose('*'.repeat(100));
    traceVerbose('Start Debugger tests');
    runTests({
        extensionDevelopmentPath: EXTENSION_ROOT_DIR_FOR_TESTS,
        extensionTestsPath: path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'out', 'test', 'index'),
        launchArgs: [workspacePath],
        version: 'stable'
    }).catch(ex => {
        traceError('End Debugger tests (with errors)', ex);
        process.exit(1);
    });
}
start();
