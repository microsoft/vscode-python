// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { uniq } from 'lodash';
import {
    CancellationToken,
    TestController,
    TestItem,
    TestRunRequest,
    tests,
    WorkspaceFolder,
    RelativePattern,
    TestRunProfileKind,
} from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../common/types';
import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../common/constants';
import { ITestController, ITestFrameworkController } from './common/types';

@injectable()
export class PythonTestController implements ITestController {
    private readonly testController: TestController;

    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private readonly configSettings: IConfigurationService,
        @inject(ITestFrameworkController) @named(PYTEST_PROVIDER) private readonly pytest: ITestFrameworkController,
        @inject(ITestFrameworkController) @named(UNITTEST_PROVIDER) private readonly unittest: ITestFrameworkController,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {
        this.testController = tests.createTestController('python-tests', 'Python Tests');
        this.disposables.push(this.testController);

        this.disposables.push(
            this.testController.createRunProfile('Run Tests', TestRunProfileKind.Run, this.runTests.bind(this), true),
            this.testController.createRunProfile(
                'Debug Tests',
                TestRunProfileKind.Debug,
                this.runTests.bind(this),
                true,
            ),
        );
        this.testController.resolveHandler = this.resolveChildren.bind(this);
    }

    public async refreshTestData(uri?: Resource): Promise<void> {
        const settings = this.configSettings.getSettings(uri);
        if (settings.testing.pytestEnabled) {
            return this.pytest.refreshTestData(this.testController, uri);
        }
        if (settings.testing.unittestEnabled) {
            return this.unittest.refreshTestData(this.testController, uri);
        }
        return Promise.resolve();
    }

    private async resolveChildren(item: TestItem | undefined): Promise<void> {
        if (item) {
            const settings = this.configSettings.getSettings(item.uri);
            if (settings.testing.pytestEnabled) {
                return this.pytest.resolveChildren(this.testController, item);
            }
            if (settings.testing.unittestEnabled) {
                return this.unittest.resolveChildren(this.testController, item);
            }
        } else {
            this.watchForTestChanges();
            const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];
            await Promise.all(workspaces.map((workspace) => this.refreshTestData(workspace.uri)));
        }
        return Promise.resolve();
    }

    private async runTests(request: TestRunRequest, token: CancellationToken): Promise<void> {
        const workspaces: WorkspaceFolder[] = [];
        if (request.include) {
            uniq(request.include.map((r) => this.workspaceService.getWorkspaceFolder(r.uri))).forEach((w) => {
                if (w) {
                    workspaces.push(w);
                }
            });
        } else {
            (this.workspaceService.workspaceFolders || []).forEach((w) => workspaces.push(w));
        }
        const debug = request.profile?.kind === TestRunProfileKind.Debug;
        await Promise.all(
            workspaces.map((workspace) => {
                const settings = this.configSettings.getSettings(workspace.uri);
                if (settings.testing.pytestEnabled) {
                    return this.pytest.runTests(this.testController, request, debug, workspace, token);
                }
                if (settings.testing.unittestEnabled) {
                    return this.unittest.runTests(this.testController, request, debug, workspace, token);
                }
                return Promise.resolve();
            }),
        );
    }

    private watchForTestChanges(): void {
        const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];
        for (const workspace of workspaces) {
            const settings = this.configSettings.getSettings(workspace.uri);
            if (settings.testing.autoTestDiscoverOnSaveEnabled) {
                this.watchForSettingsChanges(workspace);
                this.watchForTestContentChanges(workspace);
            }
        }
    }

    private watchForSettingsChanges(workspace: WorkspaceFolder): void {
        const pattern = new RelativePattern(workspace, '**/{settings.json,pytest.ini,pyproject.toml,setup.cfg}');
        const watcher = this.workspaceService.createFileSystemWatcher(pattern);
        this.disposables.push(watcher);

        watcher.onDidChange((uri) => this.refreshTestData(uri));
        watcher.onDidCreate((uri) => this.refreshTestData(uri));
        watcher.onDidDelete((uri) => this.refreshTestData(uri));
    }

    private watchForTestContentChanges(workspace: WorkspaceFolder): void {
        const pattern = new RelativePattern(workspace, '**/*test*.py');
        const watcher = this.workspaceService.createFileSystemWatcher(pattern);
        this.disposables.push(watcher);

        watcher.onDidChange((uri) => this.refreshTestData(uri));
        watcher.onDidCreate((uri) => this.refreshTestData(uri));
        watcher.onDidDelete((uri) => this.refreshTestData(uri));
    }
}
