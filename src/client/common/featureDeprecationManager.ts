// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { commands, Disposable, window, workspace, WorkspaceConfiguration } from 'vscode';
import { launch } from './net/browser';
import { IPersistentStateFactory } from './types';

type deprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: string;
    message: string;
    moreInfoUrl: string;
    commands?: string[];
    setting?: deprecatedSettingAndValue;
};

type deprecatedSettingAndValue = {
    setting: string;
    values?: {}[];
};

const deprecatedFeatures: deprecatedFeatureInfo[] = [
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_FORMAT_ON_SAVE',
        message: 'The setting \'python.formatting.formatOnSave\' is deprecated, please use \'editor.formatOnSave\'.',
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/309',
        setting: { setting: 'formatting.formatOnSave', values: ['true', true] }
    },
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_LINT_ON_TEXT_CHANGE',
        message: 'The setting \'python.linting.lintOnTextChange\' is deprecated, please enable \'python.linting.lintOnSave\' and \'files.autoSave\'.',
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/313',
        setting: { setting: 'linting.lintOnTextChange', values: ['true', true] }
    }
];

export interface IFeatureDeprecationManager extends Disposable {
    initialize(): void;
}

export class FeatureDeprecationManager implements IFeatureDeprecationManager {
    private disposables: Disposable[] = [];
    constructor(private persistentStateFactory: IPersistentStateFactory, private jupyterExtensionInstalled: boolean) { }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    public initialize() {
        deprecatedFeatures.forEach(this.registerDeprecation.bind(this));
    }
    private registerDeprecation(deprecatedInfo: deprecatedFeatureInfo) {
        if (Array.isArray(deprecatedInfo.commands)) {
            deprecatedInfo.commands.forEach(cmd => {
                this.disposables.push(commands.registerCommand(cmd, () => this.notifyDeprecation(deprecatedInfo), this));
            });
        }
        if (deprecatedInfo.setting) {
            this.checkAndNotifyDeprecatedSetting(deprecatedInfo);
        }
    }
    private checkAndNotifyDeprecatedSetting(deprecatedInfo: deprecatedFeatureInfo) {
        let notify = false;
        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            workspace.workspaceFolders.forEach(workspaceFolder => {
                if (notify) {
                    return;
                }
                notify = this.isDeprecatedSettingAndValueUsed(workspace.getConfiguration('python', workspaceFolder.uri), deprecatedInfo.setting!);
            });
        } else {
            notify = this.isDeprecatedSettingAndValueUsed(workspace.getConfiguration('python'), deprecatedInfo.setting!);
        }

        if (notify) {
            this.notifyDeprecation(deprecatedInfo)
                .catch(ex => console.error('Python Extension: notifyDeprecation', ex));
        }
    }
    private isDeprecatedSettingAndValueUsed(pythonConfig: WorkspaceConfiguration, deprecatedSetting: deprecatedSettingAndValue) {
        if (!pythonConfig.has(deprecatedSetting.setting)) {
            return false;
        }
        if (!Array.isArray(deprecatedSetting.values) || deprecatedSetting.values.length === 0) {
            return true;
        }
        return deprecatedSetting.values.indexOf(pythonConfig.get(deprecatedSetting.setting)!) >= 0;
    }
    private async notifyDeprecation(deprecatedInfo: deprecatedFeatureInfo) {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(deprecatedInfo.doNotDisplayPromptStateKey, true);
        if (!notificationPromptEnabled.value) {
            return;
        }
        const moreInfo = 'Learn more';
        const doNotShowAgain = 'Never show again';
        const option = await window.showInformationMessage(deprecatedInfo.message, moreInfo, doNotShowAgain);
        if (!option) {
            return;
        }
        switch (option) {
            case moreInfo: {
                launch(deprecatedInfo.moreInfoUrl);
                break;
            }
            case doNotShowAgain: {
                await notificationPromptEnabled.updateValue(false);
                break;
            }
            default: {
                throw new Error('Selected option not supported.');
            }
        }
    }
}
