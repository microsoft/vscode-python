// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { window } from 'vscode';
import { launch } from './common/browser';
import { IPersistentStateFactory, PersistentState } from './common/persistentState';

const BANNER_URL = 'https://aka.ms/pvsc-at-msft';

export class BannerService {
    private shouldShowBanner: PersistentState<boolean>;
    constructor(persistentStateFactory: IPersistentStateFactory) {
        this.shouldShowBanner = persistentStateFactory.createGlobalPersistentState('SHOW_NEW_PUBLISHER_BANNER', true);
        this.showBanner();
    }
    private showBanner() {
        if (!this.shouldShowBanner.value) {
            return;
        }
        this.shouldShowBanner.value = false;

        const message = 'The Python extension is now published by Microsoft!';
        const yesButton = 'Read more';
        window.showInformationMessage(message, yesButton).then((value) => {
            if (value === yesButton) {
                this.displayBanner();
            }
        });
    }
    private displayBanner() {
        launch(BANNER_URL);
    }
}
