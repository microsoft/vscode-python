// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { commands, Disposable, window, workspace } from 'vscode';
import { launch } from './net/browser';
import { IPersistentStateFactory } from './persistentState';

type deprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: string;
    message: string;
    moreInfoUrl: string;
    commands?: string[];
    setting?: string;
};

const jupyterDeprecationInfo: deprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_JUPYTER',
    message: 'This functionality has been moved to the \'Jupyter\' extension.',
    moreInfoUrl: 'https://marketplace.visualstudio.com/items?itemName=donjayamanne.jupyter',
    commands: ['jupyter.runSelectionLine', 'jupyter.execCurrentCell',
        'jupyter.execCurrentCellAndAdvance', 'jupyter.gotToPreviousCell',
        'jupyter.gotToNextCell']
};

const deprecatedFeatures: deprecatedFeatureInfo[] = [
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_FORMAT_ON_SAVE',
        message: 'The setting \'python.formatting.formatOnSave\' is deprecated, please use \'editor.formatOnSave\'.',
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/309',
        setting: 'formatting.formatOnSave'
    }
];

export interface IFeatureDeprecationManager extends Disposable {
    initialize(): void;
}

export class FeatureDeprecationManager implements IFeatureDeprecationManager {
    private disposables: Disposable[] = [];
    private settingDeprecationNotified: string[] = [];
    constructor(private persistentStateFactory: IPersistentStateFactory, private jupyterExtensionInstalled: boolean) { }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    public initialize() {
        if (!this.jupyterExtensionInstalled) {
            deprecatedFeatures.push(jupyterDeprecationInfo);
        }
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
        const setting = deprecatedInfo.setting!;
        let notify = false;
        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            workspace.workspaceFolders.forEach(workspaceFolder => {
                if (notify) {
                    return;
                }
                const pythonConfig = workspace.getConfiguration('python', workspaceFolder.uri);
                notify = pythonConfig.has(setting) && this.settingDeprecationNotified.indexOf(setting) === -1;
            });
        } else {
            const pythonConfig = workspace.getConfiguration('python');
            notify = pythonConfig.has(setting) && this.settingDeprecationNotified.indexOf(setting) === -1;
        }

        if (notify) {
            this.settingDeprecationNotified.push(setting);
            this.notifyDeprecation(deprecatedInfo);
        }
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
                notificationPromptEnabled.value = false;
                break;
            }
            default: {
                throw new Error('Selected option not supported.');
            }
        }
    }
}
