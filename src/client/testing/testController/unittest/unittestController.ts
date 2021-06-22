// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { CancellationToken, TestItem, TestRunRequest, Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { IConfigurationService } from '../../../common/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { getUri } from '../common/testItemUtilities';
import { ITestController, ITestDiscovery, ITestsRunner, PythonTestData } from '../common/types';

@injectable()
export class UnittestController implements ITestController {
    constructor(
        @inject(ITestDiscovery) @named(UNITTEST_PROVIDER) private readonly discovery: ITestDiscovery,
        @inject(ITestsRunner) @named(UNITTEST_PROVIDER) private readonly runner: ITestsRunner,
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
            args: settings.testing.unittestArgs,
            token,
            ignoreCache: true,
        };
        return this.discovery.discoverWorkspaceTests(options);
    }

    public runTests(options: TestRunRequest<PythonTestData>, token: CancellationToken): Promise<void> {
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(getUri(options.tests[0]));
        const settings = this.configService.getSettings(workspaceFolder?.uri);
        const cwd = workspaceFolder?.uri.fsPath ?? process.cwd();
        return this.runner.runTests(options, {
            workspaceFolder: workspaceFolder?.uri ?? Uri.file(cwd),
            cwd: settings.testing.cwd ?? cwd,
            token,
            args: settings.testing.unittestArgs,
        });
    }
}
