// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { uniq } from 'lodash';
import * as minimatch from 'minimatch';
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
import { ITestController, ITestFrameworkController, TestRefreshOptions } from './common/types';
import { WorkspaceTestAdapter } from './workspaceTestAdapter';
import { ITestDebugLauncher } from '../common/types';
import { PythonResultResolver } from './common/resultResolver';
import { onDidSaveTextDocument } from '../../common/vscodeApis/workspaceApis';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { ProjectAdapter } from './common/projectAdapter';
import { TestProjectRegistry } from './common/testProjectRegistry';
import { createTestAdapters, getProjectId } from './common/projectUtils';
import { executeTestsForProjects } from './common/projectTestExecution';
import { useEnvExtension, getEnvExtApi } from '../../envExt/api.internal';
import { DidChangePythonProjectsEventArgs, PythonProject } from '../../envExt/types';

// Types gymnastics to make sure that sendTriggerTelemetry only accepts the correct types.
type EventPropertyType = IEventNamePropertyMapping[EventName.UNITTEST_DISCOVERY_TRIGGER];
type TriggerKeyType = keyof EventPropertyType;
type TriggerType = EventPropertyType[TriggerKeyType];

@injectable()
export class PythonTestController implements ITestController, IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    // Legacy: Single workspace test adapter per workspace (backward compatibility)
    private readonly testAdapters: Map<Uri, WorkspaceTestAdapter> = new Map();

    // Registry for multi-project testing (one registry instance manages all projects across workspaces)
    private readonly projectRegistry: TestProjectRegistry;

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

        // Initialize project registry for multi-project testing support
        this.projectRegistry = new TestProjectRegistry(
            this.testController,
            this.configSettings,
            this.interpreterService,
            this.envVarsService,
        );

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

    /**
     * Activates the test controller for all workspaces.
     *
     * Two activation modes:
     * 1. **Project-based mode** (when Python Environments API available):
     * 2. **Legacy mode** (fallback):
     *
     * Uses `Promise.allSettled` for resilient multi-workspace activation:
     */
    public async activate(): Promise<void> {
        const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];

        // PROJECT-BASED MODE: Uses Python Environments API to discover projects
        // Each project becomes its own test tree root with its own Python environment
        if (useEnvExtension()) {
            traceInfo('[test-by-project] Activating project-based testing mode');

            // Discover projects in parallel across all workspaces
            // Promise.allSettled ensures one workspace failure doesn't block others
            const results = await Promise.allSettled(
                Array.from(workspaces).map(async (workspace) => {
                    // Queries Python Environments API and creates ProjectAdapter instances
                    const projects = await this.projectRegistry.discoverAndRegisterProjects(workspace.uri);
                    return { workspace, projectCount: projects.length };
                }),
            );

            // Process results: successful workspaces get file watchers, failed ones fall back to legacy
            results.forEach((result, index) => {
                const workspace = workspaces[index];
                if (result.status === 'fulfilled') {
                    traceInfo(
                        `[test-by-project] Activated ${result.value.projectCount} project(s) for ${workspace.uri.fsPath}`,
                    );
                    this.setupFileWatchers(workspace);
                } else {
                    // Graceful degradation: if project discovery fails, use legacy single-adapter mode
                    traceError(`[test-by-project] Failed for ${workspace.uri.fsPath}:`, result.reason);
                    this.activateLegacyWorkspace(workspace);
                }
            });
            // Subscribe to project changes to update test tree when projects are added/removed
            await this.subscribeToProjectChanges();
            return;
        }

        // LEGACY MODE: Single WorkspaceTestAdapter per workspace (backward compatibility)
        workspaces.forEach((workspace) => {
            this.activateLegacyWorkspace(workspace);
        });
    }

    /**
     * Subscribes to Python project changes from the Python Environments API.
     * When projects are added or removed, updates the test tree accordingly.
     */
    private async subscribeToProjectChanges(): Promise<void> {
        try {
            const envExtApi = await getEnvExtApi();
            this.disposables.push(
                envExtApi.onDidChangePythonProjects((event: DidChangePythonProjectsEventArgs) => {
                    this.handleProjectChanges(event).catch((error) => {
                        traceError('[test-by-project] Error handling project changes:', error);
                    });
                }),
            );
            traceInfo('[test-by-project] Subscribed to Python project changes');
        } catch (error) {
            traceError('[test-by-project] Failed to subscribe to project changes:', error);
        }
    }

    /**
     * Handles changes to Python projects (added or removed).
     * Cleans up stale test items and re-discovers projects and tests for affected workspaces.
     */
    private async handleProjectChanges(event: DidChangePythonProjectsEventArgs): Promise<void> {
        const { added, removed } = event;

        if (added.length === 0 && removed.length === 0) {
            return;
        }

        traceInfo(`[test-by-project] Project changes detected: ${added.length} added, ${removed.length} removed`);

        // Find all affected workspaces
        const affectedWorkspaces = new Set<WorkspaceFolder>();

        const findWorkspace = (project: PythonProject): WorkspaceFolder | undefined => {
            return this.workspaceService.getWorkspaceFolder(project.uri);
        };

        for (const project of [...added, ...removed]) {
            const workspace = findWorkspace(project);
            if (workspace) {
                affectedWorkspaces.add(workspace);
            }
        }

        // For each affected workspace, clean up and re-discover
        for (const workspace of affectedWorkspaces) {
            traceInfo(`[test-by-project] Re-discovering projects for workspace: ${workspace.uri.fsPath}`);

            // Get the current projects before clearing to know what to clean up
            const existingProjects = this.projectRegistry.getProjectsArray(workspace.uri);

            // Remove ALL test items for the affected workspace's projects
            // This ensures no stale items remain from deleted/changed projects
            this.removeWorkspaceProjectTestItems(workspace.uri, existingProjects);

            // Also explicitly remove test items for removed projects (in case they weren't tracked)
            for (const project of removed) {
                const projectWorkspace = findWorkspace(project);
                if (projectWorkspace?.uri.toString() === workspace.uri.toString()) {
                    this.removeProjectTestItems(project);
                }
            }

            // Re-discover all projects and tests for the workspace in a single pass.
            // discoverAllProjectsInWorkspace is responsible for clearing/re-registering
            // projects and performing test discovery for the workspace.
            await this.discoverAllProjectsInWorkspace(workspace.uri);
        }
    }

    /**
     * Removes all test items associated with projects in a workspace.
     * Used to clean up stale items before re-discovery.
     */
    private removeWorkspaceProjectTestItems(workspaceUri: Uri, projects: ProjectAdapter[]): void {
        const idsToRemove: string[] = [];

        // Collect IDs of test items belonging to any project in this workspace
        for (const project of projects) {
            const projectIdPrefix = getProjectId(project.projectUri);
            const projectFsPath = project.projectUri.fsPath;

            this.testController.items.forEach((item) => {
                // Match by project ID prefix (e.g., "file:///path@@vsc@@...")
                if (item.id.startsWith(projectIdPrefix)) {
                    idsToRemove.push(item.id);
                }
                // Match by fsPath in ID (legacy items might use path directly)
                else if (item.id.includes(projectFsPath)) {
                    idsToRemove.push(item.id);
                }
                // Match by item URI being within project directory
                else if (item.uri && item.uri.fsPath.startsWith(projectFsPath)) {
                    idsToRemove.push(item.id);
                }
            });
        }

        // Also remove any items whose URI is within the workspace (catch-all for edge cases)
        this.testController.items.forEach((item) => {
            if (
                item.uri &&
                this.workspaceService.getWorkspaceFolder(item.uri)?.uri.toString() === workspaceUri.toString()
            ) {
                if (!idsToRemove.includes(item.id)) {
                    idsToRemove.push(item.id);
                }
            }
        });

        // Remove all collected items
        for (const id of idsToRemove) {
            this.testController.items.delete(id);
        }

        traceInfo(
            `[test-by-project] Cleaned up ${idsToRemove.length} test items for workspace: ${workspaceUri.fsPath}`,
        );
    }

    /**
     * Removes test items associated with a specific project from the test controller.
     * Matches items by project ID prefix, fsPath, or URI.
     */
    private removeProjectTestItems(project: PythonProject): void {
        const projectId = getProjectId(project.uri);
        const projectFsPath = project.uri.fsPath;
        const idsToRemove: string[] = [];

        // Find all root items that belong to this project
        this.testController.items.forEach((item) => {
            // Match by project ID prefix (e.g., "file:///path@@vsc@@...")
            if (item.id.startsWith(projectId)) {
                idsToRemove.push(item.id);
            }
            // Match by fsPath in ID (items might use path directly without URI prefix)
            else if (item.id.startsWith(projectFsPath) || item.id.includes(projectFsPath)) {
                idsToRemove.push(item.id);
            }
            // Match by item URI being within project directory
            else if (item.uri && item.uri.fsPath.startsWith(projectFsPath)) {
                idsToRemove.push(item.id);
            }
        });

        for (const id of idsToRemove) {
            this.testController.items.delete(id);
            traceVerbose(`[test-by-project] Removed test item: ${id}`);
        }

        if (idsToRemove.length > 0) {
            traceInfo(`[test-by-project] Removed ${idsToRemove.length} test items for project: ${project.name}`);
        }
    }

    /**
     * Activates testing for a workspace using the legacy single-adapter approach.
     * Used for backward compatibility when project-based testing is disabled or unavailable.
     */
    private activateLegacyWorkspace(workspace: WorkspaceFolder): void {
        const testProvider = this.getTestProvider(workspace.uri);
        const resultResolver = new PythonResultResolver(this.testController, testProvider, workspace.uri);
        const { discoveryAdapter, executionAdapter } = createTestAdapters(
            testProvider,
            resultResolver,
            this.configSettings,
            this.envVarsService,
        );

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
                await this.discoverTestsInWorkspace(uri);
            } else {
                await this.discoverTestsInAllWorkspaces();
            }
        } finally {
            this.refreshingCompletedEvent.fire();
        }
    }

    /**
     * Discovers tests for a single workspace.
     *
     * **Discovery flow:**
     * 1. If the workspace has registered projects (via Python Environments API),
     *    uses project-based discovery: each project is discovered independently
     *    with its own Python environment and test adapters.
     * 2. Otherwise, falls back to legacy mode: a single WorkspaceTestAdapter
     *    discovers all tests in the workspace using the active interpreter.
     *
     * In project-based mode, the test tree will have separate roots for each project.
     * In legacy mode, the workspace folder is the single test tree root.
     */
    private async discoverTestsInWorkspace(uri: Uri): Promise<void> {
        const workspace = this.workspaceService.getWorkspaceFolder(uri);
        if (!workspace?.uri) {
            traceError('Unable to find workspace for given file');
            return;
        }

        const settings = this.configSettings.getSettings(uri);
        traceVerbose(`Discover tests for workspace name: ${workspace.name} - uri: ${uri.fsPath}`);

        // Ensure we send test telemetry if it gets disabled again
        this.sendTestDisabledTelemetry = true;

        // Check if any test framework is enabled BEFORE project-based discovery
        // This ensures the config screen stays visible when testing is disabled
        if (!settings.testing.pytestEnabled && !settings.testing.unittestEnabled) {
            await this.handleNoTestProviderEnabled(workspace);
            return;
        }

        // Use project-based discovery if applicable (only reached if testing is enabled)
        if (this.projectRegistry.hasProjects(workspace.uri)) {
            await this.discoverAllProjectsInWorkspace(workspace.uri);
            return;
        }

        // Legacy mode: Single workspace adapter
        if (settings.testing.pytestEnabled) {
            await this.discoverWorkspaceTestsLegacy(workspace.uri, 'pytest');
        } else if (settings.testing.unittestEnabled) {
            await this.discoverWorkspaceTestsLegacy(workspace.uri, 'unittest');
        }
    }

    /**
     * Discovers tests for all projects within a workspace (project-based mode).
     * Re-discovers projects from the Python Environments API before running test discovery.
     * This ensures the test tree stays in sync with project changes.
     */
    private async discoverAllProjectsInWorkspace(workspaceUri: Uri): Promise<void> {
        // Defensive check: ensure testing is enabled (should be checked by caller, but be safe)
        const settings = this.configSettings.getSettings(workspaceUri);
        if (!settings.testing.pytestEnabled && !settings.testing.unittestEnabled) {
            traceVerbose('[test-by-project] Skipping discovery - no test framework enabled');
            return;
        }

        // Get existing projects before re-discovery for cleanup
        const existingProjects = this.projectRegistry.getProjectsArray(workspaceUri);

        // Clean up all existing test items for this workspace
        // This ensures stale items from deleted/changed projects are removed
        this.removeWorkspaceProjectTestItems(workspaceUri, existingProjects);

        // Re-discover projects from Python Environments API
        // This picks up any added/removed projects since last discovery
        this.projectRegistry.clearWorkspace(workspaceUri);
        const projects = await this.projectRegistry.discoverAndRegisterProjects(workspaceUri);

        if (projects.length === 0) {
            traceError(`[test-by-project] No projects found for workspace: ${workspaceUri.fsPath}`);
            return;
        }

        traceInfo(`[test-by-project] Starting discovery for ${projects.length} project(s) in workspace`);

        try {
            // Configure nested project exclusions before discovery
            this.projectRegistry.configureNestedProjectIgnores(workspaceUri);

            // Track completion for progress logging
            const projectsCompleted = new Set<string>();

            // Run discovery for all projects in parallel
            await Promise.all(projects.map((project) => this.discoverTestsForProject(project, projectsCompleted)));

            traceInfo(
                `[test-by-project] Discovery complete: ${projectsCompleted.size}/${projects.length} projects completed`,
            );
        } catch (error) {
            traceError(`[test-by-project] Discovery failed for workspace ${workspaceUri.fsPath}:`, error);
        }
    }

    /**
     * Discovers tests for a single project (project-based mode).
     * Creates test tree items rooted at the project's directory.
     */
    private async discoverTestsForProject(project: ProjectAdapter, projectsCompleted: Set<string>): Promise<void> {
        try {
            traceInfo(`[test-by-project] Discovering tests for project: ${project.projectName}`);
            project.isDiscovering = true;

            // In project-based mode, the discovery adapter uses the Python Environments API
            // to get the environment directly, so we don't need to pass the interpreter
            await project.discoveryAdapter.discoverTests(
                project.projectUri,
                this.pythonExecFactory,
                this.refreshCancellation.token,
                undefined, // Interpreter not needed; adapter uses Python Environments API
                project,
            );

            // Mark project as completed (use URI string as unique key)
            projectsCompleted.add(project.projectUri.toString());
            traceInfo(`[test-by-project] Project ${project.projectName} discovery completed`);
        } catch (error) {
            traceError(`[test-by-project] Discovery failed for project ${project.projectName}:`, error);
            // Individual project failures don't block others
            projectsCompleted.add(project.projectUri.toString()); // Still mark as completed
        } finally {
            project.isDiscovering = false;
        }
    }

    /**
     * Discovers tests across all workspace folders.
     * Iterates each workspace and triggers discovery.
     */
    private async discoverTestsInAllWorkspaces(): Promise<void> {
        traceVerbose('Testing: Refreshing all test data');
        const workspaces: readonly WorkspaceFolder[] = this.workspaceService.workspaceFolders || [];

        await Promise.all(
            workspaces.map(async (workspace) => {
                // In project-based mode, each project has its own environment,
                // so we don't require a global active interpreter
                if (!useEnvExtension()) {
                    if (!(await this.interpreterService.getActiveInterpreter(workspace.uri))) {
                        this.commandManager
                            .executeCommand(constants.Commands.TriggerEnvironmentSelection, workspace.uri)
                            .then(noop, noop);
                        return;
                    }
                }
                await this.discoverTestsInWorkspace(workspace.uri);
            }),
        );
    }

    /**
     * Discovers tests for a workspace using legacy single-adapter mode.
     */
    private async discoverWorkspaceTestsLegacy(workspaceUri: Uri, expectedProvider: TestProvider): Promise<void> {
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
                    // In project-based mode, each project has its own environment,
                    // so we don't require a global active interpreter
                    if (!useEnvExtension()) {
                        if (!(await this.interpreterService.getActiveInterpreter(workspace.uri))) {
                            traceError('Cannot trigger test discovery as a valid interpreter is not selected');
                            return;
                        }
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

        // Check if we're in project-based mode and should use project-specific execution
        if (this.projectRegistry.hasProjects(workspace.uri)) {
            const projects = this.projectRegistry.getProjectsArray(workspace.uri);
            await executeTestsForProjects(projects, testItems, runInstance, request, token, {
                projectRegistry: this.projectRegistry,
                pythonExecFactory: this.pythonExecFactory,
                debugLauncher: this.debugLauncher,
            });
            return;
        }

        // For unittest (or pytest when not in project mode), use the legacy WorkspaceTestAdapter.
        // In project mode, legacy adapters may not be initialized, so create one on demand.
        let testAdapter = this.testAdapters.get(workspace.uri);
        if (!testAdapter) {
            // Initialize legacy adapter on demand (needed for unittest in project mode)
            this.activateLegacyWorkspace(workspace);
            testAdapter = this.testAdapters.get(workspace.uri);
        }

        if (!testAdapter) {
            traceError(`[test] No test adapter available for workspace: ${workspace.uri.fsPath}`);
            return;
        }

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
            request.exclude,
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
