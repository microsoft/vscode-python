// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as child_process from 'child_process';
import * as os from 'os';
import { window } from 'vscode';
import { IPersistentStateFactory, PersistentState } from './common/persistentState';

const BANNER_URL = 'https://aka.ms/egv4z1';

export class BannerService {
    private shouldShowBanner: PersistentState<boolean>;
    constructor(persistentStateFactory: IPersistentStateFactory) {
        this.shouldShowBanner = persistentStateFactory.createGlobalPersistentState('SHOW_NEW_EXT_BANNER', true);
        this.showBanner();
    }
    private showBanner() {
        if (!this.shouldShowBanner.value) {
            return;
        }
        this.shouldShowBanner.value = false;

        const message = 'Would you like to know what is new?';
        const yesButton = 'Yes';
        window.showInformationMessage(message, yesButton).then((value) => {
            if (value === yesButton) {
                this.displayBanner();
            }
        });
    }
    private displayBanner() {
        let openCommand: string | undefined;
        if (os.platform() === 'win32') {
            openCommand = 'explorer';
        } else if (os.platform() === 'darwin') {
            openCommand = '/usr/bin/open';
        } else {
            openCommand = '/usr/bin/xdg-open';
        }
        if (!openCommand) {
            console.error(`Unable open ${BANNER_URL} on platform '${os.platform()}'.`);
        }
        child_process.spawn(openCommand, [BANNER_URL]);
    }
}
