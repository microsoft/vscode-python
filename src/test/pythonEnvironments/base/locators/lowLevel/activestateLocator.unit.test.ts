// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import { PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import * as externalDependencies from '../../../../../client/pythonEnvironments/common/externalDependencies';
import { getEnvs } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { ActiveStateLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/activestateLocator';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { assertBasicEnvsEqual } from '../envTestUtils';
import { ExecutionResult } from '../../../../../client/common/process/types';
import { createBasicEnv } from '../../common';
import { getOSType, OSType } from '../../../../../client/common/utils/platform';

suite('ActiveState Locator', () => {
    const testActiveStateDir = path.join(TEST_LAYOUT_ROOT, 'activestate');
    let shellExecute: sinon.SinonStub;
    let locator: ActiveStateLocator;

    suiteSetup(() => {
        locator = new ActiveStateLocator();
        shellExecute = sinon.stub(externalDependencies, 'shellExecute');
        shellExecute.callsFake((command: string) => {
            if (command === 'state projects -o editor') {
                return Promise.resolve<ExecutionResult<string>>({
                    stdout: `[{"name":"test","organization":"test-org","local_checkouts":["does-not-matter"],"executables":["${path.join(
                        testActiveStateDir,
                        'c09080d1',
                        'exec',
                    )}"]},{"name":"test2","organization":"test-org","local_checkouts":["does-not-matter2"],"executables":["${path.join(
                        testActiveStateDir,
                        '2af6390a',
                        'exec',
                    )}"]}]\n\0`,
                });
            }
            return Promise.reject(new Error('Command failed'));
        });
    });

    suiteTeardown(() => sinon.restore());

    test('iterEnvs()', async () => {
        const actualEnvs = await getEnvs(locator.iterEnvs());
        const expectedEnvs = [
            createBasicEnv(
                PythonEnvKind.ActiveState,
                path.join(
                    testActiveStateDir,
                    'c09080d1',
                    'exec',
                    getOSType() === OSType.Windows ? 'python3.exe' : 'python3',
                ),
            ),
        ];
        assertBasicEnvsEqual(actualEnvs, expectedEnvs);
    });
});
