// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}

import { IS_CI_SERVER, IS_CI_SERVER_TEST_DEBUGGER,
         IS_MULTI_ROOT_TEST, IS_VSTS } from './constants';
import * as testRunner from './testRunner';

process.env.VSC_PYTHON_CI_TEST = '1';
process.env.IS_MULTI_ROOT_TEST = IS_MULTI_ROOT_TEST.toString();

// If running on CI server and we're running the debugger tests, then ensure we only run debug tests.
// We do this to ensure we only run debugger test, as debugger tests are very flaky on CI.
// So the solution is to run them separately and first on CI.
const grep = IS_CI_SERVER && IS_CI_SERVER_TEST_DEBUGGER ? 'Debug' : undefined;
const testFilesSuffix = process.env.TEST_FILES_SUFFIX;

// You can directly control Mocha options by uncommenting the following lines.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info.
// Hack, as retries is not supported as setting in tsd.
const options: testRunner.SetupOptions & { retries: number } = {
    ui: 'tdd',
    useColors: !IS_VSTS,
    timeout: 25000,
    retries: 3,
    grep,
    testFilesSuffix
};
testRunner.configure(options, { coverageConfig: '../coverconfig.json' });
module.exports = testRunner;
