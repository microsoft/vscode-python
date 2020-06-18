// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { LanguageServerType } from '../activation/types';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import '../common/extensions';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService, IPersistentStateFactory, Resource } from '../common/types';
import { Common, Linters } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IAvailableLinterActivator, ILinterInfo } from './types';

const doNotDisplayPromptStateKey = 'MESSAGE_KEY_FOR_CONFIGURE_AVAILABLE_LINTER_PROMPT';
@injectable()
export class AvailableLinterActivator implements IAvailableLinterActivator {
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IFileSystem) private fs: IFileSystem,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory
    ) {}

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
        if (await this.isLinterAvailable(linterInfo, resource)) {
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
        const notificationPromptEnabled = this.persistentStateFactory.createWorkspacePersistentState(
            doNotDisplayPromptStateKey,
            true
        );
        if (!notificationPromptEnabled.value) {
            return false;
        }
        const optButtons = [Linters.enableLinter().format(linterInfo.id), Common.notNow(), Common.doNotShowAgain()];

        const telemetrySelections: ['enable', 'ignore', 'disablePrompt'] = ['enable', 'ignore', 'disablePrompt'];
        const pick = await this.appShell.showInformationMessage(
            Linters.enablePylint().format(linterInfo.id),
            ...optButtons
        );
        sendTelemetryEvent(EventName.CONFIGURE_AVAILABLE_LINTER_PROMPT, undefined, {
            tool: linterInfo.id,
            action: pick ? telemetrySelections[optButtons.indexOf(pick)] : undefined
        });
        if (pick === optButtons[0]) {
            await linterInfo.enableAsync(true);
            return true;
        } else if (pick === optButtons[2]) {
            await notificationPromptEnabled.updateValue(false);
        }
        return false;
    }

    /**
     * Check if the linter itself is available in the workspace's Python environment or
     * not.
     *
     * @param linterInfo Linter to check in the current workspace environment.
     * @param resource Context information for workspace.
     */
    public async isLinterAvailable(linterInfo: ILinterInfo, resource: Resource): Promise<boolean | undefined> {
        if (!this.workspaceService.hasWorkspaceFolders) {
            return false;
        }
        const workspaceFolder =
            this.workspaceService.getWorkspaceFolder(resource) || this.workspaceService.workspaceFolders![0];
        let isAvailable = false;
        for (const configName of linterInfo.configFileNames) {
            const configPath = path.join(workspaceFolder.uri.fsPath, configName);
            isAvailable = isAvailable || (await this.fs.fileExists(configPath));
        }
        return isAvailable;
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
        const ws = this.workspaceService.getConfiguration('python.linting', resource);
        const pe = ws!.inspect(linterInfo.enabledSettingName);
        return (
            pe!.globalValue === undefined && pe!.workspaceValue === undefined && pe!.workspaceFolderValue === undefined
        );
    }

    /**
     * Check if this feature is enabled yet.
     *
     * This is a feature of the vscode-python extension that will become enabled once the
     * Python Language Server becomes the default, replacing Jedi as the default. Testing
     * the global default setting for `"python.languageServer": !Jedi` enables it.
     *
     * @returns true if the global default for python.languageServer is not Jedi.
     */
    public get isFeatureEnabled(): boolean {
        return this.configService.getSettings().languageServer !== LanguageServerType.Jedi;
    }
}
