// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, FileCoverageDetail, TestItem, TestRun, TestRunProfileKind, TestRunRequest } from 'vscode';
import { traceError, traceInfo, traceVerbose, traceWarn } from '../../../logging';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { ITestDebugLauncher } from '../../common/types';
import { ProjectAdapter } from './projectAdapter';
import { TestProjectRegistry } from './testProjectRegistry';
import { getProjectId } from './projectUtils';
import { getEnvExtApi, useEnvExtension } from '../../../envExt/api.internal';
import { isParentPath } from '../../../pythonEnvironments/common/externalDependencies';

/** Dependencies for project-based test execution. */
export interface ProjectExecutionDependencies {
    projectRegistry: TestProjectRegistry;
    pythonExecFactory: IPythonExecutionFactory;
    debugLauncher: ITestDebugLauncher;
}

/** Executes tests for multiple projects, grouping by project and using each project's Python environment. */
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
    const testsByProject = await groupTestItemsByProject(testItems, projects);

    const isDebugMode = request.profile?.kind === TestRunProfileKind.Debug;
    traceInfo(`[test-by-project] Executing tests across ${testsByProject.size} project(s), debug=${isDebugMode}`);

    // Setup coverage once for all projects (single callback that routes by file path)
    if (request.profile?.kind === TestRunProfileKind.Coverage) {
        setupCoverageForProjects(request, projects);
    }

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
            tool: project.testProvider,
            debugging: isDebugMode,
        });

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

/** Lookup context for caching project lookups within a single test run. */
interface ProjectLookupContext {
    uriToAdapter: Map<string, ProjectAdapter | undefined>;
    projectPathToAdapter: Map<string, ProjectAdapter>;
}

/** Groups test items by owning project using env API or path-based matching as fallback. */
export async function groupTestItemsByProject(
    testItems: TestItem[],
    projects: ProjectAdapter[],
): Promise<Map<string, { project: ProjectAdapter; items: TestItem[] }>> {
    const result = new Map<string, { project: ProjectAdapter; items: TestItem[] }>();

    // Initialize entries for all projects
    for (const project of projects) {
        result.set(getProjectId(project.projectUri), { project, items: [] });
    }

    // Build lookup context for this run - O(p) one-time setup, enables O(1) lookups per item.
    // When tests are from a single project, most lookups hit the cache after the first item.
    const lookupContext: ProjectLookupContext = {
        uriToAdapter: new Map(),
        projectPathToAdapter: new Map(projects.map((p) => [p.projectUri.fsPath, p])),
    };

    // Assign each test item to its project
    for (const item of testItems) {
        const project = await findProjectForTestItem(item, projects, lookupContext);
        if (project) {
            const entry = result.get(getProjectId(project.projectUri));
            if (entry) {
                entry.items.push(item);
            }
        } else {
            // If no project matches, log it
            traceWarn(`[test-by-project] Could not match test item ${item.id} to a project`);
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

/** Finds the project that owns a test item. */
export async function findProjectForTestItem(
    item: TestItem,
    projects: ProjectAdapter[],
    lookupContext?: ProjectLookupContext,
): Promise<ProjectAdapter | undefined> {
    if (!item.uri) return undefined;

    const uriPath = item.uri.fsPath;

    // Check lookup context first - O(1)
    if (lookupContext?.uriToAdapter.has(uriPath)) {
        return lookupContext.uriToAdapter.get(uriPath);
    }

    let result: ProjectAdapter | undefined;

    // Try using the Python Environment extension API first.
    // Legacy path: when useEnvExtension() is false, this block is skipped and we go
    // directly to findProjectByPath() below (path-based matching).
    if (useEnvExtension()) {
        try {
            const envExtApi = await getEnvExtApi();
            const pythonProject = envExtApi.getPythonProject(item.uri);
            if (pythonProject) {
                // Use lookup context for O(1) adapter lookup instead of O(p) linear search
                result = lookupContext?.projectPathToAdapter.get(pythonProject.uri.fsPath);
                if (!result) {
                    // Fallback to linear search if lookup context not available
                    result = projects.find((p) => p.projectUri.fsPath === pythonProject.uri.fsPath);
                }
            }
        } catch (error) {
            traceVerbose(`[test-by-project] Failed to use env extension API, falling back to path matching: ${error}`);
        }
    }

    // Fallback: path-based matching when env API unavailable or didn't find a match.
    // O(p) time complexity where p = number of projects.
    if (!result) {
        result = findProjectByPath(item, projects);
    }

    // Store result for future lookups of same file within this run - O(1)
    if (lookupContext) {
        lookupContext.uriToAdapter.set(uriPath, result);
    }

    return result;
}

/** Fallback: finds project using path-based matching. */
function findProjectByPath(item: TestItem, projects: ProjectAdapter[]): ProjectAdapter | undefined {
    if (!item.uri) return undefined;

    const itemPath = item.uri.fsPath;
    let bestMatch: ProjectAdapter | undefined;
    let bestMatchLength = 0;

    for (const project of projects) {
        const projectPath = project.projectUri.fsPath;
        // Use isParentPath for safe path-boundary matching (handles separators and case normalization)
        if (isParentPath(itemPath, projectPath) && projectPath.length > bestMatchLength) {
            bestMatch = project;
            bestMatchLength = projectPath.length;
        }
    }

    return bestMatch;
}

/** Executes tests for a single project using the project's Python environment. */
export async function executeTestsForProject(
    project: ProjectAdapter,
    testItems: TestItem[],
    runInstance: TestRun,
    request: TestRunRequest,
    deps: ProjectExecutionDependencies,
): Promise<void> {
    const processedTestItemIds = new Set<string>();
    const uniqueTestCaseIds = new Set<string>();

    // Mark items as started and collect test IDs (deduplicated to handle overlapping selections)
    for (const item of testItems) {
        const testCaseNodes = getTestCaseNodesRecursive(item);
        for (const node of testCaseNodes) {
            if (processedTestItemIds.has(node.id)) {
                continue;
            }
            processedTestItemIds.add(node.id);
            runInstance.started(node);
            const runId = project.resultResolver.vsIdToRunId.get(node.id);
            if (runId) {
                uniqueTestCaseIds.add(runId);
            }
        }
    }

    const testCaseIds = Array.from(uniqueTestCaseIds);

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

/** Recursively gets all leaf test case nodes from a test item tree. */
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

/** Sets up detailed coverage loading that routes to the correct project by file path. */
export function setupCoverageForProjects(request: TestRunRequest, projects: ProjectAdapter[]): void {
    if (request.profile?.kind === TestRunProfileKind.Coverage) {
        // Create a single callback that routes to the correct project's coverage map by file path
        request.profile.loadDetailedCoverage = (
            _testRun: TestRun,
            fileCoverage,
            _token,
        ): Thenable<FileCoverageDetail[]> => {
            const filePath = fileCoverage.uri.fsPath;
            // Find the project that has coverage data for this file
            for (const project of projects) {
                const details = project.resultResolver.detailedCoverageMap.get(filePath);
                if (details) {
                    return Promise.resolve(details);
                }
            }
            return Promise.resolve([]);
        };
    }
}
