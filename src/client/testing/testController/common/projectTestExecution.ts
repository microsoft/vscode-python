// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, FileCoverageDetail, TestItem, TestRun, TestRunProfileKind, TestRunRequest } from 'vscode';
import { traceError, traceInfo, traceVerbose } from '../../../logging';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { ITestDebugLauncher } from '../../common/types';
import { ProjectAdapter } from './projectAdapter';
import { TestProjectRegistry } from './testProjectRegistry';
import { getProjectId } from './projectUtils';

/**
 * Dependencies required for project-based test execution.
 * Passed to execution functions to avoid tight coupling to the controller.
 */
export interface ProjectExecutionDependencies {
    projectRegistry: TestProjectRegistry;
    pythonExecFactory: IPythonExecutionFactory;
    debugLauncher: ITestDebugLauncher;
}

/**
 * Executes tests for multiple projects within a workspace (project-based mode).
 * Groups test items by their owning project and executes each project's tests
 * using that project's Python environment.
 *
 * Cancellation is handled at multiple levels:
 * 1. Before starting each project's execution (checked here)
 * 2. Within each execution adapter (via runInstance.token)
 */
export async function executeTestsForProjects(
    projects: ProjectAdapter[],
    testItems: TestItem[],
    runInstance: TestRun,
    request: TestRunRequest,
    token: CancellationToken,
    deps: ProjectExecutionDependencies,
): Promise<void> {
    if (projects.length === 0) {
        traceError(`[test-by-project] No projects provided for execution`);
        return;
    }

    // Early exit if already cancelled
    if (token.isCancellationRequested) {
        traceInfo(`[test-by-project] Execution cancelled before starting`);
        return;
    }

    // Group test items by project
    const testsByProject = groupTestItemsByProject(testItems, projects);

    const isDebugMode = request.profile?.kind === TestRunProfileKind.Debug;
    traceInfo(`[test-by-project] Executing tests across ${testsByProject.size} project(s), debug=${isDebugMode}`);

    // Execute tests for each project in parallel
    // For debug mode, multiple debug sessions will be launched in parallel
    // Each execution respects cancellation via runInstance.token
    const executions = Array.from(testsByProject.entries()).map(async ([_projectId, { project, items }]) => {
        // Check for cancellation before starting each project
        if (token.isCancellationRequested) {
            traceInfo(`[test-by-project] Skipping ${project.projectName} - cancellation requested`);
            return;
        }

        if (items.length === 0) return;

        traceInfo(`[test-by-project] Executing ${items.length} test item(s) for project: ${project.projectName}`);

        sendTelemetryEvent(EventName.UNITTEST_RUN, undefined, {
            tool: 'pytest',
            debugging: isDebugMode,
        });

        // Setup coverage for this project if needed
        if (request.profile?.kind === TestRunProfileKind.Coverage) {
            setupCoverageForProject(request, project);
        }

        try {
            await executeTestsForProject(project, items, runInstance, request, deps);
        } catch (error) {
            // Don't log cancellation as an error
            if (!token.isCancellationRequested) {
                traceError(`[test-by-project] Execution failed for project ${project.projectName}:`, error);
            }
        }
    });

    await Promise.all(executions);

    if (token.isCancellationRequested) {
        traceInfo(`[test-by-project] Project executions cancelled`);
    } else {
        traceInfo(`[test-by-project] All project executions completed`);
    }
}

/**
 * Groups test items by their owning project based on file path matching.
 * Each test item's URI is matched against project root paths.
 */
export function groupTestItemsByProject(
    testItems: TestItem[],
    projects: ProjectAdapter[],
): Map<string, { project: ProjectAdapter; items: TestItem[] }> {
    const result = new Map<string, { project: ProjectAdapter; items: TestItem[] }>();

    // Initialize entries for all projects
    for (const project of projects) {
        result.set(getProjectId(project.projectUri), { project, items: [] });
    }

    // Assign each test item to its project
    for (const item of testItems) {
        const project = findProjectForTestItem(item, projects);
        if (project) {
            const entry = result.get(getProjectId(project.projectUri));
            if (entry) {
                entry.items.push(item);
            }
        } else {
            // If no project matches, log it
            traceVerbose(`[test-by-project] Could not match test item ${item.id} to a project`);
        }
    }

    // Remove projects with no test items
    for (const [projectId, entry] of result.entries()) {
        if (entry.items.length === 0) {
            result.delete(projectId);
        }
    }

    return result;
}

/**
 * Finds the project that owns a test item based on the test item's URI.
 * Returns the most specific (longest path) matching project.
 */
export function findProjectForTestItem(item: TestItem, projects: ProjectAdapter[]): ProjectAdapter | undefined {
    if (!item.uri) return undefined;

    const itemPath = item.uri.fsPath;
    let bestMatch: ProjectAdapter | undefined;
    let bestMatchLength = 0;

    for (const project of projects) {
        const projectPath = project.projectUri.fsPath;
        // Check if the item's path starts with the project's path
        if (itemPath.startsWith(projectPath) && projectPath.length > bestMatchLength) {
            bestMatch = project;
            bestMatchLength = projectPath.length;
        }
    }

    return bestMatch;
}

/**
 * Executes tests for a single project using the project's Python environment.
 */
export async function executeTestsForProject(
    project: ProjectAdapter,
    testItems: TestItem[],
    runInstance: TestRun,
    request: TestRunRequest,
    deps: ProjectExecutionDependencies,
): Promise<void> {
    const testCaseIds: string[] = [];

    // Mark items as started and collect test IDs
    for (const item of testItems) {
        // Recursively get test case nodes if this is a parent node
        const testCaseNodes = getTestCaseNodesRecursive(item);
        for (const node of testCaseNodes) {
            runInstance.started(node);
            const runId = project.resultResolver.vsIdToRunId.get(node.id);
            if (runId) {
                testCaseIds.push(runId);
            }
        }
    }

    if (testCaseIds.length === 0) {
        traceVerbose(`[test-by-project] No test IDs found for project ${project.projectName}`);
        return;
    }

    traceInfo(`[test-by-project] Running ${testCaseIds.length} test(s) for project: ${project.projectName}`);

    // Execute tests using the project's execution adapter
    await project.executionAdapter.runTests(
        project.projectUri,
        testCaseIds,
        request.profile?.kind,
        runInstance,
        deps.pythonExecFactory,
        deps.debugLauncher,
        undefined, // interpreter not needed, project has its own environment
        project,
    );
}

/**
 * Recursively gets all test case nodes from a test item tree.
 */
export function getTestCaseNodesRecursive(item: TestItem): TestItem[] {
    const results: TestItem[] = [];
    if (item.children.size === 0) {
        // This is a leaf node (test case)
        results.push(item);
    } else {
        // Recursively get children
        item.children.forEach((child) => {
            results.push(...getTestCaseNodesRecursive(child));
        });
    }
    return results;
}

/**
 * Sets up detailed coverage loading for a project.
 */
export function setupCoverageForProject(request: TestRunRequest, project: ProjectAdapter): void {
    if (request.profile?.kind === TestRunProfileKind.Coverage) {
        request.profile.loadDetailedCoverage = (
            _testRun: TestRun,
            fileCoverage,
            _token,
        ): Thenable<FileCoverageDetail[]> => {
            const details = project.resultResolver.detailedCoverageMap.get(fileCoverage.uri.fsPath);
            return Promise.resolve(details ?? []);
        };
    }
}
