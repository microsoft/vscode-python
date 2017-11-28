// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { commands, Disposable, window } from 'vscode';
import { launch } from './browser';
import { IPersistentStateFactory } from './persistentState';

type deprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: string;
    message: string;
    moreInfoUrl: string;
    commands?: string[];
};

const jupyterDeprecationInfo: deprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_JUPYTER',
    message: 'This functionality has been moved to the \'Jupyter\' extension.',
    moreInfoUrl: 'https://marketplace.visualstudio.com/items?itemName=donjayamanne.jupyter',
    commands: ['jupyter.runSelectionLine', 'jupyter.execCurrentCell',
        'jupyter.execCurrentCellAndAdvance', 'jupyter.gotToPreviousCell',
        'jupyter.gotToNextCell']
};

export interface IFeatureDeprecationManager extends Disposable {
}

export class FeatureDeprecationManager implements IFeatureDeprecationManager {
    private disposables: Disposable[] = [];
    constructor(private persistentStateFactory: IPersistentStateFactory, private jupyterExtensionInstalled: boolean) {
        this.handleDeprecationOfJupyter();
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private handleDeprecationOfJupyter() {
        if (this.jupyterExtensionInstalled) {
            return;
        }
        this.registerDeprecation(jupyterDeprecationInfo);
    }
    private registerDeprecation(deprecatedInfo: deprecatedFeatureInfo) {
        if (Array.isArray(deprecatedInfo.commands)) {
            deprecatedInfo.commands.forEach(cmd => {
                this.disposables.push(commands.registerCommand(cmd, () => this.notifyDeprecation(deprecatedInfo), this));
            });
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
