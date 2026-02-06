// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestItem, Uri } from 'vscode';
import { TestProvider } from '../../types';
import { ITestDiscoveryAdapter, ITestExecutionAdapter, ITestResultResolver } from './types';
import { PythonEnvironment, PythonProject } from '../../../envExt/types';

/**
 * Represents a single Python project with its own test infrastructure.
 * A project is defined as a combination of a Python executable + URI (folder/file).
 * Projects are uniquely identified by their projectUri (use projectUri.toString() for map keys).
 */
export interface ProjectAdapter {
    // === IDENTITY ===
    /**
     * Display name for the project (e.g., "alice (Python 3.11)").
     */
    projectName: string;

    /**
     * URI of the project root folder or file.
     * This is the unique identifier for the project.
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

    /**
     * Absolute paths of nested projects to ignore during discovery.
     * Used to pass --ignore flags to pytest or exclusion filters to unittest.
     * Only populated for parent projects that contain nested child projects.
     */
    nestedProjectPathsToIgnore?: string[];

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
