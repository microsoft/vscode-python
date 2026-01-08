// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as crypto from 'crypto';
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
