// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { TestController, Uri } from 'vscode';
import { isParentPath } from '../../../common/platform/fs-paths';
import { IConfigurationService } from '../../../common/types';
import { IInterpreterService } from '../../../interpreter/contracts';
import { traceError, traceInfo } from '../../../logging';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { TestProvider } from '../../types';
import { IEnvironmentVariablesProvider } from '../../../common/variables/types';
import { PythonProject, PythonEnvironment } from '../../../envExt/types';
import { getEnvExtApi, useEnvExtension } from '../../../envExt/api.internal';
import { ProjectAdapter } from './projectAdapter';
import { getProjectId, createProjectDisplayName, createTestAdapters } from './projectUtils';
import { PythonResultResolver } from './resultResolver';

/**
 * Registry for Python test projects within workspaces.
 *
 * Manages the lifecycle of test projects including:
 * - Discovering Python projects via Python Environments API
 * - Creating and storing ProjectAdapter instances per workspace
 * - Computing nested project relationships for ignore lists
 * - Fallback to default "legacy" project when API unavailable
 *
 * **Key concepts:**
 * - **Workspace:** A VS Code workspace folder (may contain multiple projects)
 * - **Project:** A Python project within a workspace (identified by pyproject.toml, setup.py, etc.)
 * - **ProjectUri:** The unique identifier for a project (the URI of the project root directory)
 * - Each project gets its own test tree root, Python environment, and test adapters
 *
 * **Project identification:**
 * Projects are identified and tracked by their URI (projectUri.toString()). This matches
 * how the Python Environments extension stores projects in its Map<string, PythonProject>.
 */
export class TestProjectRegistry {
    /**
     * Map of workspace URI -> Map of project URI string -> ProjectAdapter
     *
     * Projects are keyed by their URI string (projectUri.toString()) which matches how
     * the Python Environments extension identifies projects. This enables O(1) lookups
     * when given a project URI.
     */
    private readonly workspaceProjects: Map<Uri, Map<string, ProjectAdapter>> = new Map();

    constructor(
        private readonly testController: TestController,
        private readonly configSettings: IConfigurationService,
        private readonly interpreterService: IInterpreterService,
        private readonly envVarsService: IEnvironmentVariablesProvider,
    ) {}

    /**
     * Gets the projects map for a workspace, if it exists.
     */
    public getWorkspaceProjects(workspaceUri: Uri): Map<string, ProjectAdapter> | undefined {
        return this.workspaceProjects.get(workspaceUri);
    }

    /**
     * Checks if a workspace has been initialized with projects.
     */
    public hasProjects(workspaceUri: Uri): boolean {
        return this.workspaceProjects.has(workspaceUri);
    }

    /**
     * Gets all projects for a workspace as an array.
     */
    public getProjectsArray(workspaceUri: Uri): ProjectAdapter[] {
        const projectsMap = this.workspaceProjects.get(workspaceUri);
        return projectsMap ? Array.from(projectsMap.values()) : [];
    }

    /**
     * Discovers and registers all Python projects for a workspace.
     * Returns the discovered projects for the caller to use.
     */
    public async discoverAndRegisterProjects(workspaceUri: Uri): Promise<ProjectAdapter[]> {
        traceInfo(`[test-by-project] Discovering projects for workspace: ${workspaceUri.fsPath}`);

        const projects = await this.discoverProjects(workspaceUri);

        // Create map for this workspace, keyed by project URI
        const projectsMap = new Map<string, ProjectAdapter>();
        projects.forEach((project) => {
            projectsMap.set(getProjectId(project.projectUri), project);
        });

        this.workspaceProjects.set(workspaceUri, projectsMap);
        traceInfo(`[test-by-project] Registered ${projects.length} project(s) for ${workspaceUri.fsPath}`);

        return projects;
    }

