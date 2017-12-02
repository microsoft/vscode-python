import * as testRunner from 'vscode/lib/testrunner';
import { MochaSetupOptions } from 'vscode/lib/testrunner';
import { IS_MULTI_ROOT_TEST } from './initialize';
process.env.VSC_PYTHON_CI_TEST = '1';
process.env.IS_MULTI_ROOT_TEST = IS_MULTI_ROOT_TEST;

// You can directly control Mocha options by uncommenting the following lines.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info.
// Hack, as retries is not supported as setting in tsd.
// tslint:disable-next-line:no-any
const options: MochaSetupOptions & { [key: string]: any } = {
    ui: 'tdd',
    useColors: true,
    timeout: 25000,
    retries: 3,
    grep: 'Unit Tests - nose - discovery with mocked process output'
};
testRunner.configure(options);
module.exports = testRunner;
