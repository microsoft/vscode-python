// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { ConfigurationTarget, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { PythonSettings } from '../configSettings';
import { IConfigurationService, IPythonSettings } from '../types';

@injectable()
export class ConfigurationService implements IConfigurationService {
    public getSettings(resource?: Uri): IPythonSettings {
        return PythonSettings.getInstance(resource);
    }

    public async updateSettingAsync(setting: string, value?: {}, resource?: Uri, configTarget?: ConfigurationTarget): Promise<void> {
        const settingsInfo = PythonSettings.getSettingsUriAndTarget(resource);

        const pythonConfig = workspace.getConfiguration('python', settingsInfo.uri);
        const currentValue = pythonConfig.inspect(setting);

        if (currentValue !== undefined &&
            ((settingsInfo.target === ConfigurationTarget.Global && currentValue.globalValue === value) ||
                (settingsInfo.target === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
                (settingsInfo.target === ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))) {
            return;
        }

        await pythonConfig.update(setting, value, settingsInfo.target);
        await this.verifySetting(pythonConfig, settingsInfo.target, setting, value);
    }

    public isTestExecution(): boolean {
        return process.env.VSC_PYTHON_CI_TEST === '1';
    }

    private async verifySetting(pythonConfig: WorkspaceConfiguration, target: ConfigurationTarget, settingName: string, value?: {}): Promise<void> {
        if (this.isTestExecution()) {
            let retries = 0;
            do {
                const setting = pythonConfig.inspect(settingName);
                if (!setting && value === undefined) {
                    break; // Both are unset
                }
                if (setting && value !== undefined) {
                    // Both specified
                    const actual = target === ConfigurationTarget.Global
                        ? setting.globalValue
                        : target === ConfigurationTarget.Workspace ? setting.workspaceValue : setting.workspaceFolderValue;
                    if (actual === value) {
                        break;
                    }
                }
                // Wait for settings to get refreshed.
                await new Promise((resolve, reject) => setTimeout(resolve, 250));
                retries += 1;
            } while (retries < 20);
        }
    }
}
