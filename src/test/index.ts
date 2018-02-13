// tslint:disable-next-line:no-any
if ((Reflect as any).metadata === undefined) {
    // tslint:disable-next-line:no-require-imports no-var-requires
    require('reflect-metadata');
}
import { workspace } from 'vscode';
import { MochaSetupOptions } from 'vscode/lib/testrunner';
import * as testRunner from './testRunner';

process.env.VSC_PYTHON_CI_TEST = '1';
process.env.IS_MULTI_ROOT_TEST = (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 1);

// You can directly control Mocha options by uncommenting the following lines.
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info.
// Hack, as retries is not supported as setting in tsd.
// tslint:disable-next-line:no-any
const options: MochaSetupOptions & { retries: number } = {
    ui: 'tdd',
    useColors: true,
    timeout: 25000,
    retries: 3
};
testRunner.configure(options, { coverageConfig: '../coverconfig.json' });
module.exports = testRunner;
