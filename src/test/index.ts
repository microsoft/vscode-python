// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import {
    IS_CI_SERVER_TEST_DEBUGGER,
    MOCHA_CI_PROPERTIES, MOCHA_CI_REPORTER_ID,
    MOCHA_CI_REPORTFILE, MOCHA_REPORTER_JUNIT
} from './ciConstants';
import { IS_MULTI_ROOT_TEST } from './constants';
import * as testRunner from './testRunner';

process.env.VSC_PYTHON_CI_TEST = '1';
process.env.IS_MULTI_ROOT_TEST = IS_MULTI_ROOT_TEST.toString();

// Check for a grep setting. Might be running a subset of the tests
const defaultGrep = process.env.VSC_PYTHON_CI_TEST_GREP;

// If running on CI server and we're running the debugger tests, then ensure we only run debug tests.
// We do this to ensure we only run debugger test, as debugger tests are very flaky on CI.
// So the solution is to run them separately and first on CI.
const grep = IS_CI_SERVER_TEST_DEBUGGER ? 'Debug' : defaultGrep;
const testFilesSuffix = process.env.TEST_FILES_SUFFIX;

// You can directly control Mocha options by uncommenting the following lines.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info.
// Hack, as retries is not supported as setting in tsd.
const options: testRunner.SetupOptions & { retries: number } = {
    ui: 'tdd',
    useColors: true,
    timeout: 25000,
    retries: 3,
    grep,
    testFilesSuffix
};

// CI can ask for a JUnit reporter if the environment variable
// 'MOCHA_REPORTER_JUNIT' is defined, further control is afforded
// by other 'MOCHA_CI_...' variables. See constants.ts for info.
if (MOCHA_REPORTER_JUNIT) {
    options.reporter = MOCHA_CI_REPORTER_ID;
    options.reporterOptions = {
        mochaFile: MOCHA_CI_REPORTFILE,
        properties: MOCHA_CI_PROPERTIES
    };
}

process.on('unhandledRejection', (ex: string | Error, a) => {
    const message = [`${ex}`];
    if (typeof ex !== 'string' && ex && ex.message) {
        message.push(ex.name);
        message.push(ex.message);
        if (ex.stack) {
            message.push(ex.stack);
        }
    }
    console.error(`Unhandled Promise Rejection with the message ${message.join(', ')}`);
});

testRunner.configure(options, { coverageConfig: '../coverconfig.json' });
module.exports = testRunner;
