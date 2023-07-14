// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    Event,
    OutputChannel,
    TestController,
    TestItem,
    TestRun,
    TestRunProfileKind,
    Uri,
    WorkspaceFolder,
} from 'vscode';
import { ITestDebugLauncher, TestDiscoveryOptions } from '../../common/types';
import { IPythonExecutionFactory } from '../../../common/process/types';

export type TestRunInstanceOptions = TestRunOptions & {
    exclude?: readonly TestItem[];
    debug: boolean;
};

export enum TestDataKinds {
    Workspace,
    FolderOrFile,
    Collection,
    Case,
}

export interface TestData {
    rawId: string;
    runId: string;
    id: string;
    uri: Uri;
    parentId?: string;
    kind: TestDataKinds;
}

export const ITestDiscoveryHelper = Symbol('ITestDiscoveryHelper');
export interface ITestDiscoveryHelper {
    runTestDiscovery(options: TestDiscoveryOptions): Promise<RawDiscoveredTests[]>;
}

export type TestRefreshOptions = { forceRefresh: boolean };

export const ITestController = Symbol('ITestController');
export interface ITestController {
    refreshTestData(resource?: Uri, options?: TestRefreshOptions): Promise<void>;
    stopRefreshing(): void;
    onRefreshingCompleted: Event<void>;
    onRefreshingStarted: Event<void>;
    onRunWithoutConfiguration: Event<WorkspaceFolder[]>;
}

export interface ITestRun {
    includes: readonly TestItem[];
    excludes: readonly TestItem[];
    runKind: TestRunProfileKind;
    runInstance: TestRun;
}

export const ITestFrameworkController = Symbol('ITestFrameworkController');
export interface ITestFrameworkController {
    resolveChildren(testController: TestController, item: TestItem, token?: CancellationToken): Promise<void>;
    refreshTestData(testController: TestController, resource?: Uri, token?: CancellationToken): Promise<void>;
    runTests(
        testRun: ITestRun,
        workspace: WorkspaceFolder,
        token: CancellationToken,
        testController?: TestController,
    ): Promise<void>;
}

export const ITestsRunner = Symbol('ITestsRunner');
export interface ITestsRunner {
    runTests(
        testRun: ITestRun,
        options: TestRunOptions,
        idToRawData: Map<string, TestData>,
        testController?: TestController,
    ): Promise<void>;
}

export type TestRunOptions = {
    workspaceFolder: Uri;
    cwd: string;
    args: string[];
    token: CancellationToken;
};

// We expose these here as a convenience and to cut down on churn
// elsewhere in the code.
type RawTestNode = {
    id: string;
    name: string;
    parentid: string;
};
export type RawTestParent = RawTestNode & {
    kind: 'folder' | 'file' | 'suite' | 'function' | 'workspace';
};
type RawTestFSNode = RawTestParent & {
    kind: 'folder' | 'file';
    relpath: string;
};
export type RawTestFolder = RawTestFSNode & {
    kind: 'folder';
};
export type RawTestFile = RawTestFSNode & {
    kind: 'file';
};
export type RawTestSuite = RawTestParent & {
    kind: 'suite';
};
// function-as-a-container is for parameterized ("sub") tests.
export type RawTestFunction = RawTestParent & {
    kind: 'function';
};
export type RawTest = RawTestNode & {
    source: string;
};
export type RawDiscoveredTests = {
    rootid: string;
    root: string;
    parents: RawTestParent[];
    tests: RawTest[];
};

// New test discovery adapter types

export type DataReceivedEvent = {
    uuid: string;
    data: string;
};

export type TestDiscoveryCommand = {
    script: string;
    args: string[];
};

export type TestExecutionCommand = {
    script: string;
    args: string[];
};

export type TestCommandOptions = {
    workspaceFolder: Uri;
    cwd: string;
    command: TestDiscoveryCommand | TestExecutionCommand;
    uuid: string;
    token?: CancellationToken;
    outChannel?: OutputChannel;
    debugBool?: boolean;
    testIds?: string[];
};

export type TestCommandOptionsPytest = {
    workspaceFolder: Uri;
    cwd: string;
    commandStr: string;
    token?: CancellationToken;
    outChannel?: OutputChannel;
    debugBool?: boolean;
    testIds?: string[];
    env: { [key: string]: string | undefined };
};

/**
 * Interface describing the server that will send test commands to the Python side, and process responses.
 *
 * Consumers will call sendCommand in order to execute Python-related code,
 * and will subscribe to the onDataReceived event to wait for the results.
 */
export interface ITestServer {
    readonly onDataReceived: Event<DataReceivedEvent>;
    readonly onRunDataReceived: Event<DataReceivedEvent>;
    readonly onDiscoveryDataReceived: Event<DataReceivedEvent>;
    sendCommand(
        options: TestCommandOptions,
        runTestIdsPort?: string,
        runInstance?: TestRun,
        callback?: () => void,
    ): Promise<void>;
    serverReady(): Promise<void>;
    getPort(): number;
    createUUID(cwd: string): string;
    deleteUUID(uuid: string): void;
}
export interface ITestResultResolver {
    runIdToVSid: Map<string, string>;
    runIdToTestItem: Map<string, TestItem>;
    vsIdToRunId: Map<string, string>;
    resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): Promise<void>;
    resolveExecution(payload: ExecutionTestPayload, runInstance: TestRun): Promise<void>;
}
export interface ITestDiscoveryAdapter {
    // ** first line old method signature, second line new method signature
    discoverTests(uri: Uri): Promise<DiscoveredTestPayload>;
    discoverTests(uri: Uri, executionFactory: IPythonExecutionFactory): Promise<DiscoveredTestPayload>;
}

// interface for execution/runner adapter
export interface ITestExecutionAdapter {
    // ** first line old method signature, second line new method signature
    runTests(uri: Uri, testIds: string[], debugBool?: boolean): Promise<ExecutionTestPayload>;
    runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        runInstance?: TestRun,
        executionFactory?: IPythonExecutionFactory,
        debugLauncher?: ITestDebugLauncher,
    ): Promise<ExecutionTestPayload>;
}

// Same types as in pythonFiles/unittestadapter/utils.py
export type DiscoveredTestType = 'folder' | 'file' | 'class' | 'test';

export type DiscoveredTestCommon = {
    path: string;
    name: string;
    // Trailing underscore to avoid collision with the 'type' Python keyword.
    type_: DiscoveredTestType;
    id_: string;
};

export type DiscoveredTestItem = DiscoveredTestCommon & {
    lineno: number;
    runID: string;
};

export type DiscoveredTestNode = DiscoveredTestCommon & {
    children: (DiscoveredTestNode | DiscoveredTestItem)[];
};

export type DiscoveredTestPayload = {
    cwd: string;
    tests?: DiscoveredTestNode;
    status: 'success' | 'error';
    error?: string[];
};

export type ExecutionTestPayload = {
    cwd: string;
    status: 'success' | 'error';
    result?: {
        [testRunID: string]: {
            test?: string;
            outcome?: string;
            message?: string;
            traceback?: string;
            subtest?: string;
        };
    };
    notFound?: string[];
    error: string;
};
