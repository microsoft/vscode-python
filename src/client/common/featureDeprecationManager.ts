// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, WorkspaceConfiguration } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from './application/types';
import { traceVerbose } from './logger';
import { launch } from './net/browser';
import {
    DeprecatedFeatureInfo,
    DeprecatedSettingAndValue,
    IFeatureDeprecationManager,
    IPersistentStateFactory
} from './types';

const deprecatedFeatures: DeprecatedFeatureInfo[] = [
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_FORMAT_ON_SAVE',
        message: "The setting 'python.formatting.formatOnSave' is deprecated, please use 'editor.formatOnSave'.",
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/309',
        setting: { setting: 'formatting.formatOnSave', values: ['true', true] }
    },
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_LINT_ON_TEXT_CHANGE',
        message:
            "The setting 'python.linting.lintOnTextChange' is deprecated, please enable 'python.linting.lintOnSave' and 'files.autoSave'.",
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/313',
        setting: { setting: 'linting.lintOnTextChange', values: ['true', true] }
    },
    {
        doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_FOR_AUTO_COMPLETE_PRELOAD_MODULES',
        message:
            "The setting 'python.autoComplete.preloadModules' is deprecated, please consider using the new Language Server ('python.jediEnabled = false').",
        moreInfoUrl: 'https://github.com/Microsoft/vscode-python/issues/1704',
        setting: { setting: 'autoComplete.preloadModules' }
    }
];

@injectable()
export class FeatureDeprecationManager implements IFeatureDeprecationManager {
    private disposables: Disposable[] = [];
    constructor(
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory,
        @inject(ICommandManager) private cmdMgr: ICommandManager,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IApplicationShell) private appShell: IApplicationShell
    ) {}

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    public initialize() {
        deprecatedFeatures.forEach(this.registerDeprecation.bind(this));
    }

    public registerDeprecation(deprecatedInfo: DeprecatedFeatureInfo): void {
        if (Array.isArray(deprecatedInfo.commands)) {
            deprecatedInfo.commands.forEach(cmd => {
                this.disposables.push(
                    this.cmdMgr.registerCommand(cmd, () => this.notifyDeprecation(deprecatedInfo), this)
                );
            });
        }
        if (deprecatedInfo.setting) {
            this.checkAndNotifyDeprecatedSetting(deprecatedInfo);
        }
    }

    public async notifyDeprecation(deprecatedInfo: DeprecatedFeatureInfo): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            deprecatedInfo.doNotDisplayPromptStateKey,
            true
        );
        if (!notificationPromptEnabled.value) {
            return;
        }
        const moreInfo = 'Learn more';
        const doNotShowAgain = 'Never show again';
        const option = await this.appShell.showInformationMessage(deprecatedInfo.message, moreInfo, doNotShowAgain);
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
        return;
    }

    public checkAndNotifyDeprecatedSetting(deprecatedInfo: DeprecatedFeatureInfo) {
        let notify = false;
        if (Array.isArray(this.workspace.workspaceFolders) && this.workspace.workspaceFolders.length > 0) {
            this.workspace.workspaceFolders.forEach(workspaceFolder => {
                if (notify) {
                    return;
                }
                notify = this.isDeprecatedSettingAndValueUsed(
                    this.workspace.getConfiguration('python', workspaceFolder.uri),
                    deprecatedInfo.setting!
                );
            });
        } else {
            notify = this.isDeprecatedSettingAndValueUsed(
                this.workspace.getConfiguration('python'),
                deprecatedInfo.setting!
            );
        }

        if (notify) {
            this.notifyDeprecation(deprecatedInfo).catch(ex => traceVerbose('Python Extension: notifyDeprecation', ex));
        }
    }

    public isDeprecatedSettingAndValueUsed(
        pythonConfig: WorkspaceConfiguration,
        deprecatedSetting: DeprecatedSettingAndValue
    ) {
        if (!pythonConfig.has(deprecatedSetting.setting)) {
            return false;
        }
        const configValue = pythonConfig.get(deprecatedSetting.setting);
        if (!Array.isArray(deprecatedSetting.values) || deprecatedSetting.values.length === 0) {
            if (Array.isArray(configValue)) {
                return configValue.length > 0;
            }
            return true;
        }
        if (!Array.isArray(deprecatedSetting.values) || deprecatedSetting.values.length === 0) {
            if (configValue === undefined) {
                return false;
            }
            if (Array.isArray(configValue)) {
                // tslint:disable-next-line:no-any
                return (configValue as any[]).length > 0;
            }
            // If we have a value in the setting, then return.
            return true;
        }
        return deprecatedSetting.values.indexOf(pythonConfig.get<{}>(deprecatedSetting.setting)!) >= 0;
    }
}
