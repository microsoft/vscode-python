// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { WorkspaceFolder, CancellationToken, TestItem, TestRunRequest, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IConfigurationService } from '../../../common/types';
import { PYTEST_PROVIDER } from '../../common/constants';
import { getUri } from '../common/testItemUtilities';
import { ITestController, ITestDiscovery, ITestsRunner, PythonTestData } from '../common/types';

@injectable()
export class PytestController implements ITestController {
    constructor(
        @inject(ITestDiscovery) @named(PYTEST_PROVIDER) private readonly discovery: ITestDiscovery,
        @inject(ITestsRunner) @named(PYTEST_PROVIDER) private readonly runner: ITestsRunner,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    ) {}

    public createWorkspaceTests(
        workspace: WorkspaceFolder,
        token: CancellationToken,
    ): Promise<TestItem<PythonTestData> | undefined> {
        const settings = this.configService.getSettings(workspace.uri);
        const options = {
            workspaceFolder: workspace.uri,
            cwd: settings.testing.cwd ?? workspace.uri.fsPath,
            args: settings.testing.pytestArgs,
            token,
            ignoreCache: true,
        };
        return this.discovery.discoverWorkspaceTests(options);
    }

    public runTests(request: TestRunRequest<PythonTestData>, token: CancellationToken): Promise<void> {
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(getUri(request.tests[0]));
        const settings = this.configService.getSettings(workspaceFolder?.uri);
        const cwd = workspaceFolder?.uri.fsPath ?? process.cwd();
        return this.runner.runTests(request, {
            workspaceFolder: workspaceFolder?.uri ?? Uri.file(cwd),
            cwd: settings.testing.cwd ?? cwd,
            token,
            args: settings.testing.pytestArgs,
        });
    }
}
