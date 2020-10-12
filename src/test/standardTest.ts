// tslint:disable:no-console

import * as path from 'path';
import { runTests } from 'vscode-test';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from './constants';

// If running smoke tests, we don't have access to this.
if (process.env.TEST_FILES_SUFFIX !== 'smoke.test') {
    // tslint:disable-next-line: no-var-requires no-require-imports
    const logger = require('./testLogger');
    logger.initializeLogger();
}

process.env.IS_CI_SERVER_TEST_DEBUGGER = '';
process.env.VSC_PYTHON_CI_TEST = '1';
const workspacePath = process.env.CODE_TESTS_WORKSPACE
    ? process.env.CODE_TESTS_WORKSPACE
    : path.join(__dirname, '..', '..', 'src', 'test');
const extensionDevelopmentPath = process.env.CODE_EXTENSIONS_PATH
    ? process.env.CODE_EXTENSIONS_PATH
    : EXTENSION_ROOT_DIR_FOR_TESTS;

const channel = process.env.VSC_PYTHON_CI_TEST_VSC_CHANNEL || 'stable';

function start() {
    console.log('*'.repeat(100));
    console.log('Start Standard tests');
    runTests({
        extensionDevelopmentPath: extensionDevelopmentPath,
        extensionTestsPath: path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'out', 'test', 'index'),
        launchArgs: ['--disable-extensions', workspacePath]
            .concat(channel === 'insiders' ? ['--enable-proposed-api'] : [])
            .concat(['--timeout', '5000']),
        version: channel,
        extensionTestsEnv: { ...process.env, UITEST_DISABLE_INSIDERS: '1' }
    }).catch((ex) => {
        console.error('End Standard tests (with errors)', ex);
        process.exit(1);
    });
}
start();
