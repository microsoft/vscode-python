// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as fs from 'fs-extra';
import { runTests } from '@vscode/test-electron';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from './constants';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';

const workspacePath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc', 'multi.code-workspace');
process.env.IS_CI_SERVER_TEST_DEBUGGER = '1';
process.env.VSC_PYTHON_CI_TEST = '1';

function getChannel(): string {
    if (process.env.VSC_PYTHON_CI_TEST_VSC_CHANNEL) {
        return process.env.VSC_PYTHON_CI_TEST_VSC_CHANNEL;
    }

    const packageJsonPath = path.join(EXTENSION_ROOT_DIR, 'package.json');
    if (fs.pathExistsSync(packageJsonPath)) {
        const packageJson = fs.readJSONSync(packageJsonPath);
        if (packageJson.engines.vscode.endsWith('insider')) {
            return 'insiders';
        }
    }
    return 'stable';
}

function start() {
    console.log('*'.repeat(100));
    console.log('Start Debugger tests');
    runTests({
        extensionDevelopmentPath: EXTENSION_ROOT_DIR_FOR_TESTS,
        extensionTestsPath: path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'out', 'test', 'index'),
        launchArgs: [workspacePath],
        version: getChannel(),
        extensionTestsEnv: { ...process.env, UITEST_DISABLE_INSIDERS: '1' },
    }).catch((ex) => {
        console.error('End Debugger tests (with errors)', ex);
        process.exit(1);
    });
}
start();
