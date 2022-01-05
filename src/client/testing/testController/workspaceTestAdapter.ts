// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as util from 'util';
import { CancellationToken, Position, Range, TestController, TestItem, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { IConfigurationService } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Testing } from '../../common/utils/localize';
import { traceError } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { TestProvider } from '../types';
import { createErrorTestItem, DebugTestTag, ErrorTestItemOptions, RunTestTag } from './common/testItemUtilities';
import { DiscoveredTestItem, DiscoveredTestNode, DiscoveredTestType, ITestDiscoveryAdapter } from './common/types';
import { DEFAULT_TEST_PORT } from './common/utils';
import { UnittestTestDiscoveryAdapter } from './unittest/testDiscoveryAdapter';

export class WorkspaceTestAdapter {
    private discoveryAdapter: ITestDiscoveryAdapter;

    private discovering: Map<string, Deferred<void>> = new Map();

    private testData: DiscoveredTestNode | undefined;

    // private running: ITestRunningAdapter;

    constructor(
        public testProvider: TestProvider,
        executionFactory: IPythonExecutionFactory,
        private workspaceService: IWorkspaceService,
        configSettings: IConfigurationService,
        index: number,
    ) {
        if (this.testProvider === 'unittest') {
            const port = DEFAULT_TEST_PORT + index * 10;

            this.discoveryAdapter = new UnittestTestDiscoveryAdapter(executionFactory, configSettings, port);
        } else {
            // TODO: PYTEST DISCOVERY ADAPTER
            // this is a placeholder for now
            this.discoveryAdapter = new UnittestTestDiscoveryAdapter(executionFactory, configSettings, 45454);
        }
    }

    public async discoverTests(
        testController: TestController,
        uri: Uri,
        token?: CancellationToken,
        isMultiroot?: boolean,
        workspaceFilePath?: string,
    ): Promise<void> {
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERING, undefined, { tool: 'unittest' });

        console.warn(`discovery uri: ${uri.fsPath}`);

        // The uri parameter can differ from the workspace uri when we're in a multiroot workspace scenario.
        // As such, we don't rely on this.workspaceUri
        const workspace = this.workspaceService.getWorkspaceFolder(uri);

        if (workspace) {
            // Discovery is expensive. If it is already running, use the existing promise.
            const discoveryUri = workspace.uri;
            const previous = this.discovering.get(discoveryUri.fsPath);
            if (previous) {
                return previous.promise;
            }

            const deferred = createDeferred<void>();
            this.discovering.set(discoveryUri.fsPath, deferred);

            let rawTestData;
            try {
                rawTestData = await this.discoveryAdapter.discoverTests(discoveryUri);

                deferred.resolve();
            } catch (ex) {
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: 'unittest', failed: true });

                const cancel = token?.isCancellationRequested
                    ? Testing.cancelUnittestDiscovery()
                    : Testing.errorUnittestDiscovery();

                traceError(`${cancel}\r\n`, ex);

                // Report also on the test view.
                const message = util.format(`${cancel} ${Testing.seePythonOutput()}\r\n`, ex);
                const options = buildErrorNodeOptions(discoveryUri, message);
                const errorNode = createErrorTestItem(testController, options);
                testController.items.add(errorNode);

                deferred.reject(ex as Error);
            } finally {
                // Discovery has finished running, we have the data,
                // we don't need the deferred promise anymore.
                this.discovering.delete(discoveryUri.fsPath);
            }

            if (!rawTestData) {
                // No test data is available
                return Promise.resolve();
            }

            // Check if there were any errors in the discovery process.
            if (rawTestData.status === 'error') {
                const { errors } = rawTestData;
                traceError(Testing.errorUnittestDiscovery(), '\r\n', errors!.join('\r\n\r\n'));

                let errorNode = testController.items.get(`DiscoveryError:${uri.fsPath}`);
                const message = util.format(
                    `${Testing.errorUnittestDiscovery()} ${Testing.seePythonOutput()}\r\n`,
                    errors!.join('\r\n\r\n'),
                );

                if (errorNode === undefined) {
                    const options = buildErrorNodeOptions(discoveryUri, message);
                    errorNode = createErrorTestItem(testController, options);
                    testController.items.add(errorNode);
                }
                errorNode.error = message;
            } else {
                // Remove the error node if necessary,
                // then parse and insert test data.
                testController.items.delete(`DiscoveryError:${discoveryUri.fsPath}`);

                // If we are in a multiroot workspace scenario, find the overall root (should be the workspace file name),
                // And wrap the current folder's test result in a tree under the overall root + the current folder name.
                let workspaceNode: TestItem | undefined;
                if (isMultiroot && workspaceFilePath) {
                    const rootFilename = path.basename(workspaceFilePath);
                    workspaceNode = testController.items.get(workspaceFilePath);

                    const workspacePath = workspace.uri.fsPath;
                    const wrappedTests = rawTestData.tests;

                    const children = [
                        {
                            path: workspacePath,
                            name: path.basename(workspacePath),
                            type_: 'folder' as DiscoveredTestType,
                            children: wrappedTests ? [wrappedTests] : [],
                        },
                    ];

                    rawTestData.tests = {
                        path: workspaceFilePath,
                        name: rootFilename,
                        type_: 'folder',
                        children,
                    };
                } else {
                    // Find the root for this test data in the test controller.
                    const rootPath = rawTestData.cwd;
                    workspaceNode = testController.items.get(rootPath);
                }

                if (rawTestData.tests) {
                    // If the test root for this folder exists: Workspace refresh, update its children.
                    // Otherwise, it is a freshly discovered workspace, and we need to create a new test root and populate the test tree.
                    if (workspaceNode) {
                        console.warn(`Update test tree with:`);
                        console.warn(rawTestData);
                        updateTestTree(testController, rawTestData.tests, this.testData, workspaceNode, token);
                    } else {
                        console.warn(`Populate test tree with:`);
                        console.warn(rawTestData);
                        populateTestTree(testController, rawTestData.tests, undefined, token);
                    }
                } else {
                    // Delete everything from the test controller.
                    console.warn(`Delete everything from the test controller.`);
                    testController.items.replace([]);
                }

                // Save new test data state.
                this.testData = rawTestData.tests;
            }

            console.warn(this.testData);
        }

        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: 'unittest', failed: false });
        return Promise.resolve();
    }
}

