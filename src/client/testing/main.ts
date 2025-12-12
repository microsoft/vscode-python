'use strict';

import { inject, injectable } from 'inversify';
import {
    ConfigurationChangeEvent,
    Disposable,
    Uri,
    tests,
    TestResultState,
    WorkspaceFolder,
    Command,
    TestItem,
} from 'vscode';
import { IApplicationShell, ICommandManager, IContextKeyManager, IWorkspaceService } from '../common/application/types';
import * as constants from '../common/constants';
import '../common/extensions';
import { IDisposableRegistry, Product } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { EventName } from '../telemetry/constants';
import { sendTelemetryEvent } from '../telemetry/index';
import { selectTestWorkspace } from './common/testUtils';
import { TestSettingsPropertyNames } from './configuration/types';
import { ITestConfigurationService, ITestsHelper } from './common/types';
import { ITestingService } from './types';
import { IExtensionActivationService } from '../activation/types';
import { ITestController } from './testController/common/types';
import { DelayedTrigger, IDelayedTrigger } from '../common/utils/delayTrigger';
import { ExtensionContextKey } from '../common/application/contextKeys';
import { checkForFailedTests, updateTestResultMap } from './testController/common/testItemUtilities';
import { Testing } from '../common/utils/localize';
import { traceVerbose, traceWarn } from '../logging';
import { writeTestIdToClipboard } from './utils';

@injectable()
export class TestingService implements ITestingService {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}

    public getSettingsPropertyNames(product: Product): TestSettingsPropertyNames {
        const helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        return helper.getSettingsPropertyNames(product);
    }
}

/**
 * Registers command handlers but defers service resolution until the commands are actually invoked,
 * allowing registration to happen before all services are fully initialized.
 */
export function registerTestCommands(serviceContainer: IServiceContainer): void {
    // Resolve only the essential services needed for command registration itself
    const disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);
    const commandManager = serviceContainer.get<ICommandManager>(ICommandManager);

    // Helper function to configure tests - services are resolved when invoked, not at registration time
    const configureTestsHandler = async (resource?: Uri) => {
        sendTelemetryEvent(EventName.UNITTEST_CONFIGURE);

        // Resolve services lazily when the command is invoked
        const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);

        let wkspace: Uri | undefined;
        if (resource) {
            const wkspaceFolder = workspaceService.getWorkspaceFolder(resource);
            wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
        } else {
            const appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
            wkspace = await selectTestWorkspace(appShell);
        }
        if (!wkspace) {
            return;
        }
        const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
        const cmdManager = serviceContainer.get<ICommandManager>(ICommandManager);
        if (!(await interpreterService.getActiveInterpreter(wkspace))) {
            cmdManager.executeCommand(constants.Commands.TriggerEnvironmentSelection, wkspace);
            return;
        }
        const configurationService = serviceContainer.get<ITestConfigurationService>(ITestConfigurationService);
        await configurationService.promptToEnableAndConfigureTestFramework(wkspace);
    };

    disposableRegistry.push(
        // Command: python.configureTests - prompts user to configure test framework
        commandManager.registerCommand(
            constants.Commands.Tests_Configure,
            (_, _cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource?: Uri) => {
                // Invoke configuration handler (errors are ignored as this can be called from multiple places)
                configureTestsHandler(resource).ignoreErrors();
                traceVerbose('Testing: Trigger refresh after config change');
                // Refresh test data if test controller is available (resolved lazily)
                if (tests && !!tests.createTestController) {
                    const testController = serviceContainer.get<ITestController>(ITestController);
                    testController?.refreshTestData(resource, { forceRefresh: true });
                }
            },
        ),
        // Command: python.tests.copilotSetup - Copilot integration for test setup
        commandManager.registerCommand(constants.Commands.Tests_CopilotSetup, (resource?: Uri):
            | { message: string; command: Command }
            | undefined => {
            // Resolve services lazily when the command is invoked
            const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
            const wkspaceFolder =
                workspaceService.getWorkspaceFolder(resource) || workspaceService.workspaceFolders?.at(0);
            if (!wkspaceFolder) {
                return undefined;
            }

            const configurationService = serviceContainer.get<ITestConfigurationService>(ITestConfigurationService);
            if (configurationService.hasConfiguredTests(wkspaceFolder.uri)) {
                return undefined;
            }

            return {
                message: Testing.copilotSetupMessage,
                command: {
                    title: Testing.configureTests,
                    command: constants.Commands.Tests_Configure,
                    arguments: [undefined, constants.CommandSource.ui, resource],
                },
            };
        }),
        // Command: python.copyTestId - copies test ID to clipboard
        commandManager.registerCommand(constants.Commands.CopyTestId, async (testItem: TestItem) => {
            writeTestIdToClipboard(testItem);
        }),
    );
}

