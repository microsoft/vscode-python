// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import {
    TestItem,
    Uri,
    Range,
    Position,
    TestController,
    TestRunResult,
    TestResultState,
    TestResultSnapshot,
} from 'vscode';
import { traceError, traceVerbose } from '../../../common/logger';
import {
    RawDiscoveredTests,
    RawTest,
    RawTestFile,
    RawTestFolder,
    RawTestFunction,
    RawTestSuite,
    TestData,
    TestDataKinds,
} from './types';

export function removeItemByIdFromChildren(
    idToRawData: Map<string, TestData>,
    item: TestItem,
    childNodeIdsToRemove: string[],
): void {
    childNodeIdsToRemove.forEach((id) => {
        item.children.delete(id);
        idToRawData.delete(id);
    });
}

export function createErrorTestItem(
    testController: TestController,
    options: { id: string; label: string; error: string },
): TestItem {
    const testItem = testController.createTestItem(options.id, options.label);
    testItem.canResolveChildren = false;
    testItem.error = options.error;
    return testItem;
}

export function createWorkspaceRootTestItem(
    testController: TestController,
    idToRawData: Map<string, TestData>,
    options: { id: string; label: string; uri: Uri; runId: string; parentId?: string; rawId?: string },
): TestItem {
    const testItem = testController.createTestItem(options.id, options.label, options.uri);
    testItem.description = options.uri.fsPath;
    testItem.canResolveChildren = true;
    idToRawData.set(options.id, {
        ...options,
        rawId: options.rawId ?? options.id,
        kind: TestDataKinds.Workspace,
    });
    return testItem;
}

function getParentIdFromRawParentId(
    idToRawData: Map<string, TestData>,
    testRoot: string,
    raw: { parentid: string },
): string | undefined {
    const parent = idToRawData.get(path.join(testRoot, raw.parentid));
    let parentId;
    if (parent) {
        parentId = parent.id === '.' ? testRoot : parent.id;
    }
    return parentId;
}

function getRangeFromRawSource(raw: { source: string }): Range | undefined {
    // We have to extract the line number from the source data. If it is available it
    // saves us from running symbol script or querying language server for this info.
    try {
        const sourceLine = raw.source.substr(raw.source.indexOf(':') + 1);
        const line = Number.parseInt(sourceLine, 10);
        // Lines in raw data start at 1, vscode lines start at 0
        return new Range(new Position(line - 1, 0), new Position(line, 0));
    } catch (ex) {
        // ignore
    }
    return undefined;
}

function getRunIdFromRawData(raw: { id: string }): string {
    // This is the id that will be used to compare with the results.
    const runId = raw.id
        .replace(/[\\\:\/]/g, '.')
        .replace(/\:\:/g, '.')
        .replace(/\.\./g, '.')
        .replace(/\.py/g, '');
    return runId.startsWith('.') ? runId.substr(1) : runId;
}

function createFolderOrFileTestItem(
    testController: TestController,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawData: RawTestFolder | RawTestFile,
): TestItem {
    const fullPath = path.join(testRoot, rawData.relpath);
    const uri = Uri.file(fullPath);

    const parentId = getParentIdFromRawParentId(idToRawData, testRoot, rawData);

    const label = path.basename(fullPath);
    const testItem = testController.createTestItem(fullPath, label, uri);

    testItem.description = fullPath;
    testItem.canResolveChildren = true;

    idToRawData.set(testItem.id, {
        id: testItem.id,
        rawId: rawData.id,
        runId: rawData.relpath,
        uri,
        kind: TestDataKinds.FolderOrFile,
        parentId,
    });
    return testItem;
}

function updateFolderOrFileTestItem(
    item: TestItem,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawData: RawTestFolder | RawTestFile,
): void {
    const fullPath = path.join(testRoot, rawData.relpath);
    const uri = Uri.file(fullPath);

    const parentId = getParentIdFromRawParentId(idToRawData, testRoot, rawData);

    item.label = path.basename(fullPath);

    item.description = fullPath;
    item.canResolveChildren = true;

    idToRawData.set(item.id, {
        id: item.id,
        rawId: rawData.id,
        runId: rawData.relpath,
        uri,
        kind: TestDataKinds.FolderOrFile,
        parentId,
    });
}