function isTestItem(test: DiscoveredTestNode | DiscoveredTestItem): test is DiscoveredTestItem {
    return test.type_ === 'test';
}

function deleteTestTree(testController: TestController, root?: TestItem) {
    if (root) {
        const { children } = root;

        children.forEach((child) => {
            deleteTestTree(testController, child);

            const { id } = child;
            testController.items.delete(id);
        });

        testController.items.delete(root.id);
    }
}

function updateTestTree(
    testController: TestController,
    updatedData: DiscoveredTestNode,
    localData: DiscoveredTestNode | undefined,
    testRoot: TestItem | undefined,
    token?: CancellationToken,
): void {
    // If testRoot is undefined, use the info of the root item of testTreeData to create a test item, and append it to the test controller.
    if (!testRoot) {
        testRoot = testController.createTestItem(updatedData.path, updatedData.name, Uri.file(updatedData.path));
        testRoot.canResolveChildren = true;
        testRoot.tags = [RunTestTag, DebugTestTag];

        testController.items.add(testRoot);
    }

    // Delete existing items if they don't exist in the updated tree.
    if (localData) {
        localData.children.forEach((local) => {
            if (!token?.isCancellationRequested) {
                const exists = updatedData.children.find(
                    (node) => local.name === node.name && local.path === node.path && local.type_ === node.type_,
                );

                if (!exists) {
                    // Delete this node and all its children.
                    const testItem = testController.items.get(local.path);
                    deleteTestTree(testController, testItem);
                }
            }
        });
    }

    // Go through the updated tree, update the existing nodes, and create new ones if necessary.
    updatedData.children.forEach((child) => {
        if (!token?.isCancellationRequested) {
            const root = testController.items.get(child.path);
            if (root) {
                root.busy = true;
                // Update existing test node or item.
                if (isTestItem(child)) {
                    // Update the only property that can be updated.
                    root.label = child.name;
                } else {
                    const localNode = localData?.children.find(
                        (node) => child.name === node.name && child.path === node.path && child.type_ === node.type_,
                    );
                    updateTestTree(testController, child, localNode as DiscoveredTestNode, root, token);
                }
                root.busy = false;
            } else {
                // Create new test node or item.
                let testItem;
                if (isTestItem(child)) {
                    testItem = testController.createTestItem(child.id_, child.name, Uri.file(child.path));
                    const range = new Range(new Position(child.lineno - 1, 0), new Position(child.lineno, 0));

                    testItem.canResolveChildren = false;
                    testItem.tags = [RunTestTag, DebugTestTag];
                    testItem.range = range;

                    testRoot!.children.add(testItem);
                } else {
                    testItem = testController.createTestItem(child.path, child.name, Uri.file(child.path));
                    testItem.canResolveChildren = true;
                    testItem.tags = [RunTestTag, DebugTestTag];

                    testRoot!.children.add(testItem);

                    // Populate the test tree under the newly created node.
                    populateTestTree(testController, child, testItem, token);
                }
            }
        }
    });
}

function populateTestTree(
    testController: TestController,
    testTreeData: DiscoveredTestNode,
    testRoot: TestItem | undefined,
    token?: CancellationToken,
): void {
    console.warn(`populate test tree:`);
    console.warn(testTreeData);
    // If testRoot is undefined, use the info of the root item of testTreeData to create a test item, and append it to the test controller.
    if (!testRoot) {
        testRoot = testController.createTestItem(testTreeData.path, testTreeData.name, Uri.file(testTreeData.path));
        testRoot.canResolveChildren = true;
        testRoot.tags = [RunTestTag, DebugTestTag];

        testController.items.add(testRoot);
    }

    // Recursively populate the tree with test data.
    testTreeData.children.forEach((child) => {
        if (!token?.isCancellationRequested) {
            if (isTestItem(child)) {
                const testItem = testController.createTestItem(child.id_, child.name, Uri.file(child.path));
                const range = new Range(new Position(child.lineno - 1, 0), new Position(child.lineno, 0));

                testItem.canResolveChildren = false;
                testItem.range = range;
                testItem.tags = [RunTestTag, DebugTestTag];

                testRoot!.children.add(testItem);
            } else {
                let node = testController.items.get(child.path);

                if (!node) {
                    node = testController.createTestItem(child.path, child.name, Uri.file(child.path));

                    node.canResolveChildren = true;
                    node.tags = [RunTestTag, DebugTestTag];

                    testRoot!.children.add(node);
                }
                populateTestTree(testController, child, node, token);
            }
        }
    });
}

function buildErrorNodeOptions(uri: Uri, message: string): ErrorTestItemOptions {
    return {
        id: `DiscoveryError:${uri.fsPath}`,
        label: `Unittest Discovery Error [${path.basename(uri.fsPath)}]`,
        error: message,
    };
}