@injectable()
export class UnitTestManagementService implements IExtensionActivationService {
    private activatedOnce: boolean = false;
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };
    private readonly disposableRegistry: Disposable[];
    private workspaceService: IWorkspaceService;
    private context: IContextKeyManager;
    private testController: ITestController | undefined;
    private configChangeTrigger: IDelayedTrigger;

    // This is temporarily needed until the proposed API settles for this part
    private testStateMap: Map<string, TestResultState> = new Map();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.context = this.serviceContainer.get<IContextKeyManager>(IContextKeyManager);

        if (tests && !!tests.createTestController) {
            this.testController = serviceContainer.get<ITestController>(ITestController);
        }

        const configChangeTrigger = new DelayedTrigger(
            this.configurationChangeHandler.bind(this),
            500,
            'Test Configuration Change',
        );
        this.configChangeTrigger = configChangeTrigger;
        this.disposableRegistry.push(configChangeTrigger);
    }

    public async activate(): Promise<void> {
        if (this.activatedOnce) {
            return;
        }
        this.activatedOnce = true;

        this.registerHandlers();

        if (!!tests.testResults) {
            await this.updateTestUIButtons();
            this.disposableRegistry.push(
                tests.onDidChangeTestResults(() => {
                    this.updateTestUIButtons();
                }),
            );
        }

        if (this.testController) {
            this.testController.onRefreshingStarted(async () => {
                await this.context.setContext(ExtensionContextKey.RefreshingTests, true);
            });
            this.testController.onRefreshingCompleted(async () => {
                await this.context.setContext(ExtensionContextKey.RefreshingTests, false);
            });
            this.testController.onRunWithoutConfiguration(async (unconfigured: WorkspaceFolder[]) => {
                const workspaces = this.workspaceService.workspaceFolders ?? [];
                if (unconfigured.length === workspaces.length) {
                    const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
                    await commandManager.executeCommand('workbench.view.testing.focus');
                    traceWarn(
                        'Testing: Run attempted but no test configurations found for any workspace, use command palette to configure tests for python if desired.',
                    );
                }
            });
        }
    }

    private async updateTestUIButtons() {
        // See if we already have stored tests results from previous runs.
        // The tests results currently has a historical test status based on runs. To get a
        // full picture of the tests state these need to be reduced by test id.
        updateTestResultMap(this.testStateMap, tests.testResults);

        const hasFailedTests = checkForFailedTests(this.testStateMap);
        await this.context.setContext(ExtensionContextKey.HasFailedTests, hasFailedTests);
    }

    private async configurationChangeHandler(eventArgs: ConfigurationChangeEvent) {
        const workspaces = this.workspaceService.workspaceFolders ?? [];
        const changedWorkspaces: Uri[] = workspaces
            .filter((w) => eventArgs.affectsConfiguration('python.testing', w.uri))
            .map((w) => w.uri);

        await Promise.all(changedWorkspaces.map((u) => this.testController?.refreshTestData(u)));
    }

    private registerHandlers() {
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.disposableRegistry.push(
            this.workspaceService.onDidChangeConfiguration((e) => {
                this.configChangeTrigger.trigger(e);
            }),
            interpreterService.onDidChangeInterpreter(async () => {
                traceVerbose('Testing: Triggered refresh due to interpreter change.');
                sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_TRIGGER, undefined, { trigger: 'interpreter' });
                await this.testController?.refreshTestData(undefined, { forceRefresh: true });
            }),
        );
    }
}