function createCollectionTestItem(
    testController: TestController,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawData: RawTestSuite | RawTestFunction,
): TestItem {
    // id can look like test_something.py::SomeClass
    const id = path.join(testRoot, rawData.id);

    // We need the actual document path so we can set the location for the tests. This will be
    // used to provide test result status next to the tests.
    const documentPath = path.join(testRoot, rawData.id.substr(0, rawData.id.indexOf(':')));
    const uri = Uri.file(documentPath);

    const label = rawData.name;

    const parentId = getParentIdFromRawParentId(idToRawData, testRoot, rawData);
    const runId = getRunIdFromRawData(rawData);

    const testItem = testController.createTestItem(id, label, uri);

    testItem.description = id;
    testItem.canResolveChildren = true;

    idToRawData.set(testItem.id, {
        id: testItem.id,
        rawId: rawData.id,
        runId,
        uri,
        kind: TestDataKinds.Collection,
        parentId,
    });
    return testItem;
}

function updateCollectionTestItem(
    item: TestItem,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawData: RawTestSuite | RawTestFunction,
): void {
    // id can look like test_something.py::SomeClass
    const id = path.join(testRoot, rawData.id);

    // We need the actual document path so we can set the location for the tests. This will be
    // used to provide test result status next to the tests.
    const documentPath = path.join(testRoot, rawData.id.substr(0, rawData.id.indexOf(':')));
    const uri = Uri.file(documentPath);

    item.label = rawData.name;

    const parentId = getParentIdFromRawParentId(idToRawData, testRoot, rawData);
    const runId = getRunIdFromRawData(rawData);

    item.description = id;
    item.canResolveChildren = true;

    idToRawData.set(item.id, {
        id: item.id,
        rawId: rawData.id,
        runId,
        uri,
        kind: TestDataKinds.Collection,
        parentId,
    });
}

function createTestCaseItem(
    testController: TestController,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawData: RawTest,
): TestItem {
    // id can look like:
    // test_something.py::SomeClass::someTest
    // test_something.py::SomeClass::someTest[x1]
    const id = path.join(testRoot, rawData.id);

    // We need the actual document path so we can set the location for the tests. This will be
    // used to provide test result status next to the tests.
    const documentPath = path.join(testRoot, rawData.source.substr(0, rawData.source.indexOf(':')));
    const uri = Uri.file(documentPath);

    const label = rawData.name;

    const parentId = getParentIdFromRawParentId(idToRawData, testRoot, rawData);
    const runId = getRunIdFromRawData(rawData);

    const testItem = testController.createTestItem(id, label, uri);

    testItem.description = id;
    testItem.canResolveChildren = false;
    testItem.range = getRangeFromRawSource(rawData);

    idToRawData.set(testItem.id, {
        id: testItem.id,
        rawId: rawData.id,
        runId,
        uri,
        kind: TestDataKinds.Case,
        parentId,
    });
    return testItem;
}

function updateTestCaseItem(
    item: TestItem,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawData: RawTest,
): void {
    // id can look like:
    // test_something.py::SomeClass::someTest
    // test_something.py::SomeClass::someTest[x1]
    const id = path.join(testRoot, rawData.id);

    // We need the actual document path so we can set the location for the tests. This will be
    // used to provide test result status next to the tests.
    const documentPath = path.join(testRoot, rawData.source.substr(0, rawData.source.indexOf(':')));
    const uri = Uri.file(documentPath);

    item.label = rawData.name;

    const parentId = getParentIdFromRawParentId(idToRawData, testRoot, rawData);
    const runId = getRunIdFromRawData(rawData);

    item.description = id;
    item.canResolveChildren = false;
    item.range = getRangeFromRawSource(rawData);

    idToRawData.set(item.id, {
        id: item.id,
        rawId: rawData.id,
        runId,
        uri,
        kind: TestDataKinds.Case,
        parentId,
    });
}

