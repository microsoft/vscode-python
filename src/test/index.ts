// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires no-any
// Always place at the top, to ensure other modules are imported first.
require('./common/exitCIAfterTestReporter');

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';
import { traceError } from '../client/common/logger';
import { IS_CI_SERVER_TEST_DEBUGGER, MOCHA_REPORTER_JUNIT } from './ciConstants';
import { IS_MULTI_ROOT_TEST, IS_SMOKE_TEST, MAX_EXTENSION_ACTIVATION_TIME, TEST_RETRYCOUNT, TEST_TIMEOUT } from './constants';
import { initialize } from './initialize';

type SetupOptions = Mocha.MochaOptions & {
    testFilesSuffix: string;
    reporterOptions?: {
        mochaFile?: string;
        properties?: string;
    };
    exit: boolean;
};

process.on('unhandledRejection', (ex: string | Error, _a) => {
    const message = [`${ex}`];
    if (typeof ex !== 'string' && ex && ex.message) {
        message.push(ex.name);
        message.push(ex.message);
        if (ex.stack) {
            message.push(ex.stack);
        }
    }
    traceError(`Unhandled Promise Rejection with the message ${message.join(', ')}`);
});

/**
 * Configure the test environment and return the optoins required to run moch tests.
 *
 * @returns {SetupOptions}
 */
function configure(): SetupOptions {
    process.env.VSC_PYTHON_CI_TEST = '1';
    process.env.IS_MULTI_ROOT_TEST = IS_MULTI_ROOT_TEST.toString();

    // Check for a grep setting. Might be running a subset of the tests
    const defaultGrep = process.env.VSC_PYTHON_CI_TEST_GREP;

    // If running on CI server and we're running the debugger tests, then ensure we only run debug tests.
    // We do this to ensure we only run debugger test, as debugger tests are very flaky on CI.
    // So the solution is to run them separately and first on CI.
    const grep = IS_CI_SERVER_TEST_DEBUGGER ? 'Debug' : defaultGrep;
    const testFilesSuffix = process.env.TEST_FILES_SUFFIX || 'test';

    const options: SetupOptions & { retries: number } = {
        ui: 'tdd',
        useColors: true,
        timeout: TEST_TIMEOUT,
        retries: TEST_RETRYCOUNT,
        grep,
        testFilesSuffix,
        // Force Mocha to exit after tests.
        // It has been observed that this isn't sufficient, hence the reason for src/test/common/exitCIAfterTestReporter.ts
        exit: true
    };

    // If the `MOCHA_REPORTER_JUNIT` env var is true, set up the CI reporter for
    // reporting to both the console (spec) and to a JUnit XML file. The xml file
    // written to is `test-report.xml` in the root folder by default, but can be
    // changed by setting env var `MOCHA_FILE` (we do this in our CI).
    if (MOCHA_REPORTER_JUNIT) {
        options.reporter = 'mocha-multi-reporters';
        const reporterPath = path.join(__dirname, 'common', 'exitCIAfterTestReporter.js');
        options.reporterOptions = {
            reporterEnabled: `spec,mocha-junit-reporter,${reporterPath}`
        };
    }

    // Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY.
    // Since we are not running in a tty environment, we just implement the method statically.
    const tty = require('tty');
    if (!tty.getWindowSize) {
        tty.getWindowSize = () => [80, 75];
    }

    return options;
}

/**
 * Waits until the Python Extension completes loading or a timeout.
 * When running tests within VSC, we need to wait for the Python Extension to complete loading,
 * this is where `initialize` comes in, we load the PVSC extension using VSC API, wait for it
 * to complete.
 * That's when we know out PVSC extension specific code is ready for testing.
 * So, this code needs to run always for every test running in VS Code (what we call these `system test`) .
 * @returns
 */
function activatePythonExtensionScript() {
    const ex = new Error('Failed to initialize Python extension for tests after 2 minutes');
    let timer: NodeJS.Timer | undefined;
    const failed = new Promise((_, reject) => {
        timer = setTimeout(() => reject(ex), MAX_EXTENSION_ACTIVATION_TIME);
    });
    const promise = Promise.race([initialize(), failed]);
    promise.then(() => clearTimeout(timer!)).catch(() => clearTimeout(timer!));
    return promise;
}

/**
 * Runner, invoked by VS Code.
 * More info https://code.visualstudio.com/api/working-with-extensions/testing-extension
 *
 * @export
 * @returns {Promise<void>}
 */
export async function run(): Promise<void> {
    const options = configure();
    const mocha = new Mocha(options);
    const testsRoot = path.join(__dirname);

    // Enable source map support.
    require('source-map-support').install();

    // nteract/transforms-full expects to run in the browser so we have to fake
    // parts of the browser here.
    if (!IS_SMOKE_TEST) {
        const reactHelpers = require('./datascience/reactHelpers') as typeof import('./datascience/reactHelpers');
        reactHelpers.setUpDomEnvironment();
    }

    const testFiles = await new Promise<string[]>((resolve, reject) => {
        glob(`**/**.${options.testFilesSuffix}.js`, { ignore: ['**/**.unit.test.js', '**/**.functional.test.js'], cwd: testsRoot }, (error, files) => {
            if (error) {
                return reject(error);
            }
            resolve(files);
        });
    });

    // Setup test files that need to be run.
    testFiles.forEach(file => mocha.addFile(path.join(testsRoot, file)));

    await activatePythonExtensionScript();

    // Run the tests.
    await new Promise<void>((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                return reject(new Error(`${failures} total failures`));
            }
            resolve();
        });
    });
}
