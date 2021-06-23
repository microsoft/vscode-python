// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestController, TestItem, TestRunRequest, WorkspaceFolder } from 'vscode';
import { IConfigurationService } from '../../common/types';
import { getUri } from './common/testItemUtilities';
import { ITestController, PythonTestData } from './common/types';
/* eslint-disable */

export class PythonTestController implements TestController<PythonTestData> {
    constructor(
        private readonly configSettings: IConfigurationService,
        private readonly pytest: ITestController,
        private readonly unittest: ITestController,
    ) {}

    public createWorkspaceTestRoot(
        workspace: WorkspaceFolder,
        token: CancellationToken,
    ): Promise<TestItem<PythonTestData> | undefined> {
        const settings = this.configSettings.getSettings(workspace.uri);
        if (settings.testing.pytestEnabled) {
            return this.pytest.createWorkspaceTests(workspace, token);
        } else if (settings.testing.unittestEnabled) {
            return this.unittest.createWorkspaceTests(workspace, token);
        }
        return Promise.resolve(undefined);
    }

    public runTests(request: TestRunRequest<PythonTestData>, token: CancellationToken): Promise<void> {
        const settings = this.configSettings.getSettings(getUri(request.tests[0]));
        if (settings.testing.pytestEnabled) {
            return this.pytest.runTests(request, token);
        } else if (settings.testing.unittestEnabled) {
            return this.unittest.runTests(request, token);
        }
        return Promise.resolve();
    }
}
