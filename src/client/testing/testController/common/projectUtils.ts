// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as crypto from 'crypto';
import { Uri } from 'vscode';
import { ProjectAdapter } from './projectAdapter';
import { PythonProject } from '../../../envExt/types';

/**
 * Generates a unique project ID by hashing the PythonProject object.
 * This ensures consistent IDs across extension reloads for the same project.
 * 
 * @param pythonProject The PythonProject object from the environment API
 * @returns A unique string identifier for the project
 */
export function generateProjectId(pythonProject: PythonProject): string {
    // Create a stable string representation of the project
    const projectString = JSON.stringify({
        name: pythonProject.name,
        uri: pythonProject.uri.toString(),
    });
    
    // Generate a hash to create a shorter, unique ID
    const hash = crypto.createHash('sha256').update(projectString).digest('hex');
    return `project-${hash.substring(0, 12)}`;
}

/**
 * Creates a project-scoped VS Code test item ID.
 * Format: "{projectId}::{testPath}"
 * 
 * @param projectId The unique project identifier
 * @param testPath The test path (e.g., "/workspace/test.py::test_func")
 * @returns The project-scoped VS Code test ID
 */
export function createProjectScopedVsId(projectId: string, testPath: string): string {
    return `${projectId}::${testPath}`;
}

/**
 * Parses a project-scoped VS Code test ID to extract the project ID and test path.
 * 
 * @param vsId The VS Code test item ID
 * @returns Object containing projectId and testPath, or null if invalid
 */
export function parseProjectScopedVsId(vsId: string): { projectId: string; testPath: string } | null {
    const separatorIndex = vsId.indexOf('::');
    if (separatorIndex === -1) {
        return null;
    }
    
    return {
        projectId: vsId.substring(0, separatorIndex),
        testPath: vsId.substring(separatorIndex + 2),
    };
}

/**
 * Checks if a test file path is within a nested project's directory.
 * This is used to determine when to query the API for ownership even if
 * only one project discovered the file.
 * 
 * @param testFilePath Absolute path to the test file
 * @param allProjects All projects in the workspace
 * @param excludeProject Optional project to exclude from the check (typically the discoverer)
 * @returns True if the file is within any nested project's directory
 */
export function hasNestedProjectForPath(
    testFilePath: string,
    allProjects: ProjectAdapter[],
    excludeProject?: ProjectAdapter,
): boolean {
    return allProjects.some(
        (p) =>
            p !== excludeProject &&
            testFilePath.startsWith(p.projectUri.fsPath),
    );
}

/**
 * Finds the project that owns a specific test file based on project URI.
 * This is typically used after the API returns ownership information.
 * 
 * @param projectUri The URI of the owning project (from API)
 * @param allProjects All projects to search
 * @returns The ProjectAdapter with matching URI, or undefined if not found
 */
export function findProjectByUri(projectUri: Uri, allProjects: ProjectAdapter[]): ProjectAdapter | undefined {
    return allProjects.find((p) => p.projectUri.fsPath === projectUri.fsPath);
}

/**
 * Creates a display name for a project including Python version.
 * Format: "{projectName} (Python {version})"
 * 
 * @param projectName The name of the project
 * @param pythonVersion The Python version string (e.g., "3.11.2")
 * @returns Formatted display name
 */
export function createProjectDisplayName(projectName: string, pythonVersion: string): string {
    // Extract major.minor version if full version provided
    const versionMatch = pythonVersion.match(/^(\d+\.\d+)/);
    const shortVersion = versionMatch ? versionMatch[1] : pythonVersion;
    
    return `${projectName} (Python ${shortVersion})`;
}
