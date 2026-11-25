// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Centralized mock utilities for testing testController components.
 * Re-use these helpers across multiple test files for consistency.
 */

import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { TestItem, TestItemCollection, TestRun, Uri } from 'vscode';
import { IPythonExecutionFactory } from '../../../client/common/process/types';
import { ITestDebugLauncher } from '../../../client/testing/common/types';
import { ProjectAdapter } from '../../../client/testing/testController/common/projectAdapter';
import { ProjectExecutionDependencies } from '../../../client/testing/testController/common/projectTestExecution';
import { TestProjectRegistry } from '../../../client/testing/testController/common/testProjectRegistry';
import { ITestExecutionAdapter, ITestResultResolver } from '../../../client/testing/testController/common/types';

/**
 * Creates a mock TestItem with configurable properties.
 * @param id - The unique ID of the test item
 * @param uriPath - The file path for the test item's URI
 * @param children - Optional array of child test items
 */
export function createMockTestItem(id: string, uriPath: string, children?: TestItem[]): TestItem {
    const childMap = new Map<string, TestItem>();
    children?.forEach((c) => childMap.set(c.id, c));

    const mockChildren: TestItemCollection = {
        size: childMap.size,
        forEach: (callback: (item: TestItem, collection: TestItemCollection) => void) => {
            childMap.forEach((item) => callback(item, mockChildren));
        },
        get: (itemId: string) => childMap.get(itemId),
        add: () => {},
        delete: () => {},
        replace: () => {},
        [Symbol.iterator]: function* () {
            for (const [key, value] of childMap) {
                yield [key, value] as [string, TestItem];
            }
        },
    } as TestItemCollection;

    return ({
        id,
        uri: Uri.file(uriPath),
        children: mockChildren,
        label: id,
        canResolveChildren: false,
        busy: false,
        tags: [],
        range: undefined,
        error: undefined,
        parent: undefined,
    } as unknown) as TestItem;
}

/**
 * Creates a mock TestItem without a URI.
 * Useful for testing edge cases where test items have no associated file.
 * @param id - The unique ID of the test item
 */
export function createMockTestItemWithoutUri(id: string): TestItem {
    return ({
        id,
        uri: undefined,
        children: ({ size: 0, forEach: () => {} } as unknown) as TestItemCollection,
        label: id,
    } as unknown) as TestItem;
}

export interface MockProjectAdapterConfig {
    projectPath: string;
    projectName: string;
    pythonPath?: string;
    testProvider?: 'pytest' | 'unittest';
}

export type MockProjectAdapter = ProjectAdapter & { executionAdapterStub: sinon.SinonStub };

/**
 * Creates a mock ProjectAdapter for testing project-based test execution.
 * @param config - Configuration object with project details
 * @returns A mock ProjectAdapter with an exposed executionAdapterStub for verification
 */
export function createMockProjectAdapter(config: MockProjectAdapterConfig): MockProjectAdapter {
    const runTestsStub = sinon.stub().resolves();
    const executionAdapter: ITestExecutionAdapter = ({
        runTests: runTestsStub,
    } as unknown) as ITestExecutionAdapter;

    const resultResolverMock: ITestResultResolver = ({
        vsIdToRunId: new Map<string, string>(),
        runIdToVSid: new Map<string, string>(),
        runIdToTestItem: new Map<string, TestItem>(),
        detailedCoverageMap: new Map(),
        resolveDiscovery: () => Promise.resolve(),
        resolveExecution: () => {},
    } as unknown) as ITestResultResolver;

    const adapter = ({
        projectUri: Uri.file(config.projectPath),
        projectName: config.projectName,
        workspaceUri: Uri.file(config.projectPath),
        testProvider: config.testProvider ?? 'pytest',
        pythonEnvironment: config.pythonPath
            ? {
                  execInfo: { run: { executable: config.pythonPath } },
              }
            : undefined,
        pythonProject: {
            name: config.projectName,
            uri: Uri.file(config.projectPath),
        },
        executionAdapter,
        discoveryAdapter: {} as any,
        resultResolver: resultResolverMock,
        isDiscovering: false,
        isExecuting: false,
        // Expose the stub for testing
        executionAdapterStub: runTestsStub,
    } as unknown) as MockProjectAdapter;

    return adapter;
}

/**
 * Creates mock dependencies for project test execution.
 * @returns An object containing mocked ProjectExecutionDependencies
 */
export function createMockDependencies(): ProjectExecutionDependencies {
    return {
        projectRegistry: typemoq.Mock.ofType<TestProjectRegistry>().object,
        pythonExecFactory: typemoq.Mock.ofType<IPythonExecutionFactory>().object,
        debugLauncher: typemoq.Mock.ofType<ITestDebugLauncher>().object,
    };
}

/**
 * Creates a mock TestRun with common setup methods.
 * @returns A TypeMoq mock of TestRun
 */
export function createMockTestRun(): typemoq.IMock<TestRun> {
    const runMock = typemoq.Mock.ofType<TestRun>();
    runMock.setup((r) => r.started(typemoq.It.isAny()));
    runMock.setup((r) => r.passed(typemoq.It.isAny(), typemoq.It.isAny()));
    runMock.setup((r) => r.failed(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()));
    runMock.setup((r) => r.skipped(typemoq.It.isAny()));
    runMock.setup((r) => r.end());
    return runMock;
}
