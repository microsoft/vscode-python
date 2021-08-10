// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { flatten } from 'lodash';
import * as path from 'path';
import * as util from 'util';
import { CancellationToken, TestItem, Uri, TestController, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { runAdapter } from '../../../common/process/internal/scripts/testing_tools';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { PYTEST_PROVIDER } from '../../common/constants';
import { TestDiscoveryOptions } from '../../common/types';
import {
    createErrorTestItem,
    createWorkspaceRootTestItem,
    getNodeByUri,
    getWorkspaceNode,
    removeItemByIdFromChildren,
    updateTestItemFromRawData,
} from '../common/testItemUtilities';
import {
    ITestFrameworkController,
    ITestDiscoveryHelper,
    ITestsRunner,
    TestData,
    RawDiscoveredTests,
    ITestRun,
} from '../common/types';
import { preparePytestArgumentsForDiscovery, pytestGetTestFolders } from './arguments';

@injectable()
export class PytestController implements ITestFrameworkController {
    private readonly testData: Map<string, RawDiscoveredTests[]> = new Map();

    private discovering: Map<string, Deferred<void>> = new Map();

    private idToRawData: Map<string, TestData> = new Map();

    constructor(
        @inject(ITestDiscoveryHelper) private readonly discoveryHelper: ITestDiscoveryHelper,
        @inject(ITestsRunner) @named(PYTEST_PROVIDER) private readonly runner: ITestsRunner,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    ) {}

    public async resolveChildren(testController: TestController, item: TestItem): Promise<void> {
        const workspace = this.workspaceService.getWorkspaceFolder(item.uri);
        if (workspace) {
            // if we are still discovering then wait
            const discovery = this.discovering.get(workspace.uri.fsPath);
            if (discovery) {
                await discovery.promise;
            }

            // see if we have raw test data
            const rawTestData = this.testData.get(workspace.uri.fsPath);
            if (rawTestData) {
                // Refresh each node with new data
                if (rawTestData.length === 0) {
                    const items: TestItem[] = [];
                    testController.items.forEach((i) => items.push(i));
                    items.forEach((i) => testController.items.delete(i.id));
                    return Promise.resolve();
                }

                const root = rawTestData.length === 1 ? rawTestData[0].root : workspace.uri.fsPath;
                if (root === item.id) {
                    // This is the workspace root node
                    if (rawTestData.length === 1) {
                        if (rawTestData[0].tests.length > 0) {
                            item.description = item.id;
                            updateTestItemFromRawData(item, testController, this.idToRawData, item.id, rawTestData);
                        } else {
                            this.idToRawData.delete(item.id);
                            testController.items.delete(item.id);
                            return Promise.resolve();
                        }
                    } else {
                        item.description = workspace.uri.fsPath;

                        // To figure out which top level nodes have to removed. First we get all the
                        // existing nodes. Then if they have data we keep those nodes, Nodes without
                        // data will be removed after we check the raw data.
                        let subRootWithNoData: string[] = [];
                        item.children.forEach((c) => subRootWithNoData.push(c.id));

                        rawTestData.forEach((data) => {
                            if (data.tests.length > 0) {
                                let subRootItem = item.children.get(data.root);
                                if (!subRootItem) {
                                    subRootItem = createWorkspaceRootTestItem(testController, this.idToRawData, {
                                        id: data.root,
                                        label: path.basename(data.root),
                                        uri: Uri.file(data.root),
                                        runId: data.root,
                                        parentId: item.id,
                                    });
                                    item.children.add(subRootItem);
                                }

                                // We found data for a node. Remove its id for the no-data list.
                                subRootWithNoData = subRootWithNoData.filter((s) => s !== data.root);
                                updateTestItemFromRawData(
                                    subRootItem,
                                    testController,
                                    this.idToRawData,
                                    subRootItem.id,
                                    [data],
                                );
                            } else {
                                // This means there are no tests under this node
                                removeItemByIdFromChildren(this.idToRawData, item, [data.root]);
                            }
                        });

                        // We did not find any data for these nodes, delete them.
                        removeItemByIdFromChildren(this.idToRawData, item, subRootWithNoData);
                    }
                } else {
                    const workspaceNode = getWorkspaceNode(item, this.idToRawData);
                    if (workspaceNode) {
                        updateTestItemFromRawData(
                            item,
                            testController,
                            this.idToRawData,
                            workspaceNode.id,
                            rawTestData,
                        );
                    }
                }
            } else {
                const workspaceNode = getWorkspaceNode(item, this.idToRawData);
                if (workspaceNode) {
                    testController.items.delete(workspaceNode.id);
                }
            }
        }
        return Promise.resolve();
    }

    public async refreshTestData(testController: TestController, uri: Uri, token?: CancellationToken): Promise<void> {
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERING, undefined, { tool: 'pytest' });
        const workspace = this.workspaceService.getWorkspaceFolder(uri);
        if (workspace) {
            // Discovery is expensive. So if it is already running then use the promise
            // from the last run
            const previous = this.discovering.get(workspace.uri.fsPath);
            if (previous) {
                return previous.promise;
            }

            const settings = this.configService.getSettings(workspace.uri);
            const options: TestDiscoveryOptions = {
                workspaceFolder: workspace.uri,
                cwd: settings.testing.cwd ?? workspace.uri.fsPath,
                args: settings.testing.pytestArgs,
                ignoreCache: true,
                token,
            };

            // Get individual test directories selected by the user.
            const testDirectories = pytestGetTestFolders(options.args);

            // Set arguments to use with pytest discovery script.
            const args = runAdapter(['discover', 'pytest', '--', ...preparePytestArgumentsForDiscovery(options)]);

            // Build options for each directory selected by the user.
            let discoveryRunOptions: TestDiscoveryOptions[];
            if (testDirectories.length === 0) {
                // User did not provide any directory. So we don't need to tweak arguments.
                discoveryRunOptions = [
                    {
                        ...options,
                        args,
                    },
                ];
            } else {
                discoveryRunOptions = testDirectories.map((testDir) => ({
                    ...options,
                    args: [...args, testDir],
                }));
            }

            const deferred = createDeferred<void>();
            this.discovering.set(workspace.uri.fsPath, deferred);

            let rawTestData: RawDiscoveredTests[] = [];
            try {
                // This is where we execute pytest discovery via a common helper.
                rawTestData = flatten(
                    await Promise.all(discoveryRunOptions.map((o) => this.discoveryHelper.runTestDiscovery(o))),
                );
                this.testData.set(workspace.uri.fsPath, rawTestData);

                // Remove error node
                testController.items.delete(`DiscoveryError:${workspace.uri.fsPath}`);

                deferred.resolve();
            } catch (ex) {
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: 'pytest', failed: true });
                const cancel = options.token?.isCancellationRequested ? 'Cancelled' : 'Error';
                traceError(`${cancel} discovering pytest tests:\r\n`, ex);
                const message = getTestDiscoveryExceptions((ex as Error).message);

                // Report also on the test view. Getting root node is more complicated due to fact
                // that in pytest project can be organized in many ways
                testController.items.add(
                    createErrorTestItem(testController, {
                        id: `DiscoveryError:${workspace.uri.fsPath}`,
                        label: `Pytest Discovery Error [${path.basename(workspace.uri.fsPath)}]`,
                        error: util.format(
                            `${cancel} discovering pytest tests (see Output > Python):\r\n`,
                            message.length > 0 ? message : ex,
                        ),
                    }),
                );

                deferred.reject(ex as Error);
            } finally {
                // Discovery has finished running we have the raw test data at this point.
                this.discovering.delete(workspace.uri.fsPath);
            }
            const root = rawTestData.length === 1 ? rawTestData[0].root : workspace.uri.fsPath;
            const workspaceNode = testController.items.get(root);
            if (workspaceNode) {
                if (uri.fsPath === workspace.uri.fsPath) {
                    // this is a workspace level refresh
                    // This is an existing workspace test node. Just update the children
                    await this.resolveChildren(testController, workspaceNode);
                } else {
                    // This is a child node refresh
                    const testNode = getNodeByUri(workspaceNode, uri);
                    if (testNode) {
                        // We found the node to update
                        await this.resolveChildren(testController, testNode);
                    } else {
                        // update the entire workspace tree
                        await this.resolveChildren(testController, workspaceNode);
                    }
                }
            } else if (rawTestData.length > 0) {
                // This is a new workspace with tests.
                const newItem = createWorkspaceRootTestItem(testController, this.idToRawData, {
                    id: root,
                    label: path.basename(root),
                    uri: Uri.file(root),
                    runId: root,
                });
                testController.items.add(newItem);

                await this.resolveChildren(testController, newItem);
            }
        }
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: 'pytest', failed: false });
        return Promise.resolve();
    }

    public runTests(testRun: ITestRun, workspace: WorkspaceFolder, token: CancellationToken): Promise<void> {
        const settings = this.configService.getSettings(workspace.uri);
        return this.runner.runTests(
            testRun,
            {
                workspaceFolder: workspace.uri,
                cwd: settings.testing.cwd ?? workspace.uri.fsPath,
                token,
                args: settings.testing.pytestArgs,
            },
            this.idToRawData,
        );
    }
}

function getTestDiscoveryExceptions(content: string): string {
    const lines = content.split(/\r?\n/g);
    let start = false;
    let exceptions = '';
    for (const line of lines) {
        if (start) {
            exceptions += `${line}\r\n`;
        } else if (line.includes(' ERRORS ')) {
            start = true;
        }
    }
    return exceptions;
}