    /**
     * Computes and populates nested project ignore lists for all projects in a workspace.
     * Must be called before discovery to ensure parent projects ignore nested children.
     */
    public configureNestedProjectIgnores(workspaceUri: Uri): void {
        const projectIgnores = this.computeNestedProjectIgnores(workspaceUri);
        const projects = this.getProjectsArray(workspaceUri);

        for (const project of projects) {
            const ignorePaths = projectIgnores.get(getProjectId(project.projectUri));
            if (ignorePaths && ignorePaths.length > 0) {
                project.nestedProjectPathsToIgnore = ignorePaths;
                traceInfo(`[test-by-project] ${project.projectName} will ignore nested: ${ignorePaths.join(', ')}`);
            }
        }
    }

    /**
     * Clears all projects for a workspace.
     */
    public clearWorkspace(workspaceUri: Uri): void {
        this.workspaceProjects.delete(workspaceUri);
    }

    // ====== Private Methods ======

    /**
     * Discovers Python projects in a workspace using the Python Environment API.
     * Falls back to creating a single default project if API is unavailable.
     */
    private async discoverProjects(workspaceUri: Uri): Promise<ProjectAdapter[]> {
        try {
            if (!useEnvExtension()) {
                traceInfo('[test-by-project] Python Environments API not available, using default project');
                return [await this.createDefaultProject(workspaceUri)];
            }

            const envExtApi = await getEnvExtApi();
            const allProjects = envExtApi.getPythonProjects();
            traceInfo(`[test-by-project] Found ${allProjects.length} total Python projects from API`);

            // Filter to projects within this workspace
            const workspaceProjects = allProjects.filter((project) =>
                isParentPath(project.uri.fsPath, workspaceUri.fsPath),
            );
            traceInfo(`[test-by-project] Filtered to ${workspaceProjects.length} projects in workspace`);

            if (workspaceProjects.length === 0) {
                traceInfo('[test-by-project] No projects found, creating default project');
                return [await this.createDefaultProject(workspaceUri)];
            }

            // Create ProjectAdapter for each discovered project
            const adapters: ProjectAdapter[] = [];
            for (const pythonProject of workspaceProjects) {
                try {
                    const adapter = await this.createProjectAdapter(pythonProject, workspaceUri);
                    adapters.push(adapter);
                } catch (error) {
                    traceError(`[test-by-project] Failed to create adapter for ${pythonProject.uri.fsPath}:`, error);
                }
            }

            if (adapters.length === 0) {
                traceInfo('[test-by-project] All adapters failed, falling back to default project');
                return [await this.createDefaultProject(workspaceUri)];
            }

            return adapters;
        } catch (error) {
            traceError('[test-by-project] Discovery failed, using default project:', error);
            return [await this.createDefaultProject(workspaceUri)];
        }
    }

    /**
     * Creates a ProjectAdapter from a PythonProject.
     *
     * Each project gets its own isolated test infrastructure:
     * - **ResultResolver:** Handles mapping test IDs and processing results for this project
     * - **DiscoveryAdapter:** Discovers tests scoped to this project's root directory
     * - **ExecutionAdapter:** Runs tests for this project using its Python environment
     *
     */
    private async createProjectAdapter(pythonProject: PythonProject, workspaceUri: Uri): Promise<ProjectAdapter> {
        const projectId = getProjectId(pythonProject.uri);
        traceInfo(`[test-by-project] Creating adapter for: ${pythonProject.name} at ${projectId}`);

        // Resolve Python environment
        const envExtApi = await getEnvExtApi();
        const pythonEnvironment = await envExtApi.getEnvironment(pythonProject.uri);
        if (!pythonEnvironment) {
            throw new Error(`No Python environment found for project ${projectId}`);
        }

        // Create test infrastructure
        const testProvider = this.getTestProvider(workspaceUri);
        const projectDisplayName = createProjectDisplayName(pythonProject.name, pythonEnvironment.version);
        const resultResolver = new PythonResultResolver(
            this.testController,
            testProvider,
            workspaceUri,
            projectId,
            pythonProject.name, // Use simple project name for test tree label (without version)
        );
        const { discoveryAdapter, executionAdapter } = createTestAdapters(
            testProvider,
            resultResolver,
            this.configSettings,
            this.envVarsService,
        );

        return {
            projectName: projectDisplayName,
            projectUri: pythonProject.uri,
            workspaceUri,
            pythonProject,
            pythonEnvironment,
            testProvider,
            discoveryAdapter,
            executionAdapter,
            resultResolver,
            isDiscovering: false,
            isExecuting: false,
        };
    }

