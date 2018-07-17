// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IConfigurationService, IPersistentStateFactory,
    IPythonExtensionBanner } from '../common/types';
import { getRandomBetween } from '../common/utils';

// persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    ShowBanner = 'ProposeLSBanner',
    ShowAttemptCount = 'ProposeLSBannerCount'
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
    private initialized?: boolean;
    private disabledInCurrentSession?: boolean;
    private maxShowAttempts: number;
    private sampleSizePerHundred: number;
    private bannerMessage: string = 'Try out Preview of our new Python Language Server to get richer and faster IntelliSense completions, and syntax errors as you type.';
    private bannerLabels: string[] = [ 'Try it now', 'No thanks', 'Remind me Later' ];
    private bannerTriggerCounts: number[] = [0, 0, 0];

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        maxShowAttemptThreshold: number = 10,
        sampleSizePerOneHundredUsers: number = 10)
    {
        this.maxShowAttempts = maxShowAttemptThreshold;
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
        if (randomSample === this.sampleSizePerHundred) {
            this.disable().ignoreErrors();
            return;
        }
    }

    public get shownCount(): Promise<number> {
        // tslint:disable-next-line:no-any
        return this.getBannerLaunchCount().then((r: number) => r, (failReason: any) => -1);
    }

    public get optionLabels(): string[] {
        return this.bannerLabels;
    }

    public optionTriggerCount(label: string): number {
        let count: number = -1;
        switch (label) {
            case this.bannerLabels[ProposeLSLabelIndex.Yes]: {
                count = this.optionTriggerCount[ProposeLSLabelIndex.Yes];
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.No]: {
                count = this.optionTriggerCount[ProposeLSLabelIndex.No];
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.Later]: {
                count = this.optionTriggerCount[ProposeLSLabelIndex.Later];
                break;
            }
            default: {
                break;
            }
        }
        return count;
    }

    public get enabled(): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, true).value;
    }

    public async showBanner(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const launchCount: number = await this.incrementBannerLaunchCounter();
        const show = await this.shouldShowBanner(launchCount);
        if (!show) {
            return;
        }

        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
        switch (response) {
            case this.bannerLabels[ProposeLSLabelIndex.Yes]: {
                this.bannerTriggerCounts[ProposeLSLabelIndex.Yes] += 1;
                await this.enableNewLanguageServer();
                await this.disable();
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.No]: {
                this.bannerTriggerCounts[ProposeLSLabelIndex.No] += 1;
                await this.disable();
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.Later]: {
                this.bannerTriggerCounts[ProposeLSLabelIndex.Later] += 1;
                this.disabledInCurrentSession = true;
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    public async shouldShowBanner(launchCount: number = -1): Promise<boolean> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return false;
        }

        if (launchCount < 0) {
            launchCount = await this.getBannerLaunchCount();
        }

        if (launchCount >= this.maxShowAttempts) {
            // stop pestering this user...
            await this.disable();
        }

        return launchCount < this.maxShowAttempts;
    }

    public async disable(): Promise<void> {
        await this.persistentState.createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, false).updateValue(false);
    }

    public async enableNewLanguageServer(): Promise<void> {
        // set the extension setting useJediLanguageServer: false
        await this.configuration.updateSettingAsync('jediEnabled', false, undefined, ConfigurationTarget.Global);
    }

    private async incrementBannerLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(ProposeLSStateKeys.ShowAttemptCount, 0);
        await state.updateValue(state.value + 1);
        return state.value;
    }

    private async getBannerLaunchCount(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(ProposeLSStateKeys.ShowAttemptCount, 0);
        return state.value;
    }
}
