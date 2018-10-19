// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    CancellationToken, OutputChannel,
    TextDocument, Uri
} from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { LinterInstaller } from '../common/installer/productInstaller';
import { error as traceError } from '../common/logger';
import {
    IConfigurationService, ILogger,
    IOutputChannel, Product
} from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Bandit } from './bandit';
import { Flake8 } from './flake8';
import { LinterInfo } from './linterInfo';
import { MyPy } from './mypy';
import { Pep8 } from './pep8';
import { Prospector } from './prospector';
import { PyDocStyle } from './pydocstyle';
import { PyLama } from './pylama';
import { Pylint } from './pylint';
import {
    ILinter, ILinterInfo,
    ILinterManager, ILintMessage
} from './types';

class DisabledLinter implements ILinter {
    constructor(private configService: IConfigurationService) { }
    public get info() {
        return new LinterInfo(Product.pylint, 'pylint', this.configService);
    }
    public async lint(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        return [];
    }
}

@injectable()
export class LinterManager implements ILinterManager {
    private lintingEnabledSettingName = 'enabled';
    private linters: ILinterInfo[];
    private configService: IConfigurationService;
    private checkedForInstalledLinters: boolean = false;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.linters = [
            new LinterInfo(Product.bandit, 'bandit', this.configService),
            new LinterInfo(Product.flake8, 'flake8', this.configService),
            new LinterInfo(Product.pylint, 'pylint', this.configService, ['.pylintrc', 'pylintrc']),
            new LinterInfo(Product.mypy, 'mypy', this.configService),
            new LinterInfo(Product.pep8, 'pep8', this.configService),
            new LinterInfo(Product.prospector, 'prospector', this.configService),
            new LinterInfo(Product.pydocstyle, 'pydocstyle', this.configService),
            new LinterInfo(Product.pylama, 'pylama', this.configService)
        ];
    }

    public getAllLinterInfos(): ILinterInfo[] {
        return this.linters;
    }

    public getLinterInfo(product: Product): ILinterInfo {
        const x = this.linters.findIndex((value, index, obj) => value.product === product);
        if (x >= 0) {
            return this.linters[x];
        }
        throw new Error('Invalid linter');
    }

    public async isLintingEnabled(silent: boolean, resource?: Uri): Promise<boolean> {
        const settings = this.configService.getSettings(resource);
        const activeLintersPresent = await this.getActiveLinters(silent, resource);
        return (settings.linting[this.lintingEnabledSettingName] as boolean) && activeLintersPresent.length > 0;
    }

    public async enableLintingAsync(enable: boolean, resource?: Uri): Promise<void> {
        await this.configService.updateSetting(`linting.${this.lintingEnabledSettingName}`, enable, resource);
    }

    /**
     * Check if it is possible to enable an otherwise-unconfigured linter in
     * the current workspace, and if so ask the user if they want that linter
     * configured explicitly.
     *
     * @param linterInfo The linter to check installation status.
     * @param resource Context for the operation (required when in multi-root workspaces).
     *
     * @returns true if configuration was updated in any way, false otherwise.
     */
    public async promptUserIfLinterAvailable(linterInfo: ILinterInfo, resource?: Uri): Promise<boolean> {
        // if we've already checked during this session, don't bother again
        if (!this.checkedForInstalledLinters) {
            this.checkedForInstalledLinters = true;
        } else {
            return false;
        }

        // If linting is disabled, we are finished.
        if (!await this.isLintingEnabled(false, resource)) {
            return false;
        }

        // Has the linter in question has been configured explicitly? If so, no need to continue.
        if (!this.isLinterUsingDefaultConfiguration(linterInfo, resource)) {
            return false;
        }

        // Is the linter available in the current workspace?
        if (await this.isLinterAvailable(linterInfo.product, resource)) {
            // ...ask the user if they would like to enable it.
            return this.notifyUserAndConfigureLinter(linterInfo);
        } else {
            return false;
        }

    }

    /// Raise a dialog asking the user if they would like to explicitly configure a linter or not.
    /// Return true if a config change was made.
    public async notifyUserAndConfigureLinter(linterInfo: ILinterInfo): Promise<boolean> {
        const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);

        type ConfigureLinterMessage = {
            enabled: boolean;
            title: string;
        };

        const optButtons: ConfigureLinterMessage[] = [
            {
                title: `Enable ${linterInfo.id}`,
                enabled: true
            },
            {
                title: `Disable ${linterInfo.id}`,
                enabled: false
            }
        ];
        const pick = await appShell.showInformationMessage(`Linter ${linterInfo.id} is available but not enabled.`, ...optButtons);
        if (pick) {
            await linterInfo.enableAsync(pick.enabled);
            return true;
        }

        return false;
    }

    /**
     * Check if the linter itself is available in the workspace's Python environment or
     * not.
     *
     * @param linterProduct Linter to check in the current workspace environment.
     * @param resource Context information for workspace.
     */
    public async isLinterAvailable(linterProduct: Product, resource?: Uri): Promise<boolean | undefined> {
        const outputChannel = this.serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const linterInstaller = new LinterInstaller(this.serviceContainer, outputChannel);

        return linterInstaller.isInstalled(linterProduct, resource)
            .catch((reason) => {
                // report and continue, assume the linter is unavailable.
                traceError(`[WARNING]: Failed to discover if linter ${linterProduct} is installed.`, reason);
                return false;
            });
    }

    /**
     * Check if the given linter has been configured by the user in this workspace or not.
     *
     * @param linterInfo Linter to check for configuration status.
     * @param resource Context information.
     *
     * @returns true if the linter has not been configured at the user, workspace, or workspace-folder scope. false otherwise.
     */
    public isLinterUsingDefaultConfiguration(linterInfo: ILinterInfo, resource?: Uri) {
        const workspaceConfig = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const ws = workspaceConfig.getConfiguration('python.linting', resource);
        const pe = ws!.inspect(linterInfo.enabledSettingName);
        return (pe!.globalValue === undefined && pe!.workspaceValue === undefined && pe!.workspaceFolderValue === undefined);
    }

    public async getActiveLinters(silent: boolean, resource?: Uri): Promise<ILinterInfo[]> {
        if (silent) {
            // only ask the user if they'd like to enable pylint when it is available... others may follow.
            const pylintInfo = this.linters.find((linter: ILinterInfo) => linter.id === 'pylint');
            if (pylintInfo) {
                await this.promptUserIfLinterAvailable(pylintInfo, resource);
            }
        }
        return this.linters.filter(x => x.isEnabled(resource));
    }

    public async setActiveLintersAsync(products: Product[], resource?: Uri): Promise<void> {
        const active = await this.getActiveLinters(false, resource);
        for (const x of active) {
            await x.enableAsync(false, resource);
        }
        if (products.length > 0) {
            const toActivate = this.linters.filter(x => products.findIndex(p => x.product === p) >= 0);
            for (const x of toActivate) {
                await x.enableAsync(true, resource);
            }
            await this.enableLintingAsync(true, resource);
        }
    }

    public async createLinter(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer, resource?: Uri): Promise<ILinter> {
        if (!await this.isLintingEnabled(false, resource)) {
            return new DisabledLinter(this.configService);
        }
        const error = 'Linter manager: Unknown linter';
        switch (product) {
            case Product.bandit:
                return new Bandit(outputChannel, serviceContainer);
            case Product.flake8:
                return new Flake8(outputChannel, serviceContainer);
            case Product.pylint:
                return new Pylint(outputChannel, serviceContainer);
            case Product.mypy:
                return new MyPy(outputChannel, serviceContainer);
            case Product.prospector:
                return new Prospector(outputChannel, serviceContainer);
            case Product.pylama:
                return new PyLama(outputChannel, serviceContainer);
            case Product.pydocstyle:
                return new PyDocStyle(outputChannel, serviceContainer);
            case Product.pep8:
                return new Pep8(outputChannel, serviceContainer);
            default:
                serviceContainer.get<ILogger>(ILogger).logError(error);
                break;
        }
        throw new Error(error);
    }
}
