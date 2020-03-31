// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { IInterpreterAutoSeletionProxyService } from '../../interpreter/autoSelection/types';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { PythonSettings } from '../configSettings';
import { IConfigurationService, IPythonSettings } from '../types';

@injectable()
export class ConfigurationService implements IConfigurationService {
    private readonly workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public getSettings(resource?: Uri): IPythonSettings {
        const InterpreterAutoSelectionService = this.serviceContainer.get<IInterpreterAutoSeletionProxyService>(
            IInterpreterAutoSeletionProxyService
        );
        return PythonSettings.getInstance(resource, InterpreterAutoSelectionService, this.workspaceService);
    }

    public async updateSectionSetting(
        section: string,
        setting: string,
        value?: {},
        resource?: Uri,
        configTarget?: ConfigurationTarget
    ): Promise<void> {
        const defaultSetting = {
            uri: resource,
            target: configTarget || ConfigurationTarget.WorkspaceFolder
        };
        let settingsInfo = defaultSetting;
        if (section === 'python' && configTarget !== ConfigurationTarget.Global) {
            settingsInfo = PythonSettings.getSettingsUriAndTarget(resource, this.workspaceService);
        }

        const configSection = workspace.getConfiguration(section, settingsInfo.uri ? settingsInfo.uri : null);
        const currentValue = configSection.inspect(setting);

        if (
            currentValue !== undefined &&
            ((settingsInfo.target === ConfigurationTarget.Global && currentValue.globalValue === value) ||
                (settingsInfo.target === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
                (settingsInfo.target === ConfigurationTarget.WorkspaceFolder &&
                    currentValue.workspaceFolderValue === value))
        ) {
            return;
        }

        await configSection.update(setting, value, settingsInfo.target);
        await this.verifySetting(configSection, settingsInfo.target, setting, value);
    }

    public async updateSetting(
        setting: string,
        value?: {},
        resource?: Uri,
        configTarget?: ConfigurationTarget
    ): Promise<void> {
        return this.updateSectionSetting('python', setting, value, resource, configTarget);
    }

    public isTestExecution(): boolean {
        return process.env.VSC_PYTHON_CI_TEST === '1';
    }

    private async verifySetting(
        configSection: WorkspaceConfiguration,
        target: ConfigurationTarget,
        settingName: string,
        value?: {}
    ): Promise<void> {
        if (this.isTestExecution()) {
            let retries = 0;
            do {
                const setting = configSection.inspect(settingName);
                if (!setting && value === undefined) {
                    break; // Both are unset
                }
                if (setting && value !== undefined) {
                    // Both specified
                    const actual =
                        target === ConfigurationTarget.Global
                            ? setting.globalValue
                            : target === ConfigurationTarget.Workspace
                            ? setting.workspaceValue
                            : setting.workspaceFolderValue;
                    if (actual === value) {
                        break;
                    }
                }
                // Wait for settings to get refreshed.
                await new Promise((resolve) => setTimeout(resolve, 250));
                retries += 1;
            } while (retries < 20);
        }
    }
}
