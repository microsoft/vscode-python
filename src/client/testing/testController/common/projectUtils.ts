// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';

/**
 * Separator used to scope test IDs to a specific project.
 * Format: {projectId}{SEPARATOR}{testPath}
 * Example: "file:///workspace/project||test_file.py::test_name"
 */
export const PROJECT_ID_SEPARATOR = '||';

/**
 * Gets the project ID from a project URI.
 * The project ID is simply the string representation of the URI, matching how
 * the Python Environments extension stores projects in Map<string, PythonProject>.
 *
 * @param projectUri The project URI
 * @returns The project ID (URI as string)
 */
export function getProjectId(projectUri: Uri): string {
    return projectUri.toString();
}

/**
 * Parses a project-scoped vsId back into its components.
 *
 * @param vsId The VS Code test item ID to parse
 * @returns A tuple of [projectId, runId]. If the ID is not project-scoped,
 *          returns [undefined, vsId] (legacy format)
 */
export function parseVsId(vsId: string): [string | undefined, string] {
    const separatorIndex = vsId.indexOf(PROJECT_ID_SEPARATOR);
    if (separatorIndex === -1) {
        return [undefined, vsId]; // Legacy ID without project scope
    }
    return [vsId.substring(0, separatorIndex), vsId.substring(separatorIndex + PROJECT_ID_SEPARATOR.length)];
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
