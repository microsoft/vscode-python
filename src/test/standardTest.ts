// tslint:disable:no-console

import * as path from 'path';
import { runTests } from 'vscode-test';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from './constants';

process.env.IS_CI_SERVER_TEST_DEBUGGER = '';
process.env.VSC_PYTHON_CI_TEST = '1';
const workspacePath = process.env.CODE_TESTS_WORKSPACE
    ? process.env.CODE_TESTS_WORKSPACE
    : path.join(__dirname, '..', '..', 'src', 'test');
const extensionDevelopmentPath = process.env.CODE_EXTENSIONS_PATH
    ? process.env.CODE_EXTENSIONS_PATH
    : EXTENSION_ROOT_DIR_FOR_TESTS;

// Temporarily use VSCode insiders, when running Notebook tests.
const channel = (process.env.VSC_PYTHON_CI_TEST_VSC_CHANNEL || '').toLowerCase().includes('insiders')
    ? 'insiders'
    : 'stable';
if (channel === 'insiders') {
    // Run only a subset of tests, those with the word insiders in it.
    process.env.VSC_PYTHON_CI_TEST_GREP = 'Insiders';
}

function start() {
    console.log('*'.repeat(100));
    console.log('Start Standard tests');
    runTests({
        extensionDevelopmentPath: extensionDevelopmentPath,
        extensionTestsPath: path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'out', 'test', 'index'),
        launchArgs: [workspacePath].concat(channel === 'insiders' ? ['--enable-proposed-api'] : []),
        version: channel,
        extensionTestsEnv: { ...process.env, UITEST_DISABLE_INSIDERS: '1' }
    }).catch((ex) => {
        console.error('End Standard tests (with errors)', ex);
        process.exit(1);
    });
}
start();
