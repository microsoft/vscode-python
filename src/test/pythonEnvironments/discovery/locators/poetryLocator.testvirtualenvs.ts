// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { ExecutionResult, ShellOptions } from '../../../../client/common/process/types';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { BasicEnvInfo, ILocator } from '../../../../client/pythonEnvironments/base/locator';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import { PoetryLocator } from '../../../../client/pythonEnvironments/base/locators/lowLevel/poetryLocator';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { testLocatorWatcher } from './watcherTestUtils';

suite('Poetry Watcher', async () => {
    let shellExecute: sinon.SinonStub;
    const testPoetryDir = path.join(TEST_LAYOUT_ROOT, 'poetry');
    const project1 = path.join(testPoetryDir, 'project1');
    suiteSetup(async () => {
        shellExecute = sinon.stub(externalDependencies, 'shellExecute');
        shellExecute.callsFake((command: string, options: ShellOptions) => {
            // eslint-disable-next-line default-case
            if (command === 'poetry env list --full-path') {
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

suite('Poetry Locator', async () => {
    let locator: ILocator<BasicEnvInfo>;
    suiteSetup(async function () {
        if (process.env.CI_PYTHON_VERSION && process.env.CI_PYTHON_VERSION.startsWith('2.')) {
            // Poetry is soon to be deprecated for Python2.7, and tests do not pass
            // as it is with pip installation of poetry, hence skip.
            this.skip();
        }
        locator = new PoetryLocator(EXTENSION_ROOT_DIR_FOR_TESTS);
    });

    test('Discovers existing poetry environments', async () => {
        const items = await getEnvs(locator.iterEnvs());
        const isLocated = items.some(
            (item) => item.kind === PythonEnvKind.Poetry && item.executablePath.includes('poetry-tutorial-project'),
        );
        expect(isLocated).to.equal(true);
    });
});
