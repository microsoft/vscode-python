import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { SystemVariables } from '../../client/common/variables/systemVariables';
import { initialize, IS_MULTI_ROOT_TEST } from './../initialize';

const workspaceRoot = path.join(__dirname, '..', '..', '..', 'src', 'test');

// Defines a Mocha test suite to group tests of similar kind together
suite('Configuration Settings', () => {
    setup(initialize);

    if (!IS_MULTI_ROOT_TEST) {
        test('Check Values', done => {
            const systemVariables: SystemVariables = new SystemVariables(workspaceRoot);
            const pythonConfig = vscode.workspace.getConfiguration('python');
            const pythonSettings = PythonSettings.getInstance(vscode.Uri.file(workspaceRoot));
            Object.keys(pythonSettings).forEach(key => {
                let settingValue = pythonConfig.get(key, 'Not a config');
                if (settingValue === 'Not a config') {
                    return;
                }
                if (settingValue) {
                    settingValue = systemVariables.resolve(settingValue);
                }
                // tslint:disable-next-line:no-any
                assert.deepEqual(settingValue, (pythonSettings as any)[key], `Setting ${key} not the same`);
            });

            done();
        });
    }
});
