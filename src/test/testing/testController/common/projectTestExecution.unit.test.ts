// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import {
    CancellationToken,
    CancellationTokenSource,
    TestRun,
    TestRunProfile,
    TestRunProfileKind,
    TestRunRequest,
    Uri,
} from 'vscode';
import {
    createMockDependencies,
    createMockProjectAdapter,
    createMockTestItem,
    createMockTestItemWithoutUri,
    createMockTestRun,
} from '../testMocks';
import {
    executeTestsForProject,
    executeTestsForProjects,
    findProjectForTestItem,
    getTestCaseNodesRecursive,
    groupTestItemsByProject,
    setupCoverageForProjects,
} from '../../../../client/testing/testController/common/projectTestExecution';
import * as telemetry from '../../../../client/telemetry';
import * as envExtApi from '../../../../client/envExt/api.internal';

suite('Project Test Execution', () => {
    let sandbox: sinon.SinonSandbox;
    let useEnvExtensionStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        // Default to disabled env extension for path-based fallback tests
        useEnvExtensionStub = sandbox.stub(envExtApi, 'useEnvExtension').returns(false);
    });

    teardown(() => {
        sandbox.restore();
    });

    // ===== findProjectForTestItem Tests =====

    suite('findProjectForTestItem', () => {
        test('should return undefined when test item has no URI', async () => {
            // Mock
            const item = createMockTestItemWithoutUri('test1');
            const projects = [createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' })];

            // Run
            const result = await findProjectForTestItem(item, projects);

            // Assert
            expect(result).to.be.undefined;
        });

        test('should return matching project when item path is within project directory', async () => {
            // Mock
            const item = createMockTestItem('test1', '/workspace/proj/tests/test_file.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await findProjectForTestItem(item, [project]);

            // Assert
            expect(result).to.equal(project);
        });

        test('should return undefined when item path is outside all project directories', async () => {
            // Mock
            const item = createMockTestItem('test1', '/other/path/test.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await findProjectForTestItem(item, [project]);

            // Assert
            expect(result).to.be.undefined;
        });

        test('should return most specific (deepest) project when nested projects exist', async () => {
            // Mock - parent and child project with overlapping paths
            const item = createMockTestItem('test1', '/workspace/parent/child/tests/test.py');
            const parentProject = createMockProjectAdapter({ projectPath: '/workspace/parent', projectName: 'parent' });
            const childProject = createMockProjectAdapter({
                projectPath: '/workspace/parent/child',
                projectName: 'child',
            });

            // Run
            const result = await findProjectForTestItem(item, [parentProject, childProject]);

            // Assert - should match child (longer path) not parent
            expect(result).to.equal(childProject);
        });

        test('should return most specific project regardless of input order', async () => {
            // Mock - same as above but different order
            const item = createMockTestItem('test1', '/workspace/parent/child/tests/test.py');
            const parentProject = createMockProjectAdapter({ projectPath: '/workspace/parent', projectName: 'parent' });
            const childProject = createMockProjectAdapter({
                projectPath: '/workspace/parent/child',
                projectName: 'child',
            });

            // Run - pass child first, then parent
            const result = await findProjectForTestItem(item, [childProject, parentProject]);

            // Assert - order shouldn't affect result
            expect(result).to.equal(childProject);
        });

        test('should match item at project root level', async () => {
            // Mock
            const item = createMockTestItem('test1', '/workspace/proj/test.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await findProjectForTestItem(item, [project]);

            // Assert
            expect(result).to.equal(project);
        });

        test('should use env extension API when available', async () => {
            // Enable env extension
            useEnvExtensionStub.returns(true);

            // Mock the env extension API
            const item = createMockTestItem('test1', '/workspace/proj/tests/test_file.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            const mockEnvApi = {
                getPythonProject: sandbox.stub().returns({ uri: project.projectUri }),
            };
            sandbox.stub(envExtApi, 'getEnvExtApi').resolves(mockEnvApi as any);

            // Run
            const result = await findProjectForTestItem(item, [project]);

            // Assert
            expect(result).to.equal(project);
            expect(mockEnvApi.getPythonProject.calledOnceWith(item.uri)).to.be.true;
        });

        test('should fall back to path matching when env extension API is unavailable', async () => {
            // Env extension enabled but throws
            useEnvExtensionStub.returns(true);
            sandbox.stub(envExtApi, 'getEnvExtApi').rejects(new Error('API unavailable'));

            // Mock
            const item = createMockTestItem('test1', '/workspace/proj/tests/test_file.py');
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });

            // Run
            const result = await findProjectForTestItem(item, [project]);

            // Assert - should still work via fallback
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

    // ===== setupCoverageForProjects Tests =====

    suite('setupCoverageForProjects', () => {
        test('should configure loadDetailedCoverage callback when profile kind is Coverage', () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const profileMock = ({
                kind: TestRunProfileKind.Coverage,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;

            // Run
            setupCoverageForProjects(request, [project]);

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
            setupCoverageForProjects(request, [project]);

            // Assert
            expect(profileMock.loadDetailedCoverage).to.be.undefined;
        });

        test('should return coverage data from detailedCoverageMap when loadDetailedCoverage is called', async () => {
            // Mock
            const project = createMockProjectAdapter({ projectPath: '/workspace/proj', projectName: 'proj' });
            const mockCoverageDetails = [{ line: 1, executed: true }];
            // Use Uri.fsPath as the key to match the implementation's lookup
            const fileUri = Uri.file('/workspace/proj/file.py');
            project.resultResolver.detailedCoverageMap.set(fileUri.fsPath, mockCoverageDetails as any);
            const profileMock = ({
                kind: TestRunProfileKind.Coverage,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;

            // Run - configure coverage
            setupCoverageForProjects(request, [project]);

            // Run - call the configured callback
            const fileCoverage = { uri: fileUri };
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
            setupCoverageForProjects(request, [project]);

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

        test('should route to correct project when multiple projects have coverage data', async () => {
            // Mock - two projects with different coverage data
            const project1 = createMockProjectAdapter({ projectPath: '/workspace/proj1', projectName: 'proj1' });
            const project2 = createMockProjectAdapter({ projectPath: '/workspace/proj2', projectName: 'proj2' });
            const coverage1 = [{ line: 1, executed: true }];
            const coverage2 = [{ line: 2, executed: false }];
            const file1Uri = Uri.file('/workspace/proj1/file1.py');
            const file2Uri = Uri.file('/workspace/proj2/file2.py');
            project1.resultResolver.detailedCoverageMap.set(file1Uri.fsPath, coverage1 as any);
            project2.resultResolver.detailedCoverageMap.set(file2Uri.fsPath, coverage2 as any);

            const profileMock = ({
                kind: TestRunProfileKind.Coverage,
                loadDetailedCoverage: undefined,
            } as unknown) as TestRunProfile;
            const request = { profile: profileMock } as TestRunRequest;

            // Run - configure coverage with both projects
            setupCoverageForProjects(request, [project1, project2]);

            // Assert - can get coverage from both projects through single callback
            const result1 = await profileMock.loadDetailedCoverage!(
                {} as TestRun,
                { uri: file1Uri } as any,
                {} as CancellationToken,
            );
            const result2 = await profileMock.loadDetailedCoverage!(
                {} as TestRun,
                { uri: file2Uri } as any,
                {} as CancellationToken,
            );

            expect(result1).to.deep.equal(coverage1);
            expect(result2).to.deep.equal(coverage2);
        });
    });
});
