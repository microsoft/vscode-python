// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { ConfigurationTarget, Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { isTestExecution, PythonSettings } from '../configSettings';
import { IConfigurationService, IPythonSettings } from '../types';

@injectable()
export class ConfigurationService implements IConfigurationService {
    public getSettings(resource?: Uri): IPythonSettings {
        return PythonSettings.getInstance(resource);
    }
    public async updateSettingAsync(setting: string, value: {}, resource?: Uri, configTarget?: ConfigurationTarget): Promise<void> {
        const pythonConfig = workspace.getConfiguration('python', resource);
        const target = configTarget
            ? configTarget
            : resource ? ConfigurationTarget.Workspace : ConfigurationTarget.Global;

        if (resource) {
            await pythonConfig.update(setting, value, target);
        } else {
            await pythonConfig.update(setting, value, true);
        }
        await this.verifySetting(pythonConfig, target, setting, value);
    }

    private async verifySetting(pythonConfig: WorkspaceConfiguration, target: ConfigurationTarget, setting: string, value: {}): Promise<void> {
        if (isTestExecution()) {
            let retries = 0;
            do {
                const obj = pythonConfig.inspect(setting);
                if (!obj && value === undefined) {
                    break;
                }
                if (obj && value !== undefined) {
                    const actual = target === ConfigurationTarget.Global
                        ? obj.globalValue
                        : target === ConfigurationTarget.Workspace ? obj.workspaceValue : obj.workspaceFolderValue;
                    if (actual === value) {
                        break;
                    }
                }
                // Wait for settings to get refreshed.
                await new Promise((resolve, reject) => setTimeout(resolve, 1000));
                retries += 1;
            } while (retries < 5);
        }
    }
}
