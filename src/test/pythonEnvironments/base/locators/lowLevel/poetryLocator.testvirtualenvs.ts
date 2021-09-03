// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { BasicEnvInfo, ILocator } from '../../../../../client/pythonEnvironments/base/locator';
import { getEnvs } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { PoetryLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/poetryLocator';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../../constants';

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
