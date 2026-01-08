// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as crypto from 'crypto';
import { PythonProject } from '../../../envExt/types';

/**
 * Separator used to scope test IDs to a specific project.
 * Format: {projectId}{SEPARATOR}{testPath}
 * Example: "project-abc123def456::test_file.py::test_name"
 */
export const PROJECT_ID_SEPARATOR = '::';

/**
 * Generates a unique project ID by hashing the PythonProject object.
 * This ensures consistent IDs across extension reloads for the same project.
 * Uses 16 characters of the hash to reduce collision probability.
 *
 * @param pythonProject The PythonProject object from the environment API
 * @returns A unique string identifier for the project
 */
export function generateProjectId(pythonProject: PythonProject): string {
    // Create a stable string representation of the project
    // Use URI as the primary identifier (stable across renames)
    const projectString = JSON.stringify({
        uri: pythonProject.uri.toString(),
        name: pythonProject.name,
    });

    // Generate a hash to create a shorter, unique ID
    // Using 16 chars (64 bits) instead of 12 (48 bits) for better collision resistance
    const hash = crypto.createHash('sha256').update(projectString).digest('hex');
    return `project-${hash.substring(0, 16)}`;
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
