// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { createWorkspaceVirtualEnvLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/workspaceVirtualEnvLocator';
import { TEST_LAYOUT_ROOT } from '../../../common/commonTestConstants';
import { locatorFactoryFuncType, testLocatorWatcher } from '../../../discovery/locators/watcherTestUtils';

suite('WorkspaceVirtualEnvironment Locator', async () => {
    const testWorkspaceFolder = path.join(TEST_LAYOUT_ROOT, 'workspace', 'folder1');
    testLocatorWatcher(
        testWorkspaceFolder,
        <locatorFactoryFuncType>createWorkspaceVirtualEnvLocator,
        { arg: testWorkspaceFolder },
    );
});