function updateTestItemFromRawDataInternal(
    item: TestItem,
    testController: TestController,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawDataSet: RawDiscoveredTests[],
): void {
    const rawId = idToRawData.get(item.id)?.rawId;
    if (!rawId) {
        traceError(`Unknown node id: ${item.id}`);
        return;
    }

    const nodeRawData = rawDataSet.filter(
        (r) =>
            r.root === rawId ||
            r.rootid === rawId ||
            r.parents.find((p) => p.id === rawId) ||
            r.tests.find((t) => t.id === rawId),
    );

    if (nodeRawData.length === 0 && item.parent) {
        removeItemByIdFromChildren(idToRawData, item.parent, [item.id]);
        traceVerbose(`Following test item was removed Reason: No-Raw-Data ${item.id}`);
        return;
    }

    if (nodeRawData.length > 1) {
        // Something is wrong, there can only be one test node with that id
        traceError(`Multiple (${nodeRawData.length}) raw data nodes had the same id: ${rawId}`);
        return;
    }

    if (rawId === nodeRawData[0].root || rawId === nodeRawData[0].rootid) {
        // This is a test root node, we need to update the entire tree
        // The update children and remove any child that does not have raw data.
        item.children.forEach((c) => updateTestItemFromRawData(c, testController, idToRawData, testRoot, nodeRawData));

        // Create child nodes that are new.
        // We only need to look at rawData.parents. Since at this level we either have folder or file.
        const rawChildNodes = nodeRawData[0].parents.filter((p) => p.parentid === '.' || p.parentid === rawId);
        const existingNodes: string[] = [];
        item.children.forEach((c) => existingNodes.push(idToRawData.get(c.id)?.rawId ?? ''));

        rawChildNodes
            .filter((r) => !existingNodes.includes(r.id))
            .forEach((r) => {
                const childItem =
                    r.kind === 'file'
                        ? createFolderOrFileTestItem(testController, idToRawData, testRoot, r as RawTestFile)
                        : createFolderOrFileTestItem(testController, idToRawData, testRoot, r as RawTestFolder);
                item.children.add(childItem);
                updateTestItemFromRawData(childItem, testController, idToRawData, testRoot, nodeRawData);
            });

        return;
    }

    // First check if this is a parent node
    const rawData = nodeRawData[0].parents.filter((r) => r.id === rawId);
    if (rawData.length === 1) {
        // This is either a File/Folder/Collection node

        // Update the node data
        switch (rawData[0].kind) {
            case 'file':
                updateFolderOrFileTestItem(item, idToRawData, testRoot, rawData[0] as RawTestFile);
                break;
            case 'folder':
                updateFolderOrFileTestItem(item, idToRawData, testRoot, rawData[0] as RawTestFolder);
                break;
            case 'suite':
                updateCollectionTestItem(item, idToRawData, testRoot, rawData[0] as RawTestSuite);
                break;
            case 'function':
                updateCollectionTestItem(item, idToRawData, testRoot, rawData[0] as RawTestFunction);
                break;
            default:
                break;
        }

        // The update children and remove any child that does not have raw data.
        item.children.forEach((c) => updateTestItemFromRawData(c, testController, idToRawData, testRoot, nodeRawData));

        // Create child nodes that are new.
        // Get the existing child node ids so we can skip them
        const existingNodes: string[] = [];
        item.children.forEach((c) => existingNodes.push(idToRawData.get(c.id)?.rawId ?? ''));

        // We first look at rawData.parents. Since at this level we either have folder or file.
        // The current node is potentially a parent of one of these "parent" nodes or it is a parent
        // of test case nodes. We will handle Test case nodes after handling parents.
        const rawChildNodes = nodeRawData[0].parents.filter((p) => p.parentid === rawId);
        rawChildNodes
            .filter((r) => !existingNodes.includes(r.id))
            .forEach((r) => {
                let childItem;
                switch (r.kind) {
                    case 'file':
                        childItem = createFolderOrFileTestItem(testController, idToRawData, testRoot, r as RawTestFile);
                        break;
                    case 'folder':
                        childItem = createFolderOrFileTestItem(
                            testController,
                            idToRawData,
                            testRoot,
                            r as RawTestFolder,
                        );
                        break;
                    case 'suite':
                        childItem = createCollectionTestItem(testController, idToRawData, testRoot, r as RawTestSuite);
                        break;
                    case 'function':
                        childItem = createCollectionTestItem(
                            testController,
                            idToRawData,
                            testRoot,
                            r as RawTestFunction,
                        );
                        break;
                    default:
                        break;
                }
                if (childItem) {
                    item.children.add(childItem);
                    // This node can potentially have children. So treat it like a new node and update it.
                    updateTestItemFromRawData(childItem, testController, idToRawData, testRoot, nodeRawData);
                }
            });

        // Now we will look at test case nodes. Create any test case node that does not already exist.
        const rawTestCaseNodes = nodeRawData[0].tests.filter((p) => p.parentid === rawId);
        rawTestCaseNodes
            .filter((r) => !existingNodes.includes(r.id))
            .forEach((r) => {
                const childItem = createTestCaseItem(testController, idToRawData, testRoot, r);
                item.children.add(childItem);
            });

        return;
    }

    if (rawData.length > 1) {
        // Something is wrong, there can only be one test node with that id
        traceError(`Multiple (${rawData.length}) raw data nodes had the same id: ${rawId}`);
        return;
    }

    // We are here this means rawData.length === 0
    // The node is probably is test case node. Try and find it.
    const rawCaseData = nodeRawData[0].tests.filter((r) => r.id === rawId);

    if (rawCaseData.length === 1) {
        // This is a test case node
        updateTestCaseItem(item, idToRawData, testRoot, rawCaseData[0]);
        return;
    }

    if (rawCaseData.length > 1) {
        // Something is wrong, there can only be one test node with that id
        traceError(`Multiple (${rawCaseData.length}) raw data nodes had the same id: ${rawId}`);
    }
}

