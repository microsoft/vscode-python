// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { ExecutionResult, ShellOptions } from '../../../../../client/common/process/types';
import * as externalDependencies from '../../../../../client/pythonEnvironments/common/externalDependencies';
import { isPoetryEnvironment } from '../../../../../client/pythonEnvironments/discovery/locators/services/poetry';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';

suite('isPoetryEnvironment Tests', () => {
    let shellExecute: sinon.SinonStub;
    let getPythonSetting: sinon.SinonStub;
    const testPoetryDir = path.join(TEST_LAYOUT_ROOT, 'poetry');
    const project1 = path.join(testPoetryDir, 'project1');
    const project2 = path.join(testPoetryDir, 'project2');

    suite('Global poetry environment', async () => {
        test('Return true if environment folder name matches global env pattern and environment is of virtual env type', async () => {
            const result = await isPoetryEnvironment(
                path.join(testPoetryDir, 'poetry-tutorial-project-6hnqYwvD-py3.8', 'Scripts', 'python.exe'),
            );
            expect(result).to.equal(true);
        });

        test('Return false if environment folder name does not matches env pattern', async () => {
            const result = await isPoetryEnvironment(
                path.join(testPoetryDir, 'wannabeglobalenv', 'Scripts', 'python.exe'),
            );
            expect(result).to.equal(false);
        });

        test('Return false if environment folder name matches env pattern but is not of virtual env type', async () => {
            const result = await isPoetryEnvironment(
                path.join(testPoetryDir, 'project1-haha-py3.8', 'Scripts', 'python.exe'),
            );
            expect(result).to.equal(false);
        });
    });

    suite('Local poetry environment', async () => {
        setup(() => {
            shellExecute = sinon.stub(externalDependencies, 'shellExecute');
            getPythonSetting = sinon.stub(externalDependencies, 'getPythonSetting');
            getPythonSetting.returns('poetry');
            shellExecute.callsFake((command: string, options: ShellOptions) => {
                // eslint-disable-next-line default-case
                switch (command) {
                    case 'poetry --version':
                        return Promise.resolve<ExecutionResult<string>>({ stdout: '' });
                    case 'poetry env info -p':
                        if (options.cwd === project1) {
                            return Promise.resolve<ExecutionResult<string>>({
                                stdout: `${path.join(project1, '.venv')} \n`,
                            });
                        }
                }
                return Promise.reject(new Error('Command failed'));
            });
        });

        teardown(() => {
            sinon.restore();
        });

        test('Return true if environment folder name matches criteria for local envs', async () => {
            const result = await isPoetryEnvironment(path.join(project1, '.venv', 'Scripts', 'python.exe'));
            expect(result).to.equal(true);
        });

        test(`Return false if environment folder name is not named '.venv' for local envs`, async () => {
            const result = await isPoetryEnvironment(path.join(project1, '.venv2', 'Scripts', 'python.exe'));
            expect(result).to.equal(false);
        });

        test(`Return false if running poetry for project dir as cwd fails`, async () => {
            const result = await isPoetryEnvironment(path.join(project2, '.venv', 'Scripts', 'python.exe'));
            expect(result).to.equal(false);
        });
    });
});
