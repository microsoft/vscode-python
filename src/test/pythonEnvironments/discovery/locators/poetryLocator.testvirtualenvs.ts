// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import { ExecutionResult, ShellOptions } from '../../../../client/common/process/types';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import { PoetryLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/poetryLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { testLocatorWatcher } from './watcherTestUtils';

suite('Poetry Locator', async () => {
    let shellExecute: sinon.SinonStub;
    const testPoetryDir = path.join(TEST_LAYOUT_ROOT, 'poetry');
    const project1 = path.join(testPoetryDir, 'project1');
    suiteSetup(async () => {
        shellExecute = sinon.stub(externalDependencies, 'shellExecute');
        shellExecute.callsFake((command: string, options: ShellOptions) => {
            // eslint-disable-next-line default-case
            if (command === 'poetry --version') {
                return Promise.resolve<ExecutionResult<string>>({ stdout: '' });
            }
            if (command === 'poetry config virtualenvs.path') {
                if (options.cwd && externalDependencies.arePathsSame(options.cwd, project1)) {
                    return Promise.resolve<ExecutionResult<string>>({
                        stdout: `${testPoetryDir} \n`,
                    });
                }
            }
            return Promise.reject(new Error('Command failed'));
        });
    });
    testLocatorWatcher(testPoetryDir, async () => new PoetryLocator(project1), {
        kind: PythonEnvKind.Poetry,
        doNotVerifyIfLocated: true,
    });

    suiteTeardown(() => sinon.restore());
});
