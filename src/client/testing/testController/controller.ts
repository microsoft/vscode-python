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
    CancellationTokenSource,
    Uri,
    EventEmitter,
} from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { traceVerbose } from '../../common/logger';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../common/types';
import { DelayedTrigger, IDelayedTrigger } from '../../common/utils/delayTrigger';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../common/constants';
import { getNodeByUri } from './common/testItemUtilities';
import { ITestController, ITestFrameworkController, TestRefreshOptions } from './common/types';

@injectable()
export class PythonTestController implements ITestController {
    private readonly testController: TestController;

    private readonly refreshData: IDelayedTrigger;

    private refreshCancellation: CancellationTokenSource;

    private readonly refreshingCompletedEvent: EventEmitter<void> = new EventEmitter<void>();

    private readonly refreshingStartedEvent: EventEmitter<void> = new EventEmitter<void>();

    private readonly runWithoutConfigurationEvent: EventEmitter<WorkspaceFolder[]> = new EventEmitter<
        WorkspaceFolder[]
    >();

    public readonly onRefreshingCompleted = this.refreshingCompletedEvent.event;

    public readonly onRefreshingStarted = this.refreshingStartedEvent.event;

    public readonly onRunWithoutConfiguration = this.runWithoutConfigurationEvent.event;

    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private readonly configSettings: IConfigurationService,
        @inject(ITestFrameworkController) @named(PYTEST_PROVIDER) private readonly pytest: ITestFrameworkController,
        @inject(ITestFrameworkController) @named(UNITTEST_PROVIDER) private readonly unittest: ITestFrameworkController,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {
        this.refreshCancellation = new CancellationTokenSource();

        this.testController = tests.createTestController('python-tests', 'Python Tests');
        this.disposables.push(this.testController);

        const delayTrigger = new DelayedTrigger(
            (uri: Uri, invalidate: boolean) => {
                this.refreshTestDataInternal(uri);
                if (invalidate) {
                    this.invalidateTests(uri);
                }
            },
            250, // Delay running the refresh by 250 ms
            'Refresh Test Data',
        );
        this.disposables.push(delayTrigger);
        this.refreshData = delayTrigger;

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

        this.watchForTestChanges();
    }

    public refreshTestData(uri?: Resource, options?: TestRefreshOptions): Promise<void> {
        if (options?.forceRefresh) {
            if (uri === undefined) {
                // This is a special case where we want everything to be re-discovered.
                traceVerbose('Testing: Clearing all discovered tests');
                this.testController.items.forEach((item) => {
                    const ids: string[] = [];
                    item.children.forEach((child) => ids.push(child.id));
                    ids.forEach((id) => item.children.delete(id));
                });

                traceVerbose('Testing: Forcing test data refresh');
                return this.refreshTestDataInternal(undefined);
            }

            traceVerbose('Testing: Forcing test data refresh');
            return this.refreshTestDataInternal(uri);
        }

        this.refreshData.trigger(uri, false);
        return Promise.resolve();
    }

    public stopRefreshing(): void {
        this.refreshCancellation.cancel();
        this.refreshCancellation.dispose();
        this.refreshCancellation = new CancellationTokenSource();
    }

    public clearTestController(): void {
        const ids: string[] = [];
        this.testController.items.forEach((item) => ids.push(item.id));
        ids.forEach((id) => this.testController.items.delete(id));
    }

