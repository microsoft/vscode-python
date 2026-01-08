// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestItem, Uri } from 'vscode';
import { TestProvider } from '../../types';
import {
    ITestDiscoveryAdapter,
    ITestExecutionAdapter,
    ITestResultResolver,
    DiscoveredTestPayload,
    DiscoveredTestNode,
} from './types';
import { PythonEnvironment, PythonProject } from '../../../envExt/types';

/**
 * Represents a single Python project with its own test infrastructure.
 * A project is defined as a combination of a Python executable + URI (folder/file).
 * Projects are keyed by projectUri.toString()
 */
export interface ProjectAdapter {
    // === IDENTITY ===
    /**
     * Project identifier, which is the string representation of the project URI.
     */
    projectId: string;

    /**
     * Display name for the project (e.g., "alice (Python 3.11)").
     */
    projectName: string;

    /**
     * URI of the project root folder or file.
     */
    projectUri: Uri;

    /**
     * Parent workspace URI containing this project.
     */
    workspaceUri: Uri;

    // === API OBJECTS (from vscode-python-environments extension) ===
    /**
     * The PythonProject object from the environment API.
     */
    pythonProject: PythonProject;

    /**
     * The resolved PythonEnvironment with execution details.
     * Contains execInfo.run.executable for running tests.
     */
    pythonEnvironment: PythonEnvironment;

    // === TEST INFRASTRUCTURE ===
    /**
     * Test framework provider ('pytest' | 'unittest').
     */
    testProvider: TestProvider;

    /**
     * Adapter for test discovery.
     */
    discoveryAdapter: ITestDiscoveryAdapter;

    /**
     * Adapter for test execution.
     */
    executionAdapter: ITestExecutionAdapter;

    /**
     * Result resolver for this project (maps test IDs and handles results).
     */
    resultResolver: ITestResultResolver;

    // === DISCOVERY STATE ===
    /**
     * Raw discovery data before filtering (all discovered tests).
     * Cleared after ownership resolution to save memory.
     */
    rawDiscoveryData?: DiscoveredTestPayload;

    /**
     * Filtered tests that this project owns (after API verification).
     * This is the tree structure passed to populateTestTree().
     */
    ownedTests?: DiscoveredTestNode;

    // === LIFECYCLE ===
    /**
     * Whether discovery is currently running for this project.
     */
    isDiscovering: boolean;

    /**
     * Whether tests are currently executing for this project.
     */
    isExecuting: boolean;

    /**
     * Root TestItem for this project in the VS Code test tree.
     * All project tests are children of this item.
     */
    projectRootTestItem?: TestItem;
}

/**
 * Temporary state used during workspace-wide test discovery.
 * Created at the start of discovery and cleared after ownership resolution.
 */
export interface WorkspaceDiscoveryState {
    /**
     * The workspace being discovered.
     */
    workspaceUri: Uri;

    /**
     * Maps test file paths to the set of projects that discovered them.
     * Used to detect overlapping discovery.
     */
    fileToProjects: Map<string, Set<ProjectAdapter>>;

    /**
     * Maps test file paths to their owning project (after API resolution).
     * Value is the ProjectAdapter whose pythonProject.uri matches API response.
     */
    fileOwnership: Map<string, ProjectAdapter>;

    /**
     * Progress tracking for parallel discovery.
     */
    projectsCompleted: Set<string>;

    /**
     * Total number of projects in this workspace.
     */
    totalProjects: number;

    /**
     * Whether all projects have completed discovery.
     */
    isComplete: boolean;
}
