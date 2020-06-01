// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { LanguageServerType } from '../activation/types';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IConfigurationService, IPersistentStateFactory, IPythonExtensionBanner } from '../common/types';
import { getRandomBetween } from '../common/utils/random';

// Persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    ShowBanner = 'ProposeLSBanner',
    ReactivatedBannerForV2 = 'ReactivatedBannerForV2'
}

enum ProposeLSLabelIndex {
    Yes,
    No,
    Later
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

    public get enabled(): boolean {
        return this.getStateValue(ProposeLSStateKeys.ShowBanner, true);
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
                await this.enableLanguageServer();
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
        this.setStateValue(ProposeLSStateKeys.ShowBanner, false);
    }

    public async enableLanguageServer(): Promise<void> {
        await this.configuration.updateSetting(
            'languageServer',
            LanguageServerType.Node,
            undefined,
            ConfigurationTarget.Global
        );
    }

    private initialize() {
        this.reactivateBannerForLSv2()
            .then(() => {
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
            })
            .ignoreErrors();
    }

    private async reactivateBannerForLSv2(): Promise<void> {
        // With MPLSv1 preview user could get the offer to use LS and either
        // accept or reject it. The state was then saved. With MPLSv2 we need
        // to clear the state once in order to allow banner to appear again
        // for both Jedi and MPLSv1 users.
        const reactivatedPopupOnce = this.getStateValue(ProposeLSStateKeys.ReactivatedBannerForV2, false);
        if (!reactivatedPopupOnce) {
            // Enable popup once.
            await this.setStateValue(ProposeLSStateKeys.ShowBanner, true);
            // Remember we've done it.
            await this.setStateValue(ProposeLSStateKeys.ReactivatedBannerForV2, true);
        }
    }

    private getStateValue(name: string, defaultValue: boolean): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(name, defaultValue).value;
    }
    private async setStateValue(name: string, value: boolean): Promise<void> {
        return this.persistentState.createGlobalPersistentState<boolean>(name, value).updateValue(value);
    }
}