    private async refreshTestDataInternal(uri?: Resource): Promise<void> {
        this.refreshingStartedEvent.fire();
        if (uri) {
            traceVerbose(`Testing: Refreshing test data for ${uri.fsPath}`);

            const settings = this.configSettings.getSettings(uri);
            if (settings.testing.pytestEnabled) {
                await this.pytest.refreshTestData(this.testController, uri, this.refreshCancellation.token);
            } else if (settings.testing.unittestEnabled) {
                await this.unittest.refreshTestData(this.testController, uri, this.refreshCancellation.token);
            } else {
                sendTelemetryEvent(EventName.UNITTEST_DISABLED);
                // If we are here we may have to remove an existing node from the tree
                // This handles the case where user removes test settings. Which should remove the
                // tests for that particular case from the tree view
                const workspace = this.workspaceService.getWorkspaceFolder(uri);
                if (workspace) {
                    const toDelete: string[] = [];
                    this.testController.items.forEach((i: TestItem) => {
                        const w = this.workspaceService.getWorkspaceFolder(i.uri);
                        if (w?.uri.fsPath === workspace.uri.fsPath) {
                            toDelete.push(i.id);
                        }
                    });
                    toDelete.forEach((i) => this.testController.items.delete(i));
                }
            }
        } else {
            traceVerbose('Testing: Refreshing all test data');
            const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];
            await Promise.all(workspaces.map((workspace) => this.refreshTestDataInternal(workspace.uri)));
        }
        this.refreshingCompletedEvent.fire();
        return Promise.resolve();
    }

    private async resolveChildren(item: TestItem | undefined): Promise<void> {
        if (item) {
            traceVerbose(`Testing: Resolving item ${item.id}`);
            const settings = this.configSettings.getSettings(item.uri);
            if (settings.testing.pytestEnabled) {
                return this.pytest.resolveChildren(this.testController, item);
            }
            if (settings.testing.unittestEnabled) {
                return this.unittest.resolveChildren(this.testController, item);
            }
        } else {
            traceVerbose('Testing: Refreshing all test data');
            sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'auto' });
            const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];
            await Promise.all(workspaces.map((workspace) => this.refreshTestDataInternal(workspace.uri)));
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
        const runInstance = this.testController.createTestRun(
            request,
            `Running Tests for Workspace(s): ${workspaces.map((w) => w.uri.fsPath).join(';')}`,
            true,
        );
        const dispose = token.onCancellationRequested(() => {
            runInstance.end();
        });

        const unconfiguredWorkspaces: WorkspaceFolder[] = [];
        try {
            await Promise.all(
                workspaces.map((workspace) => {
                    const testItems: TestItem[] = [];
                    // If the run request includes test items then collect only items that belong to
                    // `workspace`. If there are no items in the run request then just run the `workspace`
                    // root test node. Include will be `undefined` in the "run all" scenario.
                    (request.include ?? this.testController.items).forEach((i: TestItem) => {
                        const w = this.workspaceService.getWorkspaceFolder(i.uri);
                        if (w?.uri.fsPath === workspace.uri.fsPath) {
                            testItems.push(i);
                        }
                    });

                    const settings = this.configSettings.getSettings(workspace.uri);
                    if (testItems.length > 0) {
                        if (settings.testing.pytestEnabled) {
                            sendTelemetryEvent(EventName.UNITTEST_RUN, undefined, {
                                tool: 'pytest',
                                debugging: request.profile?.kind === TestRunProfileKind.Debug,
                            });
                            return this.pytest.runTests(
                                {
                                    includes: testItems,
                                    excludes: request.exclude ?? [],
                                    runKind: request.profile?.kind ?? TestRunProfileKind.Run,
                                    runInstance,
                                },
                                workspace,
                                token,
                            );
                        }
                        if (settings.testing.unittestEnabled) {
                            sendTelemetryEvent(EventName.UNITTEST_RUN, undefined, {
                                tool: 'unittest',
                                debugging: request.profile?.kind === TestRunProfileKind.Debug,
                            });
                            return this.unittest.runTests(
                                {
                                    includes: testItems,
                                    excludes: request.exclude ?? [],
                                    runKind: request.profile?.kind ?? TestRunProfileKind.Run,
                                    runInstance,
                                },
                                workspace,
                                token,
                            );
                        }
                    }

                    if (!settings.testing.pytestEnabled && !settings.testing.unittestEnabled) {
                        unconfiguredWorkspaces.push(workspace);
                    }
                    return Promise.resolve();
                }),
            );
        } finally {
            runInstance.appendOutput(`Finished running tests!\r\n`);
            runInstance.end();
            dispose.dispose();

            if (unconfiguredWorkspaces.length > 0) {
                this.runWithoutConfigurationEvent.fire(unconfiguredWorkspaces);
            }
        }
    }

    private invalidateTests(uri: Uri) {
        this.testController.items.forEach((root) => {
            const item = getNodeByUri(root, uri);
            if (item && !!item.invalidateResults) {
                // Minimize invalidating to test case nodes for the test file where
                // the change occurred
                item.invalidateResults();
            }
        });
    }

    private watchForTestChanges(): void {
        const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];
        for (const workspace of workspaces) {
            const settings = this.configSettings.getSettings(workspace.uri);
            if (settings.testing.autoTestDiscoverOnSaveEnabled) {
                traceVerbose(`Testing: Setting up watcher for ${workspace.uri.fsPath}`);
                this.watchForSettingsChanges(workspace);
                this.watchForTestContentChanges(workspace);
            }
        }
    }

    private watchForSettingsChanges(workspace: WorkspaceFolder): void {
        const pattern = new RelativePattern(workspace, '**/{settings.json,pytest.ini,pyproject.toml,setup.cfg}');
        const watcher = this.workspaceService.createFileSystemWatcher(pattern);
        this.disposables.push(watcher);

        this.disposables.push(
            watcher.onDidChange((uri) => {
                traceVerbose(`Testing: Trigger refresh after change in ${uri.fsPath}`);
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'watching' });
                this.refreshData.trigger(uri, false);
            }),
        );
        this.disposables.push(
            watcher.onDidCreate((uri) => {
                traceVerbose(`Testing: Trigger refresh after creating ${uri.fsPath}`);
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'watching' });
                this.refreshData.trigger(uri, false);
            }),
        );
        this.disposables.push(
            watcher.onDidDelete((uri) => {
                traceVerbose(`Testing: Trigger refresh after deleting in ${uri.fsPath}`);
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'watching' });
                this.refreshData.trigger(uri, false);
            }),
        );
    }

    private watchForTestContentChanges(workspace: WorkspaceFolder): void {
        const pattern = new RelativePattern(workspace, '**/*.py');
        const watcher = this.workspaceService.createFileSystemWatcher(pattern);
        this.disposables.push(watcher);

        this.disposables.push(
            watcher.onDidChange((uri) => {
                traceVerbose(`Testing: Trigger refresh after change in ${uri.fsPath}`);
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'watching' });
                // We want to invalidate tests for code change
                this.refreshData.trigger(uri, true);
            }),
        );
        this.disposables.push(
            watcher.onDidCreate((uri) => {
                traceVerbose(`Testing: Trigger refresh after creating ${uri.fsPath}`);
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'watching' });
                this.refreshData.trigger(uri, false);
            }),
        );
        this.disposables.push(
            watcher.onDidDelete((uri) => {
                traceVerbose(`Testing: Trigger refresh after deleting in ${uri.fsPath}`);
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'watching' });
                this.refreshData.trigger(uri, false);
            }),
        );
    }
}
