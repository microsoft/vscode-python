// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import { traceError } from '../common/logger';
import { IConfigurationService, IInstaller, Product } from '../common/types';
import { IAvailableLinterActivator, ILinterInfo } from './types';

@injectable()
export class AvailableLinterActivator implements IAvailableLinterActivator {
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IInstaller) private installer: IInstaller,
        @inject(IWorkspaceService) private workspaceConfig: IWorkspaceService,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) { }

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
    public async promptIfLinterAvailable(linterInfo: ILinterInfo, resource?: Uri): Promise<boolean> {
        // Has the feature been enabled yet?
        if (!this.isFeatureEnabled) {
            return false;
        }

        // Has the linter in question has been configured explicitly? If so, no need to continue.
        if (!this.isLinterUsingDefaultConfiguration(linterInfo, resource)) {
            return false;
        }

        // Is the linter available in the current workspace?
        if (await this.isLinterAvailable(linterInfo.product, resource)) {

            // great, it is - ask the user if they'd like to enable it.
            return this.promptToConfigureAvailableLinter(linterInfo);
        }
        return false;
    }

    /**
     * Raise a dialog asking the user if they would like to explicitly configure a
     * linter or not in their current workspace.
     *
     * @param linterInfo The linter to ask the user to enable or not.
     *
     * @returns true if the user requested a configuration change, false otherwise.
     */
    public async promptToConfigureAvailableLinter(linterInfo: ILinterInfo): Promise<boolean> {
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

        // tslint:disable-next-line:messages-must-be-localized
        const pick = await this.appShell.showInformationMessage(`Linter ${linterInfo.id} is available but not enabled.`, ...optButtons);
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
        return this.installer.isInstalled(linterProduct, resource)
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
    public isLinterUsingDefaultConfiguration(linterInfo: ILinterInfo, resource?: Uri): boolean {
        const ws = this.workspaceConfig.getConfiguration('python.linting', resource);
        const pe = ws!.inspect(linterInfo.enabledSettingName);
        return (pe!.globalValue === undefined && pe!.workspaceValue === undefined && pe!.workspaceFolderValue === undefined);
    }

    /**
     * Check if this feature is enabled yet.
     *
     * This is a feature of the vscode-python extension that will become enabled once the
     * Python Language Server becomes the default, replacing Jedi as the default. Testing
     * the global default setting for `"python.jediEnabled": false` enables it.
     *
     * @returns true if the global default for python.jediEnabled is false.
     */
    public get isFeatureEnabled(): boolean {
        return !this.configService.getSettings().jediEnabled;
    }
}
