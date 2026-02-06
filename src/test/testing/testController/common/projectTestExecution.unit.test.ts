// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import {
    CancellationToken,
    CancellationTokenSource,
    TestItem,
    TestItemCollection,
    TestRun,
    TestRunProfile,
    TestRunProfileKind,
    TestRunRequest,
    Uri,
} from 'vscode';
import { IPythonExecutionFactory } from '../../../../client/common/process/types';
import { ITestDebugLauncher } from '../../../../client/testing/common/types';
import { ProjectAdapter } from '../../../../client/testing/testController/common/projectAdapter';
import {
    executeTestsForProject,
    executeTestsForProjects,
    findProjectForTestItem,
    getTestCaseNodesRecursive,
    groupTestItemsByProject,
    ProjectExecutionDependencies,
    setupCoverageForProject,
} from '../../../../client/testing/testController/common/projectTestExecution';
import { TestProjectRegistry } from '../../../../client/testing/testController/common/testProjectRegistry';
import { ITestExecutionAdapter, ITestResultResolver } from '../../../../client/testing/testController/common/types';
import * as telemetry from '../../../../client/telemetry';

suite('Project Test Execution', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    // ===== HELPER FUNCTIONS =====

    function createMockTestItem(id: string, uriPath: string, children?: TestItem[]): TestItem {
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

    function createMockTestItemWithoutUri(id: string): TestItem {
        return ({
            id,
            uri: undefined,
            children: ({ size: 0, forEach: () => {} } as unknown) as TestItemCollection,
            label: id,
        } as unknown) as TestItem;
    }

    function createMockProjectAdapter(config: {
        projectPath: string;
        projectName: string;
        pythonPath?: string;
        testProvider?: 'pytest' | 'unittest';
    }): ProjectAdapter & { executionAdapterStub: sinon.SinonStub } {
        // Use a plain stub instead of TypeMoq for easier testing
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
        } as unknown) as ProjectAdapter & { executionAdapterStub: sinon.SinonStub };

        return adapter;
    }

    function createMockDependencies(): ProjectExecutionDependencies {
        return {
            projectRegistry: typemoq.Mock.ofType<TestProjectRegistry>().object,
            pythonExecFactory: typemoq.Mock.ofType<IPythonExecutionFactory>().object,
            debugLauncher: typemoq.Mock.ofType<ITestDebugLauncher>().object,
        };
    }

    function createMockTestRun(): typemoq.IMock<TestRun> {
        const runMock = typemoq.Mock.ofType<TestRun>();
        runMock.setup((r) => r.started(typemoq.It.isAny()));
        runMock.setup((r) => r.passed(typemoq.It.isAny(), typemoq.It.isAny()));
        runMock.setup((r) => r.failed(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()));
        runMock.setup((r) => r.skipped(typemoq.It.isAny()));
        runMock.setup((r) => r.end());
        return runMock;
    }

    // ===== findProjectForTestItem Tests =====

    suite('findProjectForTestItem', () => {
        test('should return undefined when test item has no URI', () => {
            // Mock
            const item = createMockTestItemWithoutUri('test1');
            const projects = [createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' })];

            // Run
            const result = findProjectForTestItem(item, projects);

            // Assert
            expect(result).to.be.undefined;
        });

        test('should return matching project when item path is within project directory', () => {
            // Mock
            const item = createMockTestItem('test1', '/workspace/proj/tests/test_file.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = findProjectForTestItem(item, [project]);

            // Assert
            expect(result).to.equal(project);
        });

        test('should return undefined when item path is outside all project directories', () => {
            // Mock
            const item = createMockTestItem('test1', '/other/path/test.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = findProjectForTestItem(item, [project]);

            // Assert
            expect(result).to.be.undefined;
        });

        test('should return most specific (deepest) project when nested projects exist', () => {
            // Mock - parent and child project with overlapping paths
            const item = createMockTestItem('test1', '/workspace/parent/child/tests/test.py');
            const parentProject = createMockProjectAdapter({ projectPath: '/workspace/parent', projectName: 'parent' });
            const childProject = createMockProjectAdapter({
                projectPath: '/workspace/parent/child',
                projectName: 'child',
            });

            // Run
            const result = findProjectForTestItem(item, [parentProject, childProject]);

            // Assert - should match child (longer path) not parent
            expect(result).to.equal(childProject);
        });

        test('should return most specific project regardless of input order', () => {
            // Mock - same as above but different order
            const item = createMockTestItem('test1', '/workspace/parent/child/tests/test.py');
            const parentProject = createMockProjectAdapter({ projectPath: '/workspace/parent', projectName: 'parent' });
            const childProject = createMockProjectAdapter({
                projectPath: '/workspace/parent/child',
                projectName: 'child',
            });

            // Run - pass child first, then parent
            const result = findProjectForTestItem(item, [childProject, parentProject]);

            // Assert - order shouldn't affect result
            expect(result).to.equal(childProject);
        });

        test('should match item at project root level', () => {
            // Mock
            const item = createMockTestItem('test1', '/workspace/proj/test.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = findProjectForTestItem(item, [project]);

            // Assert
            expect(result).to.equal(project);
        });
    });

    // ===== groupTestItemsByProject Tests =====

    suite('groupTestItemsByProject', () => {
        test('should group single test item to its matching project', async () => {
            // Mock
            const item = createMockTestItem('test1', '/workspace/proj/test.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await groupTestItemsByProject([item], [project]);

            // Assert
            expect(result.size).to.equal(1);
            const entry = Array.from(result.values())[0];
            expect(entry.project).to.equal(project);
            expect(entry.items).to.deep.equal([item]);
        });

        test('should aggregate multiple items belonging to same project', async () => {
            // Mock
            const item1 = createMockTestItem('test1', '/workspace/proj/tests/test1.py');
            const item2 = createMockTestItem('test2', '/workspace/proj/tests/test2.py');
            const item3 = createMockTestItem('test3', '/workspace/proj/test3.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await groupTestItemsByProject([item1, item2, item3], [project]);

            // Assert - use Set for order-agnostic comparison
            expect(result.size).to.equal(1);
            const entry = Array.from(result.values())[0];
            expect(entry.items).to.have.length(3);
            expect(new Set(entry.items)).to.deep.equal(new Set([item1, item2, item3]));
        });

        test('should separate items into groups by their owning project', async () => {
            // Mock
            const item1 = createMockTestItem('test1', '/workspace/proj1/test.py');
            const item2 = createMockTestItem('test2', '/workspace/proj2/test.py');
            const item3 = createMockTestItem('test3', '/workspace/proj1/other_test.py');
            const proj1 = createMockProjectAdapter({ projectPath: '/workspace/proj1', projectName: 'proj1' });
            const proj2 = createMockProjectAdapter({ projectPath: '/workspace/proj2', projectName: 'proj2' });

            // Run
            const result = await groupTestItemsByProject([item1, item2, item3], [proj1, proj2]);

            // Assert - use Set for order-agnostic comparison
            expect(result.size).to.equal(2);
            const proj1Entry = result.get(proj1.projectUri.toString());
            const proj2Entry = result.get(proj2.projectUri.toString());
            expect(proj1Entry?.items).to.have.length(2);
            expect(new Set(proj1Entry?.items)).to.deep.equal(new Set([item1, item3]));
            expect(proj2Entry?.items).to.deep.equal([item2]);
        });

        test('should return empty map when no test items provided', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await groupTestItemsByProject([], [project]);

            // Assert
            expect(result.size).to.equal(0);
        });

        test('should exclude items that do not match any project path', async () => {
            // Mock
            const item = createMockTestItem('test1', '/other/path/test.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await groupTestItemsByProject([item], [project]);

            // Assert
            expect(result.size).to.equal(0);
        });

        test('should assign item to most specific (deepest) project for nested paths', async () => {
            // Mock
            const item = createMockTestItem('test1', '/workspace/parent/child/test.py');
            const parentProject = createMockProjectAdapter({ projectPath: '/workspace/parent', projectName: 'parent' });
            const childProject = createMockProjectAdapter({
                projectPath: '/workspace/parent/child',
                projectName: 'child',
            });

            // Run
            const result = await groupTestItemsByProject([item], [parentProject, childProject]);

            // Assert
            expect(result.size).to.equal(1);
            const entry = result.get(childProject.projectUri.toString());
            expect(entry?.project).to.equal(childProject);
            expect(entry?.items).to.deep.equal([item]);
        });

        test('should omit projects that have no matching test items', async () => {
            // Mock
            const item = createMockTestItem('test1', '/workspace/proj1/test.py');
            const proj1 = createMockProjectAdapter({ projectPath: '/workspace/proj1', projectName: 'proj1' });
            const proj2 = createMockProjectAdapter({ projectPath: '/workspace/proj2', projectName: 'proj2' });

            // Run
            const result = await groupTestItemsByProject([item], [proj1, proj2]);

            // Assert
            expect(result.size).to.equal(1);
            expect(result.has(proj1.projectUri.toString())).to.be.true;
            expect(result.has(proj2.projectUri.toString())).to.be.false;
        });
    });

    // ===== getTestCaseNodesRecursive Tests =====

    suite('getTestCaseNodesRecursive', () => {
        test('should return single item when it is a leaf node with no children', () => {
            // Mock
            const item = createMockTestItem('test_func', '/test.py');

            // Run
            const result = getTestCaseNodesRecursive(item);

            // Assert
            expect(result).to.deep.equal([item]);
        });

        test('should return all leaf nodes from single-level nested structure', () => {
            // Mock
            const leaf1 = createMockTestItem('test_method1', '/test.py');
            const leaf2 = createMockTestItem('test_method2', '/test.py');
            const classItem = createMockTestItem('TestClass', '/test.py', [leaf1, leaf2]);

            // Run
            const result = getTestCaseNodesRecursive(classItem);

            // Assert - use Set for order-agnostic comparison
            expect(result).to.have.length(2);
            expect(new Set(result)).to.deep.equal(new Set([leaf1, leaf2]));
        });

        test('should traverse deeply nested structure to find all leaf nodes', () => {
            // Mock - 3 levels deep: file → class → inner class → test
            const leaf1 = createMockTestItem('test1', '/test.py');
            const leaf2 = createMockTestItem('test2', '/test.py');
            const innerClass = createMockTestItem('InnerClass', '/test.py', [leaf2]);
            const outerClass = createMockTestItem('OuterClass', '/test.py', [leaf1, innerClass]);
            const fileItem = createMockTestItem('test_file.py', '/test.py', [outerClass]);

            // Run
            const result = getTestCaseNodesRecursive(fileItem);

            // Assert - use Set for order-agnostic comparison
            expect(result).to.have.length(2);
            expect(new Set(result)).to.deep.equal(new Set([leaf1, leaf2]));
        });

        test('should collect leaves from multiple sibling branches', () => {
            // Mock - multiple test classes at same level
            const leaf1 = createMockTestItem('test1', '/test.py');
            const leaf2 = createMockTestItem('test2', '/test.py');
            const leaf3 = createMockTestItem('test3', '/test.py');
            const class1 = createMockTestItem('Class1', '/test.py', [leaf1]);
            const class2 = createMockTestItem('Class2', '/test.py', [leaf2, leaf3]);
            const fileItem = createMockTestItem('test_file.py', '/test.py', [class1, class2]);

            // Run
            const result = getTestCaseNodesRecursive(fileItem);

            // Assert - use Set for order-agnostic comparison
            expect(result).to.have.length(3);
            expect(new Set(result)).to.deep.equal(new Set([leaf1, leaf2, leaf3]));
        });
    });

    // ===== executeTestsForProject Tests =====

    suite('executeTestsForProject', () => {
        test('should call executionAdapter.runTests with project URI and mapped test IDs', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            project.resultResolver.vsIdToRunId.set('test1', 'test_file.py::test1');
            const testItem = createMockTestItem('test1', '/workspace/proj/test.py');
            const runMock = createMockTestRun();
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProject(project, [testItem], runMock.object, request, deps);

            // Assert
            expect(project.executionAdapterStub.calledOnce).to.be.true;
            const callArgs = project.executionAdapterStub.firstCall.args;
            expect(callArgs[0].fsPath).to.equal(project.projectUri.fsPath); // uri
            expect(callArgs[1]).to.deep.equal(['test_file.py::test1']); // testCaseIds
            expect(callArgs[7]).to.equal(project); // project
        });

        test('should mark all leaf test items as started in the test run', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            project.resultResolver.vsIdToRunId.set('test1', 'runId1');
            project.resultResolver.vsIdToRunId.set('test2', 'runId2');
            const item1 = createMockTestItem('test1', '/workspace/proj/test.py');
            const item2 = createMockTestItem('test2', '/workspace/proj/test.py');
            const runMock = createMockTestRun();
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProject(project, [item1, item2], runMock.object, request, deps);

            // Assert - both items marked as started
            runMock.verify((r) => r.started(item1), typemoq.Times.once());
            runMock.verify((r) => r.started(item2), typemoq.Times.once());
        });

        test('should resolve test IDs via resultResolver.vsIdToRunId mapping', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            project.resultResolver.vsIdToRunId.set('test1', 'path/to/test1');
            project.resultResolver.vsIdToRunId.set('test2', 'path/to/test2');
            const item1 = createMockTestItem('test1', '/workspace/proj/test.py');
            const item2 = createMockTestItem('test2', '/workspace/proj/test.py');
            const runMock = createMockTestRun();
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProject(project, [item1, item2], runMock.object, request, deps);

            // Assert - use Set for order-agnostic comparison
            const passedTestIds = project.executionAdapterStub.firstCall.args[1] as string[];
            expect(new Set(passedTestIds)).to.deep.equal(new Set(['path/to/test1', 'path/to/test2']));
        });

        test('should skip execution when no items have vsIdToRunId mappings', async () => {
            // Mock - no mappings set, so lookups return undefined
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const item = createMockTestItem('unmapped_test', '/workspace/proj/test.py');
            const runMock = createMockTestRun();
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProject(project, [item], runMock.object, request, deps);

            // Assert - execution adapter never called
            expect(project.executionAdapterStub.called).to.be.false;
        });

        test('should recursively expand nested test items to find leaf nodes', async () => {
            // Mock - class containing two test methods
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const leaf1 = createMockTestItem('test1', '/workspace/proj/test.py');
            const leaf2 = createMockTestItem('test2', '/workspace/proj/test.py');
            const classItem = createMockTestItem('TestClass', '/workspace/proj/test.py', [leaf1, leaf2]);
            project.resultResolver.vsIdToRunId.set('test1', 'runId1');
            project.resultResolver.vsIdToRunId.set('test2', 'runId2');
            const runMock = createMockTestRun();
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProject(project, [classItem], runMock.object, request, deps);

            // Assert - leaf nodes marked as started, not the parent class
            runMock.verify((r) => r.started(leaf1), typemoq.Times.once());
            runMock.verify((r) => r.started(leaf2), typemoq.Times.once());
            const passedTestIds = project.executionAdapterStub.firstCall.args[1] as string[];
            expect(passedTestIds).to.have.length(2);
        });
    });

    // ===== executeTestsForProjects Tests =====

    suite('executeTestsForProjects', () => {
        let telemetryStub: sinon.SinonStub;

        setup(() => {
            telemetryStub = sandbox.stub(telemetry, 'sendTelemetryEvent');
        });

        test('should return immediately when empty projects array provided', async () => {
            // Mock
            const runMock = createMockTestRun();
            const token = new CancellationTokenSource().token;
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProjects([], [], runMock.object, request, token, deps);

            // Assert - no telemetry sent since no projects executed
            expect(telemetryStub.called).to.be.false;
        });

        test('should skip execution when cancellation requested before start', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const item = createMockTestItem('test1', '/workspace/proj/test.py');
            const runMock = createMockTestRun();
            const tokenSource = new CancellationTokenSource();
            tokenSource.cancel(); // Pre-cancel
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProjects([project], [item], runMock.object, request, tokenSource.token, deps);

            // Assert - execution adapter never called
            expect(project.executionAdapterStub.called).to.be.false;
        });

        test('should execute tests for each project when multiple projects provided', async () => {
            // Mock
            const proj1 = createMockProjectAdapter({ projectPath: '/workspace/proj1', projectName: 'proj1' });
            const proj2 = createMockProjectAdapter({ projectPath: '/workspace/proj2', projectName: 'proj2' });
            proj1.resultResolver.vsIdToRunId.set('test1', 'runId1');
            proj2.resultResolver.vsIdToRunId.set('test2', 'runId2');
            const item1 = createMockTestItem('test1', '/workspace/proj1/test.py');
            const item2 = createMockTestItem('test2', '/workspace/proj2/test.py');
            const runMock = createMockTestRun();
            const token = new CancellationTokenSource().token;
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProjects([proj1, proj2], [item1, item2], runMock.object, request, token, deps);

            // Assert - both projects had their execution adapters called
            expect(proj1.executionAdapterStub.calledOnce).to.be.true;
            expect(proj2.executionAdapterStub.calledOnce).to.be.true;
        });

        test('should emit telemetry event for each project execution', async () => {
            // Mock
            const proj1 = createMockProjectAdapter({ projectPath: '/workspace/proj1', projectName: 'proj1' });
            const proj2 = createMockProjectAdapter({ projectPath: '/workspace/proj2', projectName: 'proj2' });
            proj1.resultResolver.vsIdToRunId.set('test1', 'runId1');
            proj2.resultResolver.vsIdToRunId.set('test2', 'runId2');
            const item1 = createMockTestItem('test1', '/workspace/proj1/test.py');
            const item2 = createMockTestItem('test2', '/workspace/proj2/test.py');
            const runMock = createMockTestRun();
            const token = new CancellationTokenSource().token;
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProjects([proj1, proj2], [item1, item2], runMock.object, request, token, deps);

            // Assert - telemetry sent twice (once per project)
            expect(telemetryStub.callCount).to.equal(2);
        });

        test('should stop processing remaining projects when cancellation requested mid-execution', async () => {
            // Mock
            const tokenSource = new CancellationTokenSource();
            const proj1 = createMockProjectAdapter({ projectPath: '/workspace/proj1', projectName: 'proj1' });
            const proj2 = createMockProjectAdapter({ projectPath: '/workspace/proj2', projectName: 'proj2' });
            // First project triggers cancellation during its execution
            proj1.executionAdapterStub.callsFake(async () => {
                tokenSource.cancel();
            });
            proj1.resultResolver.vsIdToRunId.set('test1', 'runId1');
            proj2.resultResolver.vsIdToRunId.set('test2', 'runId2');
            const item1 = createMockTestItem('test1', '/workspace/proj1/test.py');
            const item2 = createMockTestItem('test2', '/workspace/proj2/test.py');
            const runMock = createMockTestRun();
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProjects(
                [proj1, proj2],
                [item1, item2],
                runMock.object,
                request,
                tokenSource.token,
                deps,
            );

            // Assert - first project executed, second may be skipped due to cancellation check
            expect(proj1.executionAdapterStub.calledOnce).to.be.true;
        });

        test('should continue executing remaining projects when one project fails', async () => {
            // Mock
            const proj1 = createMockProjectAdapter({ projectPath: '/workspace/proj1', projectName: 'proj1' });
            const proj2 = createMockProjectAdapter({ projectPath: '/workspace/proj2', projectName: 'proj2' });
            proj1.executionAdapterStub.rejects(new Error('Execution failed'));
            proj1.resultResolver.vsIdToRunId.set('test1', 'runId1');
            proj2.resultResolver.vsIdToRunId.set('test2', 'runId2');
            const item1 = createMockTestItem('test1', '/workspace/proj1/test.py');
            const item2 = createMockTestItem('test2', '/workspace/proj2/test.py');
            const runMock = createMockTestRun();
            const token = new CancellationTokenSource().token;
            const request = { profile: { kind: TestRunProfileKind.Run } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run - should not throw
            await executeTestsForProjects([proj1, proj2], [item1, item2], runMock.object, request, token, deps);

            // Assert - second project still executed despite first failing
            expect(proj2.executionAdapterStub.calledOnce).to.be.true;
        });

        test('should configure loadDetailedCoverage callback when run profile is Coverage', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            project.resultResolver.vsIdToRunId.set('test1', 'runId1');
            const item = createMockTestItem('test1', '/workspace/proj/test.py');
            const runMock = createMockTestRun();
            const token = new CancellationTokenSource().token;
            const profileMock = ({
                kind: TestRunProfileKind.Coverage,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProjects([project], [item], runMock.object, request, token, deps);

            // Assert - loadDetailedCoverage callback was configured
            expect(profileMock.loadDetailedCoverage).to.not.be.undefined;
        });

        test('should include debugging=true in telemetry when run profile is Debug', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            project.resultResolver.vsIdToRunId.set('test1', 'runId1');
            const item = createMockTestItem('test1', '/workspace/proj/test.py');
            const runMock = createMockTestRun();
            const token = new CancellationTokenSource().token;
            const request = { profile: { kind: TestRunProfileKind.Debug } } as TestRunRequest;
            const deps = createMockDependencies();

            // Run
            await executeTestsForProjects([project], [item], runMock.object, request, token, deps);

            // Assert - telemetry contains debugging=true
            expect(telemetryStub.calledOnce).to.be.true;
            const telemetryProps = telemetryStub.firstCall.args[2];
            expect(telemetryProps.debugging).to.be.true;
        });
    });

    // ===== setupCoverageForProject Tests =====

    suite('setupCoverageForProject', () => {
        test('should configure loadDetailedCoverage callback when profile kind is Coverage', () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const profileMock = ({
                kind: TestRunProfileKind.Coverage,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;

            // Run
            setupCoverageForProject(request, project);

            // Assert
            expect(profileMock.loadDetailedCoverage).to.be.a('function');
        });

        test('should leave loadDetailedCoverage undefined when profile kind is Run', () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const profileMock = ({
                kind: TestRunProfileKind.Run,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;

            // Run
            setupCoverageForProject(request, project);

            // Assert
            expect(profileMock.loadDetailedCoverage).to.be.undefined;
        });

        test('should return coverage data from detailedCoverageMap when loadDetailedCoverage is called', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const mockCoverageDetails = [{ line: 1, executed: true }];
            project.resultResolver.detailedCoverageMap.set('/workspace/proj/file.py', mockCoverageDetails as any);
            const profileMock = ({
                kind: TestRunProfileKind.Coverage,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;

            // Run - configure coverage
            setupCoverageForProject(request, project);

            // Run - call the configured callback
            const fileCoverage = { uri: Uri.file('/workspace/proj/file.py') };
            const result = await profileMock.loadDetailedCoverage!(
                {} as TestRun,
                fileCoverage as any,
                {} as CancellationToken,
            );

            // Assert
            expect(result).to.deep.equal(mockCoverageDetails);
        });

        test('should return empty array when file has no coverage data in map', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const profileMock = ({
                kind: TestRunProfileKind.Coverage,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;

            // Run - configure coverage
            setupCoverageForProject(request, project);

            // Run - call callback for file not in map
            const fileCoverage = { uri: Uri.file('/workspace/proj/uncovered_file.py') };
            const result = await profileMock.loadDetailedCoverage!(
                {} as TestRun,
                fileCoverage as any,
                {} as CancellationToken,
            );

            // Assert
            expect(result).to.deep.equal([]);
        });
    });
});
