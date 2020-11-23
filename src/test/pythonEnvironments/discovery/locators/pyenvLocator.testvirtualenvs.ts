// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import * as path from 'path';
import { createPyenvLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/pyenvLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { testLocatorWatcher } from './watcherTestUtils';

suite('Pyenv Locator', async () => {
    const testPyenvRoot = path.join(TEST_LAYOUT_ROOT, 'pyenvhome', '.pyenv');
    const testPyenvVersionsDir = path.join(testPyenvRoot, 'versions');
    let pyenvRootOldValue: string | undefined;
    suiteSetup(async () => {
        pyenvRootOldValue = process.env.PYENV_ROOT;
        process.env.PYENV_ROOT = testPyenvRoot;
    });
    testLocatorWatcher(testPyenvVersionsDir, createPyenvLocator);
    suiteTeardown(() => {
        process.env.PYENV_ROOT = pyenvRootOldValue;
    });
});
