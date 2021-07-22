'use strict';

import { inject, injectable } from 'inversify';
import {
    ConfigurationChangeEvent,
    Disposable,
    test,
    Uri,
} from 'vscode';
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
import {
    ITestConfigurationService,
    ITestsHelper,
} from './common/types';
import { ITestingService } from './types';
import { PythonTestController } from './testController/controller';
import { IExtensionActivationService } from '../activation/types';

@injectable()
export class TestingService implements ITestingService {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}

    public getSettingsPropertyNames(product: Product): TestSettingsPropertyNames {
        const helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        return helper.getSettingsPropertyNames(product);
    }
}

@injectable()
export class UnitTestManagementService implements IExtensionActivationService, Disposable {
    private activatedOnce: boolean = false;
    private readonly disposableRegistry: Disposable[];
    private workspaceService: IWorkspaceService;
    private configChangedTimer?: NodeJS.Timer | number;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.disposableRegistry.push(this);
    }
    public dispose() {
        if (this.configChangedTimer) {
            clearTimeout(this.configChangedTimer as any);
            this.configChangedTimer = undefined;
        }
    }

    public async activate(): Promise<void> {
        if (this.activatedOnce) {
            return;
        }
        this.activatedOnce = true;

        this.registerHandlers();
        this.registerCommands();

        if (test && test.registerTestController) {
            this.disposableRegistry.push(test.registerTestController(new PythonTestController()));
        }
    }

    public async configurationChangeHandler(eventArgs: ConfigurationChangeEvent) {
        // If there's one workspace, then stop the tests and restart,
        // else let the user do this manually.
        if (!this.workspaceService.hasWorkspaceFolders || this.workspaceService.workspaceFolders!.length > 1) {
            return;
        }
        if (!Array.isArray(this.workspaceService.workspaceFolders)) {
            return;
        }
        const workspaceFolderUri = this.workspaceService.workspaceFolders.find((w) =>
            eventArgs.affectsConfiguration('python.testing', w.uri),
        );
        if (!workspaceFolderUri) {
            return;
        }

        // TODO: refresh test data
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
        const disposablesRegistry = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);

        const disposables = [
            // TODO: register command to refresh test data
            commandManager.registerCommand(
                constants.Commands.Tests_Configure,
                (_, _cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource?: Uri) => {
                    // Ignore the exceptions returned.
                    // This command will be invoked from other places of the extension.
                    this.configureTests(resource).ignoreErrors();
                    // TODO: refresh test data
                },
            ),
        ];

        disposablesRegistry.push(...disposables);
    }

    public registerHandlers() {
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.disposableRegistry.push(
            this.workspaceService.onDidChangeConfiguration((e) => {
                if (this.configChangedTimer) {
                    clearTimeout(this.configChangedTimer as any);
                }
                this.configChangedTimer = setTimeout(() => this.configurationChangeHandler(e), 1000);
            }),
        );
        this.disposableRegistry.push(
            interpreterService.onDidChangeInterpreter(() =>
                {
                    // TODO: Refresh test data
                }
            ),
        );
    }
}
