// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { CancellationToken, TestItem, TestRunRequest, TextDocument, WorkspaceFolder } from 'vscode';
import { IConfigurationService } from '../../../common/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { ITestController, ITestDiscovery, PythonTestData } from '../common/types';


@injectable()
export class UnittestController implements ITestController {
    constructor(
        @inject(ITestDiscovery) @named(UNITTEST_PROVIDER) private readonly discovery: ITestDiscovery,
        @inject(IConfigurationService) private readonly configService: IConfigurationService
    ) {}

    createWorkspaceTests(
        workspace: WorkspaceFolder,
        token: CancellationToken,
    ): Promise<TestItem<PythonTestData> | undefined>{
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

    // eslint-disable-next-line class-methods-use-this
    createOrUpdateDocumentTests(
        _document: TextDocument,
        _token: CancellationToken,
    ): Promise<TestItem<PythonTestData> | undefined>{
        throw new Error();
    }

    // eslint-disable-next-line class-methods-use-this
    runTests(_options: TestRunRequest<PythonTestData>, _token: CancellationToken): Promise<void>{
        throw new Error();
    }
}
