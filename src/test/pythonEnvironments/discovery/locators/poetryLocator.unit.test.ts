// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import * as platformUtils from '../../../../client/common/utils/platform';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PoetryLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/poetryLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertBasicEnvsEqual } from './envTestUtils';
import { ExecutionResult, ShellOptions } from '../../../../client/common/process/types';
import { Poetry } from '../../../../client/pythonEnvironments/discovery/locators/services/poetry';
import { createBasicEnv } from '../../base/common';

suite('Poetry Locator', () => {
    let shellExecute: sinon.SinonStub;
    let getPythonSetting: sinon.SinonStub;
    let getOSTypeStub: sinon.SinonStub;
    const testPoetryDir = path.join(TEST_LAYOUT_ROOT, 'poetry');
    let locator: PoetryLocator;

    suiteTeardown(() => {
        Poetry._poetryPromise = new Map();
    });

    suiteSetup(() => {
        getPythonSetting = sinon.stub(externalDependencies, 'getPythonSetting');
        getPythonSetting.returns('poetry');
        getOSTypeStub = sinon.stub(platformUtils, 'getOSType');
        shellExecute = sinon.stub(externalDependencies, 'shellExecute');
    });

    suiteTeardown(() => sinon.restore());

    suite('Windows', () => {
        const project1 = path.join(testPoetryDir, 'project1');
        setup(() => {
            locator = new PoetryLocator(project1);
            getOSTypeStub.returns(platformUtils.OSType.Windows);
            shellExecute.callsFake((command: string, options: ShellOptions) => {
                if (command === 'poetry env list --full-path') {
                    if (options.cwd && externalDependencies.arePathsSame(options.cwd, project1)) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(testPoetryDir, 'poetry-tutorial-project-6hnqYwvD-py3.8')} \n
                            ${path.join(testPoetryDir, 'globalwinproject-9hvDnqYw-py3.11')} (Activated)\r\n
                            ${path.join(testPoetryDir, 'someRandomPathWhichDoesNotExist')} `,
                        });
                    }
                }
                return Promise.reject(new Error('Command failed'));
            });
        });

        test('iterEnvs()', async () => {
            // Act
            const iterator = locator.iterEnvs();
            const actualEnvs = await getEnvs(iterator);

            // Assert
            const expectedEnvs = [
                createBasicEnv(
                    PythonEnvKind.Poetry,
                    path.join(testPoetryDir, 'poetry-tutorial-project-6hnqYwvD-py3.8', 'Scripts', 'python.exe'),
                ),
                createBasicEnv(
                    PythonEnvKind.Poetry,
                    path.join(testPoetryDir, 'globalwinproject-9hvDnqYw-py3.11', 'Scripts', 'python.exe'),
                ),
                createBasicEnv(PythonEnvKind.Poetry, path.join(project1, '.venv', 'Scripts', 'python.exe')),
            ];
            assertBasicEnvsEqual(actualEnvs, expectedEnvs);
        });
    });

    suite('Non-Windows', () => {
        const project2 = path.join(testPoetryDir, 'project2');
        setup(() => {
            locator = new PoetryLocator(project2);
            getOSTypeStub.returns(platformUtils.OSType.Linux);
            shellExecute.callsFake((command: string, options: ShellOptions) => {
                if (command === 'poetry env list --full-path') {
                    if (options.cwd && externalDependencies.arePathsSame(options.cwd, project2)) {
                        return Promise.resolve<ExecutionResult<string>>({
                            stdout: `${path.join(testPoetryDir, 'posix1project-9hvDnqYw-py3.4')} (Activated)\n
                        ${path.join(testPoetryDir, 'posix2project-6hnqYwvD-py3.7')}`,
                        });
                    }
                }
                return Promise.reject(new Error('Command failed'));
            });
        });

        test('iterEnvs()', async () => {
            // Act
            const iterator = locator.iterEnvs();
            const actualEnvs = await getEnvs(iterator);

            // Assert
            const expectedEnvs = [
                createBasicEnv(
                    PythonEnvKind.Poetry,
                    path.join(testPoetryDir, 'posix1project-9hvDnqYw-py3.4', 'python'),
                ),
                createBasicEnv(
                    PythonEnvKind.Poetry,
                    path.join(testPoetryDir, 'posix2project-6hnqYwvD-py3.7', 'bin', 'python'),
                ),
                createBasicEnv(PythonEnvKind.Poetry, path.join(project2, '.venv', 'bin', 'python')),
            ];
            assertBasicEnvsEqual(actualEnvs, expectedEnvs);
        });
    });
});
