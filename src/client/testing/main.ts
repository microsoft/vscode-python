'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, Uri, tests } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import * as constants from '../common/constants';
import '../common/extensions';
import { IDisposableRegistry, Product } from '../common/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { EventName } from '../telemetry/constants';
import { captureTelemetry } from '../telemetry/index';
import { selectTestWorkspace } from './common/testUtils';
import { TestSettingsPropertyNames } from './configuration/types';
import { ITestConfigurationService, ITestsHelper } from './common/types';
import { ITestingService } from './types';
import { IExtensionActivationService } from '../activation/types';
import { ITestController } from './testController/common/types';
import { traceVerbose } from '../common/logger';
import { DelayedTrigger, IDelayedTrigger } from '../common/utils/delayTrigger';

@injectable()
export class TestingService implements ITestingService {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}

    public getSettingsPropertyNames(product: Product): TestSettingsPropertyNames {
        const helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        return helper.getSettingsPropertyNames(product);
    }
}

@injectable()
export class UnitTestManagementService implements IExtensionActivationService {
    private activatedOnce: boolean = false;
    private readonly disposableRegistry: Disposable[];
    private workspaceService: IWorkspaceService;
    private testController: ITestController | undefined;
    private configChangeTrigger: IDelayedTrigger;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (tests && !!tests.createTestController) {
            this.testController = serviceContainer.get<ITestController>(ITestController);
        }

        const trigger = new DelayedTrigger(
            this.configurationChangeHandler.bind(this),
            500,
            'Test Configuration Change',
        );
        this.configChangeTrigger = trigger;
        this.disposableRegistry.push(trigger);
    }

    public async activate(): Promise<void> {
        if (this.activatedOnce) {
            return;
        }
        this.activatedOnce = true;

        this.registerHandlers();
        this.registerCommands();
    }

    public async configurationChangeHandler(eventArgs: ConfigurationChangeEvent) {
        const workspaces = this.workspaceService.workspaceFolders ?? [];
        const changedWorkspaces: Uri[] = workspaces
            .filter((w) => eventArgs.affectsConfiguration('python.testing', w.uri))
            .map((w) => w.uri);

        await Promise.all(changedWorkspaces.map((u) => this.testController?.refreshTestData(u)));
    }

    @captureTelemetry(EventName.UNITTEST_CONFIGURE, undefined, false)
    public async configureTests(resource?: Uri) {
        let wkspace: Uri | undefined;
        if (resource) {
            const wkspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
            wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
        } else {
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            wkspace = await selectTestWorkspace(appShell);
        }
        if (!wkspace) {
            return;
        }
        const configurationService = this.serviceContainer.get<ITestConfigurationService>(ITestConfigurationService);
        await configurationService.promptToEnableAndConfigureTestFramework(wkspace!);
    }

    public registerCommands(): void {
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);

        this.disposableRegistry.push(
            commandManager.registerCommand(
                constants.Commands.Tests_Configure,
                (_, _cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource?: Uri) => {
                    // Ignore the exceptions returned.
                    // This command will be invoked from other places of the extension.
                    this.configureTests(resource).ignoreErrors();
                    traceVerbose('Testing: Trigger refresh after config change');
                    this.testController?.refreshTestData(resource, { forceRefresh: true });
                },
            ),
            commandManager.registerCommand(
                constants.Commands.Test_Refresh,
                (_, _cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource?: Uri) => {
                    traceVerbose('Testing: Manually triggered test refresh');
                    this.testController?.refreshTestData(resource, { forceRefresh: true });
                },
            ),
        );
    }

    public registerHandlers() {
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.disposableRegistry.push(
            this.workspaceService.onDidChangeConfiguration((e) => {
                this.configChangeTrigger.trigger(e);
            }),
            interpreterService.onDidChangeInterpreter(async () => {
                traceVerbose('Testing: Triggered refresh due to interpreter change.');
                await this.testController?.refreshTestData(undefined, { forceRefresh: true });
            }),
        );
    }
}
