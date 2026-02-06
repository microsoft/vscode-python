// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IConfigurationService } from '../../../common/types';
import { IEnvironmentVariablesProvider } from '../../../common/variables/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { TestProvider } from '../../types';
import { ITestDiscoveryAdapter, ITestExecutionAdapter, ITestResultResolver } from './types';
import { UnittestTestDiscoveryAdapter } from '../unittest/testDiscoveryAdapter';
import { UnittestTestExecutionAdapter } from '../unittest/testExecutionAdapter';
import { PytestTestDiscoveryAdapter } from '../pytest/pytestDiscoveryAdapter';
import { PytestTestExecutionAdapter } from '../pytest/pytestExecutionAdapter';

/**
 * Separator used to scope test IDs to a specific project.
 * Format: {projectId}{SEPARATOR}{testPath}
 * Example: "file:///workspace/project@@PROJECT@@test_file.py::test_name"
 */
export const PROJECT_ID_SEPARATOR = '@@vsc@@';

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

/**
 * Creates test adapters (discovery and execution) for a given test provider.
 *
 * @param testProvider The test framework provider ('pytest' | 'unittest')
 * @param resultResolver The result resolver to use for test results
 * @param configSettings The configuration service
 * @param envVarsService The environment variables provider
 * @returns An object containing the discovery and execution adapters
 */
export function createTestAdapters(
    testProvider: TestProvider,
    resultResolver: ITestResultResolver,
    configSettings: IConfigurationService,
    envVarsService: IEnvironmentVariablesProvider,
): { discoveryAdapter: ITestDiscoveryAdapter; executionAdapter: ITestExecutionAdapter } {
    if (testProvider === UNITTEST_PROVIDER) {
        return {
            discoveryAdapter: new UnittestTestDiscoveryAdapter(configSettings, resultResolver, envVarsService),
            executionAdapter: new UnittestTestExecutionAdapter(configSettings, resultResolver, envVarsService),
        };
    }

    return {
        discoveryAdapter: new PytestTestDiscoveryAdapter(configSettings, resultResolver, envVarsService),
        executionAdapter: new PytestTestExecutionAdapter(configSettings, resultResolver, envVarsService),
    };
}
