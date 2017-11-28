// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { window } from 'vscode';
import { launch } from './browser';
import { IPersistentStateFactory } from './persistentState';

type deprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: string;
    message: string;
    moreInfoUrl: string;
};

export interface IFeatureDeprecationManager {
    notifyDeprecationOfJupyter(): void;
}

export class FeatureDeprecationManager {
    constructor(private persistentStateFactory: IPersistentStateFactory) { }

    public notifyDeprecationOfJupyter() {
        const info: deprecatedFeatureInfo = {
            doNotDisplayPromptStateKey: 'SHOW_DEPRECATED_FEATURE_PROMPT_JUPYTER',
            message: 'This functionality has been moved to the \'Jupyter\' extension.',
            moreInfoUrl: 'https://marketplace.visualstudio.com/items?itemName=donjayamanne.jupyter'
        };

        this.notifyDeprecation(info);
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
