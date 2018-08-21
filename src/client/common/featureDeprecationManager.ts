// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, optional } from 'inversify';
import { Disposable, window, WorkspaceConfiguration } from 'vscode';
import { ICommandManager, IWorkspaceService } from './application/types';
import { launch } from './net/browser';
import { IFeatureDeprecationManager } from './terminal/types';
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
    },
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_BUILD_WORKSPACE_SYMBOLS',
        message: 'The command \'Python: Build Workspace Symbols\' is deprecated as the new Python Language Server builds symbols in the workspace in the background.',
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/2267#issuecomment-408996859',
        commands: ['python.buildWorkspaceSymbols']
    }
];

export interface IPopupService {
    showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;
}

const IPopupService = Symbol('IPopupService');

class PopupService implements IPopupService {
    public showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
        return window.showInformationMessage(message, ...items);
    }
}
@injectable()
export class FeatureDeprecationManager implements IFeatureDeprecationManager {
    private disposables: Disposable[] = [];
    constructor(
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory,
        @inject(ICommandManager) private cmdMgr: ICommandManager,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IPopupService) @optional() private popupService?: IPopupService
    ) {
        if (!this.popupService) {
            this.popupService = new PopupService();
        }
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    public initialize() {
        deprecatedFeatures.forEach(this.registerDeprecation.bind(this));
    }
    private registerDeprecation(deprecatedInfo: deprecatedFeatureInfo) {
        if (Array.isArray(deprecatedInfo.commands)) {
            deprecatedInfo.commands.forEach(cmd => {
                this.disposables.push(this.cmdMgr.registerCommand(cmd, () => this.notifyDeprecation(deprecatedInfo), this));
            });
        }
        if (deprecatedInfo.setting) {
            this.checkAndNotifyDeprecatedSetting(deprecatedInfo);
        }
    }
    private checkAndNotifyDeprecatedSetting(deprecatedInfo: deprecatedFeatureInfo) {
        let notify = false;
        if (Array.isArray(this.workspace.workspaceFolders) && this.workspace.workspaceFolders.length > 0) {
            this.workspace.workspaceFolders.forEach(workspaceFolder => {
                if (notify) {
                    return;
                }
                notify = this.isDeprecatedSettingAndValueUsed(this.workspace.getConfiguration('python', workspaceFolder.uri), deprecatedInfo.setting!);
            });
        } else {
            notify = this.isDeprecatedSettingAndValueUsed(this.workspace.getConfiguration('python'), deprecatedInfo.setting!);
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
        const option = await this.popupService!.showInformationMessage(deprecatedInfo.message, moreInfo, doNotShowAgain);
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
