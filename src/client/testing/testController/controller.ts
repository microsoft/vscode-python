// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestController, TestItem, TestRunRequest, WorkspaceFolder } from 'vscode';
import { IConfigurationService } from '../../common/types';
import { getUri } from './common/testItemUtilities';
import { ITestController, PythonTestData } from './common/types';
/* eslint-disable */

export class PythonTestController implements TestController<PythonTestData> {
    constructor(private readonly configSettings: IConfigurationService, private readonly pytest: ITestController) {}

    public createWorkspaceTestRoot(
        workspace: WorkspaceFolder,
        token: CancellationToken,
    ): Promise<TestItem<PythonTestData> | undefined> {
        const settings = this.configSettings.getSettings(workspace.uri);
        if (settings.testing.pytestEnabled) {
            return this.pytest.createWorkspaceTests(workspace, token);
        }
        return Promise.resolve(undefined);
    }

    public runTests(options: TestRunRequest<PythonTestData>, token: CancellationToken): Promise<void> {
        const settings = this.configSettings.getSettings(getUri(options.tests[0]));
        if (settings.testing.pytestEnabled) {
            return this.pytest.runTests(options, token);
        }
        return Promise.resolve();
    }
}