export function updateTestItemFromRawData(
    item: TestItem,
    testController: TestController,
    idToRawData: Map<string, TestData>,
    testRoot: string,
    rawDataSet: RawDiscoveredTests[],
): void {
    item.busy = true;
    updateTestItemFromRawDataInternal(item, testController, idToRawData, testRoot, rawDataSet);
    item.busy = false;
}

export function getUri(node: TestItem): Uri | undefined {
    if (!node.uri && node.parent) {
        return getUri(node.parent);
    }
    return node.uri;
}

export function getTestCaseNodes(testNode: TestItem, collection: TestItem[] = []): TestItem[] {
    if (!testNode.canResolveChildren) {
        collection.push(testNode);
    }

    testNode.children.forEach((c) => {
        if (testNode.canResolveChildren) {
            getTestCaseNodes(c, collection);
        } else {
            collection.push(testNode);
        }
    });
    return collection;
}

export function getWorkspaceNode(testNode: TestItem, idToRawData: Map<string, TestData>): TestItem | undefined {
    const raw = idToRawData.get(testNode.id);
    if (raw) {
        if (raw.kind === TestDataKinds.Workspace) {
            return testNode;
        }
        if (testNode.parent) {
            return getWorkspaceNode(testNode.parent, idToRawData);
        }
    }
    return undefined;
}

export function getNodeByUri(root: TestItem, uri: Uri): TestItem | undefined {
    if (root.uri?.fsPath === uri.fsPath) {
        return root;
    }

    const nodes: TestItem[] = [];
    root.children.forEach((c) => nodes.push(c));

    // Search at the current level
    for (const node of nodes) {
        if (node.uri?.fsPath === uri.fsPath) {
            return node;
        }
    }

    // Search the children of the current level
    for (const node of nodes) {
        const found = getNodeByUri(node, uri);
        if (found) {
            return found;
        }
    }
    return undefined;
}

function UpdateTestResultMapForSnapshot(resultMap: Map<string, TestResultState>, snapshot: TestResultSnapshot) {
    for (const taskState of snapshot.taskStates) {
        resultMap.set(snapshot.id, taskState.state);
    }
    snapshot.children.forEach((child) => UpdateTestResultMapForSnapshot(resultMap, child));
}

export function UpdateTestResultMap(
    resultMap: Map<string, TestResultState>,
    testResults: readonly TestRunResult[],
): void {
    const ordered = new Array(...testResults).sort((a, b) => a.completedAt - b.completedAt);
    ordered.forEach((testResult) => {
        testResult.results.forEach((snapshot) => UpdateTestResultMapForSnapshot(resultMap, snapshot));
    });
}

export function CheckForFailedTests(resultMap: Map<string, TestResultState>): boolean {
    return (
        Array.from(resultMap.values()).find(
            (state) => state === TestResultState.Failed || state === TestResultState.Errored,
        ) !== undefined
    );
}
