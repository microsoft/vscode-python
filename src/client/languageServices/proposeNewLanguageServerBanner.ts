// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { Uri, window } from 'vscode';
import { IApplicationEnvironment, IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IConfigurationService, IDismissableSurveyBanner, IPersistentStateFactory } from '../common/types';

// persistent state names, exported to make use of in testing
export enum ProposeNewLSStateKeys {
    ShowBanner = 'ShowProposeNewLanguageServerBanner',
    ShowAttemptCount = 'ShowProposalBannerCount'
}

@injectable()
export class ProposeNewLanguageServerBanner implements IDismissableSurveyBanner {
    private initialized?: boolean;
    private disabledInCurrentSession?: boolean;
    private bannerMessage: string = 'Try out Preview of our new Python Language Server to get richer and faster IntelliSense completions, and syntax errors as you type.';
    private bannerOptionLabels: string[] = [
        'Try it now',
        'No thanks',
        'Remind me Later'
    ];
    private maxShowAttempts: number;
    private sampleSizePerHundred: number;

    constructor(@inject(IApplicationShell) private appShell: IApplicationShell,
                @inject(IApplicationEnvironment) private appEnv: IApplicationEnvironment,
                @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
                @inject(IConfigurationService) private configuration: IConfigurationService,
                maxShowAttemptThreshold: number = 10,
                sampleSizePerOneHundredUsers: number = 10
            )
    {
        this.maxShowAttempts = maxShowAttemptThreshold;
        this.sampleSizePerHundred = sampleSizePerOneHundredUsers;
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
        const randomSample: number = this.getRandomBetween(0, 100);
        if (randomSample > this.sampleSizePerHundred) {
            this.disable().ignoreErrors();
            return;
        }
    }

    public get enabled(): boolean {
        if (process.env!.USER!.indexOf('dekeeler') === 0) {
            // tslint:disable-next-line:no-console
            console.log('DEREK YOU NEED TO REMOVE YOURSELF FROM LanguageServerBanner.enabled');
            if (process.env.TF_BUILD || process.env.TRAVIS_CI) {
                throw new Error('Derek you need to turn off your enabled tweak. I just knew you would forget.');
            }
            return true;
        }
        return this.persistentState.createGlobalPersistentState<boolean>(ProposeNewLSStateKeys.ShowBanner, true).value;
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

        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerOptionLabels);
        switch (response) {
            case this.bannerOptionLabels[0]:
                {
                    await this.enableNewLanguageServer();
                    await this.disable();
                    break;
                }
            case this.bannerOptionLabels[1]: {
                await this.disable();
                break;
            }
            case this.bannerOptionLabels[2]: {
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
        if (process.env!.USER!.indexOf('dekeeler') === 0) {
            // tslint:disable-next-line:no-console
            console.log('DEREK YOU NEED TO REMOVE YOURSELF FROM LanguageServerBanner.shouldShowBanner');
            if (process.env.TF_BUILD || process.env.TRAVIS_CI) {
                throw new Error('Derek you need to turn off your enabled tweak. I just knew you would forget.');
            }
            return true;
        }

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

        return launchCount >= this.maxShowAttempts;
    }

    public async disable(): Promise<void> {
        await this.persistentState.createGlobalPersistentState<boolean>(ProposeNewLSStateKeys.ShowBanner, false).updateValue(false);
    }

    // tslint:disable-next-line:no-empty
    public async launchSurvey(): Promise<void> {
    }

    public async enableNewLanguageServer(): Promise<void> {
        // set the extension setting useJediLanguageServer: false
        await this.configuration.updateSettingAsync('python.jediEnabled', 'false', this.settingsUri());
        // reload the current window, or perhaps just warn the user to do so?
    }

    private settingsUri(): Uri | undefined {
        return window.activeTextEditor ? window.activeTextEditor.document.uri : undefined;
    }

    private async incrementBannerLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(ProposeNewLSStateKeys.ShowAttemptCount, 0);
        await state.updateValue(state.value + 1);
        return state.value + 1;
    }

    private async getBannerLaunchCount(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(ProposeNewLSStateKeys.ShowAttemptCount, 0);
        return state.value;
    }

    private getRandom(): number {
        const lastHexValue = this.appEnv.machineId.slice(-4);
        let num = parseInt(`0x${lastHexValue}`, 16);

        if (isNaN(num)) {
            num = 0;
            const buf: Buffer = crypto.randomBytes(4);
            for (let i: number = 0 ; i < 4; i += 1) {
                num = (num * 16) + buf.readUInt8(i);
            }
        }

        const maxValue: number = Math.pow(16, 4) - 1;
        return (num / maxValue);
    }

    private getRandomBetween(min: number = 0, max: number = 10): number {
        const randomVal: number = this.getRandom();
        return min + (randomVal * (max - min));
    }
}
