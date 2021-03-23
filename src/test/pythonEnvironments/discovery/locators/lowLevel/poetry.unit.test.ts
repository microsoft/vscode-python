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
    const localProject = path.join(testPoetryDir, 'project1');

    setup(() => {
        shellExecute = sinon.stub(externalDependencies, 'shellExecute');
        getPythonSetting = sinon.stub(externalDependencies, 'getPythonSetting');
        getPythonSetting.returns('poetry');
    });

    teardown(() => {
        sinon.restore();
    });

    test('Return true if environment folder name matches global env pattern and environment is of virtual env type', async () => {
        const result = await isPoetryEnvironment(
            path.join(testPoetryDir, 'poetry-tutorial-project-6hnqYwvD-py3.8', 'Scripts', 'python.exe'),
        );
        expect(result).to.equal(true);
    });

    test('Return false if environment folder name does not matches env pattern', async () => {
        const result = await isPoetryEnvironment(path.join(testPoetryDir, 'wannabeglobalenv', 'Scripts', 'python.exe'));
        expect(result).to.equal(false);
    });

    test('Return false if environment folder name matches env pattern but is not of virtual env type', async () => {
        const result = await isPoetryEnvironment(
            path.join(testPoetryDir, 'project1-haha-py3.8', 'Scripts', 'python.exe'),
        );
        expect(result).to.equal(false);
    });

    test('Return true if environment folder name matches criteria for local envs', async () => {
        shellExecute.callsFake((command: string, options: ShellOptions) => {
            // eslint-disable-next-line default-case
            switch (command) {
                case 'poetry --version':
                    return Promise.resolve<ExecutionResult<string>>({ stdout: '' });
                case 'poetry env info -p':
                    if (options.cwd === localProject) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(localProject, '.venv')} \n`,
                        });
                    }
            }
            return Promise.reject(new Error('Command failed'));
        });
        const result = await isPoetryEnvironment(path.join(localProject, '.venv', 'Scripts', 'python.exe'));
        expect(result).to.equal(true);
    });

    test(`Return false if environment folder name is not named '.venv' for local envs`, async () => {
        shellExecute.callsFake((command: string, options: ShellOptions) => {
            // eslint-disable-next-line default-case
            switch (command) {
                case 'poetry --version':
                    return Promise.resolve<ExecutionResult<string>>({ stdout: '' });
                case 'poetry env info -p':
                    if (options.cwd === localProject) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(localProject, '.venv2')} \n`,
                        });
                    }
            }
            return Promise.reject(new Error('Command failed'));
        });
        const result = await isPoetryEnvironment(path.join(localProject, '.venv2', 'Scripts', 'python.exe'));
        expect(result).to.equal(false);
    });
});
