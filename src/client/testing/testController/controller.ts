// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { uniq } from 'lodash';
import * as minimatch from 'minimatch';
import * as path from 'path';
import {
    CancellationToken,
    TestController,
    TestItem,
    TestRunRequest,
    tests,
    WorkspaceFolder,
    RelativePattern,
    TestRunProfileKind,
    CancellationTokenSource,
    Uri,
    EventEmitter,
    TextDocument,
    FileCoverageDetail,
    TestRun,
    MarkdownString,
} from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager, IWorkspaceService } from '../../common/application/types';
import * as constants from '../../common/constants';
import { IPythonExecutionFactory } from '../../common/process/types';
import { IConfigurationService, IDisposableRegistry, Resource } from '../../common/types';
import { DelayedTrigger, IDelayedTrigger } from '../../common/utils/delayTrigger';
import { noop } from '../../common/utils/misc';
import { IInterpreterService } from '../../interpreter/contracts';
import { traceError, traceInfo, traceVerbose } from '../../logging';
import { IEventNamePropertyMapping, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../common/constants';
import { TestProvider } from '../types';
import { createErrorTestItem, DebugTestTag, getNodeByUri, RunTestTag } from './common/testItemUtilities';
import { buildErrorNodeOptions } from './common/utils';
import {
    ITestController,
    ITestDiscoveryAdapter,
    ITestFrameworkController,
    TestRefreshOptions,
    ITestExecutionAdapter,
} from './common/types';
import { UnittestTestDiscoveryAdapter } from './unittest/testDiscoveryAdapter';
import { UnittestTestExecutionAdapter } from './unittest/testExecutionAdapter';
import { PytestTestDiscoveryAdapter } from './pytest/pytestDiscoveryAdapter';
import { PytestTestExecutionAdapter } from './pytest/pytestExecutionAdapter';
import { WorkspaceTestAdapter } from './workspaceTestAdapter';
import { ITestDebugLauncher } from '../common/types';
import { PythonResultResolver } from './common/resultResolver';
import { onDidSaveTextDocument } from '../../common/vscodeApis/workspaceApis';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { ProjectAdapter, WorkspaceDiscoveryState } from './common/projectAdapter';
import { getProjectId, createProjectDisplayName } from './common/projectUtils';
import { PythonProject, PythonEnvironment } from '../../envExt/types';
import { getEnvExtApi, useEnvExtension } from '../../envExt/api.internal';
import { isParentPath } from '../../common/platform/fs-paths';

// Types gymnastics to make sure that sendTriggerTelemetry only accepts the correct types.
type EventPropertyType = IEventNamePropertyMapping[EventName.UNITTEST_DISCOVERY_TRIGGER];
type TriggerKeyType = keyof EventPropertyType;
type TriggerType = EventPropertyType[TriggerKeyType];

@injectable()
export class PythonTestController implements ITestController, IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    /**
     * Feature flag for project-based testing.
     * Set to true to enable multi-project testing support (Phases 2-4 must be complete).
     * Default: false (use legacy single-workspace mode)
     */
    private readonly useProjectBasedTesting = true;

    // Legacy: Single workspace test adapter per workspace (backward compatibility)
    private readonly testAdapters: Map<Uri, WorkspaceTestAdapter> = new Map();

    // === NEW: PROJECT-BASED STATE ===
    // Map of workspace URI -> Map of project URI string -> ProjectAdapter
    // Note: Project URI strings match Python Environments extension's Map<string, PythonProject> keys
    private readonly workspaceProjects: Map<Uri, Map<string, ProjectAdapter>> = new Map();

    // Temporary state for tracking overlaps during discovery (created/destroyed per refresh)
    private readonly workspaceDiscoveryState: Map<Uri, WorkspaceDiscoveryState> = new Map();

    // TODO: Phase 3-4 - Add these maps when implementing execution:
    // - vsIdToProject: Map<string, ProjectAdapter> - Fast lookup for test execution
    // - fileUriToProject: Map<string, ProjectAdapter> - File watching and change detection
    // - projectToVsIds: Map<string, Set<string>> - Project cleanup and refresh

    private readonly triggerTypes: TriggerType[] = [];

    private readonly testController: TestController;

    private readonly refreshData: IDelayedTrigger;

    private refreshCancellation: CancellationTokenSource;

    private readonly refreshingCompletedEvent: EventEmitter<void> = new EventEmitter<void>();

    private readonly refreshingStartedEvent: EventEmitter<void> = new EventEmitter<void>();

    private readonly runWithoutConfigurationEvent: EventEmitter<WorkspaceFolder[]> = new EventEmitter<
        WorkspaceFolder[]
    >();

    public readonly onRefreshingCompleted = this.refreshingCompletedEvent.event;

    public readonly onRefreshingStarted = this.refreshingStartedEvent.event;

    public readonly onRunWithoutConfiguration = this.runWithoutConfigurationEvent.event;

    private sendTestDisabledTelemetry = true;

    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private readonly configSettings: IConfigurationService,
        @inject(ITestFrameworkController) @named(PYTEST_PROVIDER) private readonly pytest: ITestFrameworkController,
        @inject(ITestFrameworkController) @named(UNITTEST_PROVIDER) private readonly unittest: ITestFrameworkController,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IPythonExecutionFactory) private readonly pythonExecFactory: IPythonExecutionFactory,
        @inject(ITestDebugLauncher) private readonly debugLauncher: ITestDebugLauncher,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsService: IEnvironmentVariablesProvider,
    ) {
        this.refreshCancellation = new CancellationTokenSource();

        this.testController = tests.createTestController('python-tests', 'Python Tests');
        this.disposables.push(this.testController);

        const delayTrigger = new DelayedTrigger(
            (uri: Uri, invalidate: boolean) => {
                this.refreshTestDataInternal(uri);
                if (invalidate) {
                    this.invalidateTests(uri);
                }
            },
            250, // Delay running the refresh by 250 ms
            'Refresh Test Data',
        );
        this.disposables.push(delayTrigger);
        this.refreshData = delayTrigger;

        this.disposables.push(
            this.testController.createRunProfile(
                'Run Tests',
                TestRunProfileKind.Run,
                this.runTests.bind(this),
                true,
                RunTestTag,
            ),
            this.testController.createRunProfile(
                'Debug Tests',
                TestRunProfileKind.Debug,
                this.runTests.bind(this),
                true,
                DebugTestTag,
            ),
            this.testController.createRunProfile(
                'Coverage Tests',
                TestRunProfileKind.Coverage,
                this.runTests.bind(this),
                true,
                RunTestTag,
            ),
        );

        this.testController.resolveHandler = this.resolveChildren.bind(this);
        this.testController.refreshHandler = (token: CancellationToken) => {
            this.disposables.push(
                token.onCancellationRequested(() => {
                    traceVerbose('Testing: Stop refreshing triggered');
                    sendTelemetryEvent(EventName.UNITTEST_DISCOVERING_STOP);
                    this.stopRefreshing();
                }),
            );

            traceVerbose('Testing: Manually triggered test refresh');
            sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, {
                trigger: constants.CommandSource.commandPalette,
            });
            return this.refreshTestData(undefined, { forceRefresh: true });
        };
    }

    /**
     * Creates test adapters (discovery and execution) for a given test provider.
     * Centralizes adapter creation to reduce code duplication.
     */
    private createTestAdapters(
        testProvider: TestProvider,
        resultResolver: PythonResultResolver,
    ): { discoveryAdapter: ITestDiscoveryAdapter; executionAdapter: ITestExecutionAdapter } {
        if (testProvider === UNITTEST_PROVIDER) {
            return {
                discoveryAdapter: new UnittestTestDiscoveryAdapter(
                    this.configSettings,
                    resultResolver,
                    this.envVarsService,
                ),
                executionAdapter: new UnittestTestExecutionAdapter(
                    this.configSettings,
                    resultResolver,
                    this.envVarsService,
                ),
            };
        }

        return {
            discoveryAdapter: new PytestTestDiscoveryAdapter(this.configSettings, resultResolver, this.envVarsService),
            executionAdapter: new PytestTestExecutionAdapter(this.configSettings, resultResolver, this.envVarsService),
        };
    }

    /**
     * Determines the test provider (pytest or unittest) based on workspace settings.
     */
    private getTestProvider(workspaceUri: Uri): TestProvider {
        const settings = this.configSettings.getSettings(workspaceUri);
        return settings.testing.unittestEnabled ? UNITTEST_PROVIDER : PYTEST_PROVIDER;
    }

    /**
     * Sets up file watchers for test discovery triggers.
     */
    private setupFileWatchers(workspace: WorkspaceFolder): void {
        const settings = this.configSettings.getSettings(workspace.uri);
        if (settings.testing.autoTestDiscoverOnSaveEnabled) {
            traceVerbose(`Testing: Setting up watcher for ${workspace.uri.fsPath}`);
            this.watchForSettingsChanges(workspace);
            this.watchForTestContentChangeOnSave();
        }
    }

    public async activate(): Promise<void> {
        const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];

        // Try to use project-based testing if feature flag is enabled AND environment extension is available
        if (this.useProjectBasedTesting && useEnvExtension()) {
            traceInfo('[test-by-project] Activating project-based testing mode');

            // Use Promise.allSettled to allow partial success in multi-root workspaces
            const results = await Promise.allSettled(
                Array.from(workspaces).map(async (workspace) => {
                    traceInfo(`[test-by-project] Processing workspace: ${workspace.uri.fsPath}`);

                    // Discover projects in this workspace
                    const projects = await this.discoverWorkspaceProjects(workspace.uri);

                    // Create map for this workspace, keyed by project URI (matches Python Environments extension)
                    const projectsMap = new Map<string, ProjectAdapter>();
                    projects.forEach((project) => {
                        const projectKey = getProjectId(project.projectUri);
                        projectsMap.set(projectKey, project);
                    });

                    traceInfo(
                        `[test-by-project] Discovered ${projects.length} project(s) for workspace ${workspace.uri.fsPath}`,
                    );

                    return { workspace, projectsMap };
                }),
            );

            // Handle results individually - allows partial success
            results.forEach((result, index) => {
                const workspace = workspaces[index];
                if (result.status === 'fulfilled') {
                    this.workspaceProjects.set(workspace.uri, result.value.projectsMap);
                    traceInfo(
                        `[test-by-project] Successfully activated ${result.value.projectsMap.size} project(s) for ${workspace.uri.fsPath}`,
                    );
                    this.setupFileWatchers(workspace);
                } else {
                    traceError(
                        `[test-by-project] Failed to activate project-based testing for ${workspace.uri.fsPath}:`,
                        result.reason,
                    );
                    traceInfo('[test-by-project] Falling back to legacy mode for this workspace');
                    // Fall back to legacy mode for this workspace only
                    this.activateLegacyWorkspace(workspace);
                }
            });
            return;
        }

        // Legacy activation (backward compatibility)
        workspaces.forEach((workspace) => {
            this.activateLegacyWorkspace(workspace);
        });
    }

    /**
     * Activates testing for a workspace using the legacy single-adapter approach.
     * Used for backward compatibility when project-based testing is disabled or unavailable.
     */
    private activateLegacyWorkspace(workspace: WorkspaceFolder): void {
        const testProvider = this.getTestProvider(workspace.uri);
        const resultResolver = new PythonResultResolver(this.testController, testProvider, workspace.uri);
        const { discoveryAdapter, executionAdapter } = this.createTestAdapters(testProvider, resultResolver);

        const workspaceTestAdapter = new WorkspaceTestAdapter(
            testProvider,
            discoveryAdapter,
            executionAdapter,
            workspace.uri,
            resultResolver,
        );

        this.testAdapters.set(workspace.uri, workspaceTestAdapter);
        this.setupFileWatchers(workspace);
    }

    /**
     * Discovers Python projects in a workspace using the Python Environment API.
     * Falls back to creating a single default project if API is unavailable or returns no projects.
     */
    private async discoverWorkspaceProjects(workspaceUri: Uri): Promise<ProjectAdapter[]> {
        traceInfo(`[test-by-project] Discovering projects for workspace: ${workspaceUri.fsPath}`);
        try {
            // Check if we should use the environment extension
            if (!useEnvExtension()) {
                traceInfo('[test-by-project] Python Environments extension not enabled, using single project mode');
                return [await this.createDefaultProject(workspaceUri)];
            }

            // Get the environment API
            const envExtApi = await getEnvExtApi();
            traceInfo('[test-by-project] Successfully retrieved Python Environments API');

            // Query for all Python projects in this workspace
            const pythonProjects = envExtApi.getPythonProjects();
            traceInfo(`[test-by-project] Found ${pythonProjects.length} total Python projects from API`);

            // Filter projects to only those in this workspace TODO; check this
            const workspaceProjects = pythonProjects.filter((project) =>
                isParentPath(project.uri.fsPath, workspaceUri.fsPath),
            );
            traceInfo(`[test-by-project] Filtered to ${workspaceProjects.length} projects in workspace`);

            if (workspaceProjects.length === 0) {
                traceInfo(
                    `[test-by-project] No Python projects found for workspace ${workspaceUri.fsPath}, creating default project`,
                );
                return [await this.createDefaultProject(workspaceUri)];
            }

            // Create ProjectAdapter for each Python project
            const projectAdapters: ProjectAdapter[] = [];
            for (const pythonProject of workspaceProjects) {
                try {
                    const adapter = await this.createProjectAdapter(pythonProject, workspaceUri);
                    projectAdapters.push(adapter);
                } catch (error) {
                    traceError(
                        `[test-by-project] Failed to create project adapter for ${pythonProject.uri.fsPath}:`,
                        error,
                    );
                    // Continue with other projects
                }
            }

            if (projectAdapters.length === 0) {
                traceInfo('[test-by-project] All project adapters failed to create, falling back to default project');
                return [await this.createDefaultProject(workspaceUri)];
            }

            traceInfo(`[test-by-project] Successfully created ${projectAdapters.length} project adapter(s)`);
            return projectAdapters;
        } catch (error) {
            traceError(
                '[test-by-project] Failed to discover workspace projects, falling back to single project mode:',
                error,
            );
            return [await this.createDefaultProject(workspaceUri)];
        }
    }

    /**
     * Creates a ProjectAdapter from a PythonProject object.
     */
    private async createProjectAdapter(pythonProject: PythonProject, workspaceUri: Uri): Promise<ProjectAdapter> {
        traceInfo(
            `[test-by-project] Creating project adapter for: ${pythonProject.name} at ${pythonProject.uri.fsPath}`,
        );
        // Use project URI as the project ID (no hashing needed)
        const projectId = pythonProject.uri.fsPath;

        // Resolve the Python environment
        const envExtApi = await getEnvExtApi();
        const pythonEnvironment = await envExtApi.getEnvironment(pythonProject.uri);

        if (!pythonEnvironment) {
            throw new Error(`Failed to resolve Python environment for project ${pythonProject.uri.fsPath}`);
        }

        // Get test provider and create resolver
        const testProvider = this.getTestProvider(workspaceUri);
        const resultResolver = new PythonResultResolver(this.testController, testProvider, workspaceUri, projectId);

        // Create adapters
        const { discoveryAdapter, executionAdapter } = this.createTestAdapters(testProvider, resultResolver);

        // Create display name with Python version
        const projectName = createProjectDisplayName(pythonProject.name, pythonEnvironment.version);

        traceInfo(`[test-by-project] Created project adapter: ${projectName} (ID: ${projectId})`);

        // Create project adapter
        return {
            projectId,
            projectName,
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
     * Creates a default project adapter using the workspace interpreter.
     * Used for backward compatibility when environment API is unavailable.
     */
    private async createDefaultProject(workspaceUri: Uri): Promise<ProjectAdapter> {
        traceInfo(`[test-by-project] Creating default project for workspace: ${workspaceUri.fsPath}`);
        // Get test provider and create resolver (WITHOUT project ID for legacy mode)
        const testProvider = this.getTestProvider(workspaceUri);
        const resultResolver = new PythonResultResolver(this.testController, testProvider, workspaceUri);

        // Create adapters
        const { discoveryAdapter, executionAdapter } = this.createTestAdapters(testProvider, resultResolver);

        // Get active interpreter
        const interpreter = await this.interpreterService.getActiveInterpreter(workspaceUri);

        // Create a mock PythonEnvironment from the interpreter
        const pythonEnvironment: PythonEnvironment = {
            name: 'default',
            displayName: interpreter?.displayName || 'Python',
            shortDisplayName: interpreter?.displayName || 'Python',
            displayPath: interpreter?.path || 'python',
            version: interpreter?.version?.raw || '3.x',
            environmentPath: Uri.file(interpreter?.path || 'python'),
            sysPrefix: interpreter?.sysPrefix || '',
            execInfo: {
                run: {
                    executable: interpreter?.path || 'python',
                },
            },
            envId: {
                id: 'default',
                managerId: 'default',
            },
        };

        // Create a mock PythonProject
        const pythonProject: PythonProject = {
            // Do not assume path separators (fsPath is platform-specific).
            name: path.basename(workspaceUri.fsPath) || 'workspace',
            uri: workspaceUri,
        };

        // Use workspace URI as the project ID
        const projectId = getProjectId(workspaceUri);

        return {
            projectId,
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

    public refreshTestData(uri?: Resource, options?: TestRefreshOptions): Promise<void> {
        if (options?.forceRefresh) {
            if (uri === undefined) {
                // This is a special case where we want everything to be re-discovered.
                traceVerbose('Testing: Clearing all discovered tests');
                this.testController.items.forEach((item) => {
                    const ids: string[] = [];
                    item.children.forEach((child) => ids.push(child.id));
                    ids.forEach((id) => item.children.delete(id));
                });

                traceVerbose('Testing: Forcing test data refresh');
                return this.refreshTestDataInternal(undefined);
            }

            traceVerbose('Testing: Forcing test data refresh');
            return this.refreshTestDataInternal(uri);
        }

        this.refreshData.trigger(uri, false);
        return Promise.resolve();
    }

    public stopRefreshing(): void {
        this.refreshCancellation.cancel();
        this.refreshCancellation.dispose();
        this.refreshCancellation = new CancellationTokenSource();
    }

    public clearTestController(): void {
        const ids: string[] = [];
        this.testController.items.forEach((item) => ids.push(item.id));
        ids.forEach((id) => this.testController.items.delete(id));
    }

    private async refreshTestDataInternal(uri?: Resource): Promise<void> {
        this.refreshingStartedEvent.fire();
        try {
            if (uri) {
                await this.refreshSingleWorkspace(uri);
            } else {
                await this.refreshAllWorkspaces();
            }
        } finally {
            this.refreshingCompletedEvent.fire();
        }
    }

    /**
     * Discovers tests for a single workspace.
     */
    private async refreshSingleWorkspace(uri: Uri): Promise<void> {
        const workspace = this.workspaceService.getWorkspaceFolder(uri);
        if (!workspace?.uri) {
            traceError('Unable to find workspace for given file');
            return;
        }

        const settings = this.configSettings.getSettings(uri);
        traceVerbose(`Discover tests for workspace name: ${workspace.name} - uri: ${uri.fsPath}`);

        // Ensure we send test telemetry if it gets disabled again
        this.sendTestDisabledTelemetry = true;

        // Branch: Use project-based discovery if feature flag enabled and projects exist
        if (this.useProjectBasedTesting && this.workspaceProjects.has(workspace.uri)) {
            await this.refreshWorkspaceProjects(workspace.uri);
            return;
        }

        // Legacy mode: Single workspace adapter
        if (settings.testing.pytestEnabled) {
            await this.discoverTestsForProvider(workspace.uri, 'pytest');
        } else if (settings.testing.unittestEnabled) {
            await this.discoverTestsForProvider(workspace.uri, 'unittest');
        } else {
            await this.handleNoTestProviderEnabled(workspace);
        }
    }

    /**
     * Phase 2: Discovers tests for all projects within a workspace (project-based testing).
     * Runs discovery in parallel for all projects and tracks file overlaps for Phase 3.
     * Each project populates its TestItems independently using the existing discovery flow.
     */
    private async refreshWorkspaceProjects(workspaceUri: Uri): Promise<void> {
        const projectsMap = this.workspaceProjects.get(workspaceUri);
        if (!projectsMap || projectsMap.size === 0) {
            traceError(`[test-by-project] No projects found for workspace: ${workspaceUri.fsPath}`);
            return;
        }

        const projects = Array.from(projectsMap.values());
        traceInfo(`[test-by-project] Starting discovery for ${projects.length} project(s) in workspace`);

        // Initialize discovery state for overlap tracking
        const discoveryState: WorkspaceDiscoveryState = {
            workspaceUri,
            fileToProjects: new Map(),
            fileOwnership: new Map(),
            projectsCompleted: new Set(),
            totalProjects: projects.length,
            isComplete: false,
        };
        this.workspaceDiscoveryState.set(workspaceUri, discoveryState);

        try {
            // Run discovery for all projects in parallel
            // Each project will populate TestItems independently via existing flow
            await Promise.all(projects.map((project) => this.discoverProject(project, discoveryState)));

            // Mark discovery complete
            discoveryState.isComplete = true;
            traceInfo(
                `[test-by-project] Discovery complete: ${discoveryState.projectsCompleted.size}/${projects.length} projects succeeded`,
            );

            // Log overlap information for debugging
            const overlappingFiles = Array.from(discoveryState.fileToProjects.entries()).filter(
                ([, projects]) => projects.size > 1,
            );
            if (overlappingFiles.length > 0) {
                traceInfo(`[test-by-project] Found ${overlappingFiles.length} file(s) discovered by multiple projects`);
            }

            // TODO: Phase 3 - Resolve overlaps and rebuild test tree with proper ownership
            // await this.resolveOverlapsAndAssignTests(workspaceUri);
        } finally {
            // Clean up temporary discovery state
            this.workspaceDiscoveryState.delete(workspaceUri);
        }
    }

    /**
     * Phase 2: Runs test discovery for a single project.
     * Uses the existing discovery flow which populates TestItems automatically.
     * Tracks which files were discovered for overlap detection in Phase 3.
     */
    private async discoverProject(project: ProjectAdapter, discoveryState: WorkspaceDiscoveryState): Promise<void> {
        try {
            traceInfo(`[test-by-project] Discovering tests for project: ${project.projectName}`);
            project.isDiscovering = true;

            // Run discovery using project's adapter with project's interpreter
            // This will call the existing discovery flow which populates TestItems via result resolver
            // Note: The adapter expects the legacy PythonEnvironment type, but for now we can pass
            // the environment from the API. The adapters internally use execInfo which both types have.
            //
            // Pass the ProjectAdapter so discovery adapters can extract project.projectUri.fsPath
            // and set PROJECT_ROOT_PATH environment variable. This tells Python subprocess where to
            // trim the test tree, keeping test paths relative to project root instead of workspace root,
            // while preserving CWD for user's test configurations.
            //
            // TODO: Symlink consideration - If project.projectUri.fsPath contains symlinks,
            // Python's path resolution may differ from Node.js. Discovery adapters should consider
            // using fs.promises.realpath() to resolve symlinks before passing PROJECT_ROOT_PATH to Python,
            // similar to handleSymlinkAndRootDir() in pytest. This ensures PROJECT_ROOT_PATH matches
            // the resolved path Python will use.
            await project.discoveryAdapter.discoverTests(
                project.projectUri,
                this.pythonExecFactory,
                this.refreshCancellation.token,
                project.pythonEnvironment as any, // Type cast needed - API type vs legacy type
                project, // Pass project for access to projectUri and other project-specific data
            );

            // Track which files this project discovered by inspecting created TestItems
            // This data will be used in Phase 3 for overlap resolution
            this.trackProjectDiscoveredFiles(project, discoveryState);

            // Mark project as completed
            discoveryState.projectsCompleted.add(project.projectId);
            traceInfo(`[test-by-project] Project ${project.projectName} discovery completed`);
        } catch (error) {
            traceError(`[test-by-project] Discovery failed for project ${project.projectName}:`, error);
            // Individual project failures don't block others
            discoveryState.projectsCompleted.add(project.projectId); // Still mark as completed
        } finally {
            project.isDiscovering = false;
        }
    }

    /**
     * Tracks which files a project discovered by inspecting its TestItems.
     * Populates the fileToProjects map for overlap detection in Phase 3.
     */
    private trackProjectDiscoveredFiles(project: ProjectAdapter, discoveryState: WorkspaceDiscoveryState): void {
        // Get all test items for this project from its result resolver
        const testItems = project.resultResolver.runIdToTestItem;

        // Extract unique file paths from test items
        const filePaths = new Set<string>();
        testItems.forEach((testItem) => {
            if (testItem.uri) {
                filePaths.add(testItem.uri.fsPath);
            }
        });

        // Track which projects discovered each file
        filePaths.forEach((filePath) => {
            if (!discoveryState.fileToProjects.has(filePath)) {
                discoveryState.fileToProjects.set(filePath, new Set());
            }
            discoveryState.fileToProjects.get(filePath)!.add(project);
        });

        traceVerbose(
            `[test-by-project] Project ${project.projectName} discovered ${filePaths.size} file(s) with ${testItems.size} test(s)`,
        );
    }

    /**
     * Discovers tests for all workspaces in the workspace folders.
     */
    private async refreshAllWorkspaces(): Promise<void> {
        traceVerbose('Testing: Refreshing all test data');
        const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];

        await Promise.all(
            workspaces.map(async (workspace) => {
                if (!(await this.interpreterService.getActiveInterpreter(workspace.uri))) {
                    this.commandManager
                        .executeCommand(constants.Commands.TriggerEnvironmentSelection, workspace.uri)
                        .then(noop, noop);
                    return;
                }
                await this.refreshSingleWorkspace(workspace.uri);
            }),
        );
    }

    /**
     * Discovers tests for a specific test provider (pytest or unittest).
     * Validates that the adapter's provider matches the expected provider.
     */
    private async discoverTestsForProvider(workspaceUri: Uri, expectedProvider: TestProvider): Promise<void> {
        const testAdapter = this.testAdapters.get(workspaceUri);

        if (!testAdapter) {
            traceError('Unable to find test adapter for workspace.');
            return;
        }

        const actualProvider = testAdapter.getTestProvider();
        if (actualProvider !== expectedProvider) {
            traceError(`Test provider in adapter is not ${expectedProvider}. Please reload window.`);
            this.surfaceErrorNode(
                workspaceUri,
                'Test provider types are not aligned, please reload your VS Code window.',
                expectedProvider,
            );
            return;
        }

        await testAdapter.discoverTests(
            this.testController,
            this.pythonExecFactory,
            this.refreshCancellation.token,
            await this.interpreterService.getActiveInterpreter(workspaceUri),
        );
    }

    /**
     * Handles the case when no test provider is enabled.
     * Sends telemetry and removes test items for the workspace from the tree.
     */
    private async handleNoTestProviderEnabled(workspace: WorkspaceFolder): Promise<void> {
        if (this.sendTestDisabledTelemetry) {
            this.sendTestDisabledTelemetry = false;
            sendTelemetryEvent(EventName.UNITTEST_DISABLED);
        }

        this.removeTestItemsForWorkspace(workspace);
    }

    /**
     * Removes all test items belonging to a specific workspace from the test controller.
     * This is used when test discovery is disabled for a workspace.
     */
    private removeTestItemsForWorkspace(workspace: WorkspaceFolder): void {
        const itemsToDelete: string[] = [];

        this.testController.items.forEach((testItem: TestItem) => {
            const itemWorkspace = this.workspaceService.getWorkspaceFolder(testItem.uri);
            if (itemWorkspace?.uri.fsPath === workspace.uri.fsPath) {
                itemsToDelete.push(testItem.id);
            }
        });

        itemsToDelete.forEach((id) => this.testController.items.delete(id));
    }

    private async resolveChildren(item: TestItem | undefined): Promise<void> {
        if (item) {
            traceVerbose(`Testing: Resolving item ${item.id}`);
            const settings = this.configSettings.getSettings(item.uri);
            if (settings.testing.pytestEnabled) {
                return this.pytest.resolveChildren(this.testController, item, this.refreshCancellation.token);
            }
            if (settings.testing.unittestEnabled) {
                return this.unittest.resolveChildren(this.testController, item, this.refreshCancellation.token);
            }
        } else {
            traceVerbose('Testing: Refreshing all test data');
            this.sendTriggerTelemetry('auto');
            const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];
            await Promise.all(
                workspaces.map(async (workspace) => {
                    if (!(await this.interpreterService.getActiveInterpreter(workspace.uri))) {
                        traceError('Cannot trigger test discovery as a valid interpreter is not selected');
                        return;
                    }
                    await this.refreshTestDataInternal(workspace.uri);
                }),
            );
        }
        return Promise.resolve();
    }

    private async runTests(request: TestRunRequest, token: CancellationToken): Promise<void> {
        const workspaces = this.getWorkspacesForTestRun(request);
        const runInstance = this.testController.createTestRun(
            request,
            `Running Tests for Workspace(s): ${workspaces.map((w) => w.uri.fsPath).join(';')}`,
            true,
        );

        const dispose = token.onCancellationRequested(() => {
            runInstance.appendOutput(`\nRun instance cancelled.\r\n`);
            runInstance.end();
        });

        const unconfiguredWorkspaces: WorkspaceFolder[] = [];

        try {
            await Promise.all(
                workspaces.map((workspace) =>
                    this.runTestsForWorkspace(workspace, request, runInstance, token, unconfiguredWorkspaces),
                ),
            );
        } finally {
            traceVerbose('Finished running tests, ending runInstance.');
            runInstance.appendOutput(`Finished running tests!\r\n`);
            runInstance.end();
            dispose.dispose();
            if (unconfiguredWorkspaces.length > 0) {
                this.runWithoutConfigurationEvent.fire(unconfiguredWorkspaces);
            }
        }
    }

    /**
     * Gets the list of workspaces to run tests for based on the test run request.
     */
    private getWorkspacesForTestRun(request: TestRunRequest): WorkspaceFolder[] {
        if (request.include) {
            const workspaces: WorkspaceFolder[] = [];
            uniq(request.include.map((r) => this.workspaceService.getWorkspaceFolder(r.uri))).forEach((w) => {
                if (w) {
                    workspaces.push(w);
                }
            });
            return workspaces;
        }
        return Array.from(this.workspaceService.workspaceFolders || []);
    }

    /**
     * Runs tests for a single workspace.
     */
    private async runTestsForWorkspace(
        workspace: WorkspaceFolder,
        request: TestRunRequest,
        runInstance: TestRun,
        token: CancellationToken,
        unconfiguredWorkspaces: WorkspaceFolder[],
    ): Promise<void> {
        if (!(await this.interpreterService.getActiveInterpreter(workspace.uri))) {
            this.commandManager
                .executeCommand(constants.Commands.TriggerEnvironmentSelection, workspace.uri)
                .then(noop, noop);
            return;
        }

        const testItems = this.getTestItemsForWorkspace(workspace, request);
        const settings = this.configSettings.getSettings(workspace.uri);

        if (testItems.length === 0) {
            if (!settings.testing.pytestEnabled && !settings.testing.unittestEnabled) {
                unconfiguredWorkspaces.push(workspace);
            }
            return;
        }

        const testAdapter =
            this.testAdapters.get(workspace.uri) || (this.testAdapters.values().next().value as WorkspaceTestAdapter);

        this.setupCoverageIfNeeded(request, testAdapter);

        if (settings.testing.pytestEnabled) {
            await this.executeTestsForProvider(
                workspace,
                testAdapter,
                testItems,
                runInstance,
                request,
                token,
                'pytest',
            );
        } else if (settings.testing.unittestEnabled) {
            await this.executeTestsForProvider(
                workspace,
                testAdapter,
                testItems,
                runInstance,
                request,
                token,
                'unittest',
            );
        } else {
            unconfiguredWorkspaces.push(workspace);
        }
    }

    /**
     * Gets test items that belong to a specific workspace from the run request.
     */
    private getTestItemsForWorkspace(workspace: WorkspaceFolder, request: TestRunRequest): TestItem[] {
        const testItems: TestItem[] = [];
        // If the run request includes test items then collect only items that belong to
        // `workspace`. If there are no items in the run request then just run the `workspace`
        // root test node. Include will be `undefined` in the "run all" scenario.
        (request.include ?? this.testController.items).forEach((i: TestItem) => {
            const w = this.workspaceService.getWorkspaceFolder(i.uri);
            if (w?.uri.fsPath === workspace.uri.fsPath) {
                testItems.push(i);
            }
        });
        return testItems;
    }

    /**
     * Sets up detailed coverage loading if the run profile is for coverage.
     */
    private setupCoverageIfNeeded(request: TestRunRequest, testAdapter: WorkspaceTestAdapter): void {
        // no profile will have TestRunProfileKind.Coverage if rewrite isn't enabled
        if (request.profile?.kind && request.profile?.kind === TestRunProfileKind.Coverage) {
            request.profile.loadDetailedCoverage = (
                _testRun: TestRun,
                fileCoverage,
                _token,
            ): Thenable<FileCoverageDetail[]> => {
                const details = testAdapter.resultResolver.detailedCoverageMap.get(fileCoverage.uri.fsPath);
                if (details === undefined) {
                    // given file has no detailed coverage data
                    return Promise.resolve([]);
                }
                return Promise.resolve(details);
            };
        }
    }

    /**
     * Executes tests using the test adapter for a specific test provider.
     */
    private async executeTestsForProvider(
        workspace: WorkspaceFolder,
        testAdapter: WorkspaceTestAdapter,
        testItems: TestItem[],
        runInstance: TestRun,
        request: TestRunRequest,
        token: CancellationToken,
        provider: TestProvider,
    ): Promise<void> {
        sendTelemetryEvent(EventName.UNITTEST_RUN, undefined, {
            tool: provider,
            debugging: request.profile?.kind === TestRunProfileKind.Debug,
        });

        await testAdapter.executeTests(
            this.testController,
            runInstance,
            testItems,
            this.pythonExecFactory,
            token,
            request.profile?.kind,
            this.debugLauncher,
            await this.interpreterService.getActiveInterpreter(workspace.uri),
        );
    }

    private invalidateTests(uri: Uri) {
        this.testController.items.forEach((root) => {
            const item = getNodeByUri(root, uri);
            if (item && !!item.invalidateResults) {
                // Minimize invalidating to test case nodes for the test file where
                // the change occurred
                item.invalidateResults();
            }
        });
    }

    private watchForSettingsChanges(workspace: WorkspaceFolder): void {
        const pattern = new RelativePattern(workspace, '**/{settings.json,pytest.ini,pyproject.toml,setup.cfg}');
        const watcher = this.workspaceService.createFileSystemWatcher(pattern);
        this.disposables.push(watcher);

        this.disposables.push(
            onDidSaveTextDocument(async (doc: TextDocument) => {
                const file = doc.fileName;
                // refresh on any settings file save
                if (
                    file.includes('settings.json') ||
                    file.includes('pytest.ini') ||
                    file.includes('setup.cfg') ||
                    file.includes('pyproject.toml')
                ) {
                    traceVerbose(`Testing: Trigger refresh after saving ${doc.uri.fsPath}`);
                    this.sendTriggerTelemetry('watching');
                    this.refreshData.trigger(doc.uri, false);
                }
            }),
        );
        /* Keep both watchers for create and delete since config files can change test behavior without content
        due to their impact on pythonPath. */
        this.disposables.push(
            watcher.onDidCreate((uri) => {
                traceVerbose(`Testing: Trigger refresh after creating ${uri.fsPath}`);
                this.sendTriggerTelemetry('watching');
                this.refreshData.trigger(uri, false);
            }),
        );
        this.disposables.push(
            watcher.onDidDelete((uri) => {
                traceVerbose(`Testing: Trigger refresh after deleting in ${uri.fsPath}`);
                this.sendTriggerTelemetry('watching');
                this.refreshData.trigger(uri, false);
            }),
        );
    }

    private watchForTestContentChangeOnSave(): void {
        this.disposables.push(
            onDidSaveTextDocument(async (doc: TextDocument) => {
                const settings = this.configSettings.getSettings(doc.uri);
                if (
                    settings.testing.autoTestDiscoverOnSaveEnabled &&
                    minimatch.default(doc.uri.fsPath, settings.testing.autoTestDiscoverOnSavePattern)
                ) {
                    traceVerbose(`Testing: Trigger refresh after saving ${doc.uri.fsPath}`);
                    this.sendTriggerTelemetry('watching');
                    this.refreshData.trigger(doc.uri, false);
                }
            }),
        );
    }

    /**
     * Send UNITTEST_DISCOVERY_TRIGGER telemetry event only once per trigger type.
     *
     * @param triggerType The trigger type to send telemetry for.
     */
    private sendTriggerTelemetry(trigger: TriggerType): void {
        if (!this.triggerTypes.includes(trigger)) {
            sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, {
                trigger,
            });
            this.triggerTypes.push(trigger);
        }
    }

    private surfaceErrorNode(workspaceUri: Uri, message: string, testProvider: TestProvider): void {
        let errorNode = this.testController.items.get(`DiscoveryError:${workspaceUri.fsPath}`);
        if (errorNode === undefined) {
            const options = buildErrorNodeOptions(workspaceUri, message, testProvider);
            errorNode = createErrorTestItem(this.testController, options);
            this.testController.items.add(errorNode);
        }
        const errorNodeLabel: MarkdownString = new MarkdownString(message);
        errorNodeLabel.isTrusted = true;
        errorNode.error = errorNodeLabel;
    }
}