    /**
     * Creates a default project for legacy/fallback mode.
     */
    private async createDefaultProject(workspaceUri: Uri): Promise<ProjectAdapter> {
        traceInfo(`[test-by-project] Creating default project for: ${workspaceUri.fsPath}`);

        const testProvider = this.getTestProvider(workspaceUri);
        const resultResolver = new PythonResultResolver(this.testController, testProvider, workspaceUri);
        const { discoveryAdapter, executionAdapter } = createTestAdapters(
            testProvider,
            resultResolver,
            this.configSettings,
            this.envVarsService,
        );

        const interpreter = await this.interpreterService.getActiveInterpreter(workspaceUri);

        const pythonEnvironment: PythonEnvironment = {
            name: 'default',
            displayName: interpreter?.displayName || 'Python',
            shortDisplayName: interpreter?.displayName || 'Python',
            displayPath: interpreter?.path || 'python',
            version: interpreter?.version?.raw || '3.x',
            environmentPath: Uri.file(interpreter?.path || 'python'),
            sysPrefix: interpreter?.sysPrefix || '',
            execInfo: { run: { executable: interpreter?.path || 'python' } },
            envId: { id: 'default', managerId: 'default' },
        };

        const pythonProject: PythonProject = {
            name: path.basename(workspaceUri.fsPath) || 'workspace',
            uri: workspaceUri,
        };

        return {
            projectName: pythonProject.name,
            projectUri: workspaceUri,
            workspaceUri,
            pythonProject,
            pythonEnvironment,
            testProvider,
            discoveryAdapter,
            executionAdapter,
            resultResolver,
            isDiscovering: false,
            isExecuting: false,
        };
    }

    /**
     * Identifies nested projects and returns ignore paths for parent projects.
     *
     * **Time complexity:** O(n²) where n is the number of projects in the workspace.
     * For each project, checks all other projects to find nested relationships.
     *
     * Note: Uses path.normalize() to handle Windows path separator inconsistencies
     * (e.g., paths from URI.fsPath may have mixed separators).
     */
    private computeNestedProjectIgnores(workspaceUri: Uri): Map<string, string[]> {
        const ignoreMap = new Map<string, string[]>();
        const projects = this.getProjectsArray(workspaceUri);

        if (projects.length === 0) return ignoreMap;

        for (const parent of projects) {
            const nestedPaths: string[] = [];

            for (const child of projects) {
                // Skip self-comparison using URI
                if (parent.projectUri.toString() === child.projectUri.toString()) continue;

                // Normalize paths to handle Windows path separator inconsistencies
                const parentNormalized = path.normalize(parent.projectUri.fsPath);
                const childNormalized = path.normalize(child.projectUri.fsPath);

                // Add trailing separator to ensure we match directory boundaries
                const parentWithSep = parentNormalized.endsWith(path.sep)
                    ? parentNormalized
                    : parentNormalized + path.sep;
                const childWithSep = childNormalized.endsWith(path.sep) ? childNormalized : childNormalized + path.sep;

                // Check if child is inside parent (case-insensitive for Windows)
                const childIsInsideParent = childWithSep.toLowerCase().startsWith(parentWithSep.toLowerCase());

                if (childIsInsideParent) {
                    nestedPaths.push(child.projectUri.fsPath);
                    traceInfo(`[test-by-project] Nested: ${child.projectName} is inside ${parent.projectName}`);
                }
            }

            if (nestedPaths.length > 0) {
                ignoreMap.set(getProjectId(parent.projectUri), nestedPaths);
            }
        }

        return ignoreMap;
    }

    /**
     * Determines the test provider based on workspace settings.
     */
    private getTestProvider(workspaceUri: Uri): TestProvider {
        const settings = this.configSettings.getSettings(workspaceUri);
        return settings.testing.unittestEnabled ? UNITTEST_PROVIDER : 'pytest';
    }
}
