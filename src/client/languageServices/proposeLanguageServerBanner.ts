// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IConfigurationService, IPersistentStateFactory, IPythonExtensionBanner } from '../common/types';
import { getRandomBetween } from '../common/utils/random';

// persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    ShowBanner = 'ProposeLSBanner',
}

enum ProposeLSLabelIndex {
    Yes,
    No,
    Later,
}

/*
This class represents a popup that propose that the user try out a new
feature of the extension, and optionally enable that new feature if they
choose to do so. It is meant to be shown only to a subset of our users,
and will show as soon as it is instructed to do so, if a random sample
function enables the popup for this user.
*/
@injectable()
export class ProposeLanguageServerBanner implements IPythonExtensionBanner {
    private initialized?: boolean;
    private disabledInCurrentSession: boolean = false;
    private sampleSizePerHundred: number;
    private bannerMessage: string =
        'Try out Preview of our new Python Language Server to get richer and faster IntelliSense completions, and syntax errors as you type.';
    private bannerLabels: string[] = ['Try it now', 'No thanks', 'Remind me Later'];

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        sampleSizePerOneHundredUsers: number = 10
    ) {
        this.sampleSizePerHundred = sampleSizePerOneHundredUsers;
        this.initialize();
    }

    public initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        // Don't even bother adding handlers if banner has been turned off.
        if (!this.enabled) {
            return;
        }

        // we only want 10% of folks that use Jedi to see this survey.
        const randomSample: number = getRandomBetween(0, 100);
        if (randomSample >= this.sampleSizePerHundred) {
            this.disable().ignoreErrors();
            return;
        }
    }
    public get enabled(): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, true).value;
    }

    public async showBanner(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const show = await this.shouldShowBanner();
        if (!show) {
            return;
        }

        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
        switch (response) {
            case this.bannerLabels[ProposeLSLabelIndex.Yes]: {
                await this.enableNewLanguageServer();
                await this.disable();
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.No]: {
                await this.disable();
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.Later]: {
                this.disabledInCurrentSession = true;
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    public async shouldShowBanner(): Promise<boolean> {
        return Promise.resolve(this.enabled && !this.disabledInCurrentSession);
    }

    public async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, false)
            .updateValue(false);
    }

    public async enableNewLanguageServer(): Promise<void> {
        await this.configuration.updateSetting('jediEnabled', false, undefined, ConfigurationTarget.Global);
    }
}
