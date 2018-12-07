// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

//
// Constants that pertain to CI processes/tests only. No dependencies on vscode!
//
export const ENV_PATHS_LOCATION = process.env.ENV_PATHS_LOCATION;
export const IS_APPVEYOR = process.env.APPVEYOR === 'true';
export const IS_TRAVIS = process.env.TRAVIS === 'true';
export const IS_VSTS = process.env.TF_BUILD !== undefined;
export const IS_CI_SERVER = IS_TRAVIS || IS_APPVEYOR || IS_VSTS;

// Control JUnit-style output logging for reporting purposes.
let reportJunit: boolean = false;
if (IS_CI_SERVER && process.env.MOCHA_REPORTER_JUNIT !== undefined) {
    reportJunit = process.env.MOCHA_REPORTER_JUNIT.toLowerCase() === 'true';
}
export const MOCHA_REPORTER_JUNIT: boolean = reportJunit;
export const MOCHA_CI_REPORTFILE: string = MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_REPORTFILE !== undefined ?
                                            process.env.MOCHA_CI_REPORTFILE : './junit-out.xml';
export const MOCHA_CI_PROPERTIES: string = MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_PROPERTIES !== undefined ?
                                            process.env.MOCHA_CI_PROPERTIES : '';
export const MOCHA_CI_REPORTER_ID: string = MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_REPORTER_ID !== undefined ?
                                            process.env.MOCHA_CI_REPORTER_ID : 'mocha-junit-reporter';
export const IS_CI_SERVER_TEST_DEBUGGER = process.env.IS_CI_SERVER_TEST_DEBUGGER === '1';
