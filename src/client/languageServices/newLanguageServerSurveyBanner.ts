// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { IApplicationEnvironment, IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IBrowserService, IDismissableSurveyBanner, IPersistentStateFactory } from '../common/types';

// persistent state names, exported to make use of in testing
export enum NewLSSurveyStateKeys {
    ShowBanner = 'ShowLSSurveyBanner',
    LaunchAttemptCounter = 'LSSurveyLaunchAttempts',
    ShowAfterCompletionCount = 'LSSurveyLaunchAfterCompletionCount'
}

@injectable()
export class NewLanguageServerSurveyBanner implements IDismissableSurveyBanner {
    private initialized?: boolean;
    private disabledInCurrentSession?: boolean;
    private bannerMessage: string = 'Can you please take 2 minutes to tell us how the Experimental Debugger is working for you?';
    private minCompletionsBeforeShow: number;
    private maxCompletionsBeforeShow: number;
    private maxShowAttempts: number;

    constructor(@inject(IApplicationShell) private appShell: IApplicationShell,
                @inject(IApplicationEnvironment) private appEnv: IApplicationEnvironment,
                @inject(IBrowserService) private browserService: IBrowserService,
                @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
                maxShowAttemptThreshold: number = 10,
                showAfterMinimumEventsCount: number = 100,
                showBeforeMaximumEventsCount: number = 500
            )
    {
        this.minCompletionsBeforeShow = showAfterMinimumEventsCount;
        this.maxCompletionsBeforeShow = showBeforeMaximumEventsCount;
        this.maxShowAttempts = maxShowAttemptThreshold;
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
        return this.persistentState.createGlobalPersistentState<boolean>(NewLSSurveyStateKeys.ShowBanner, true).value;
    }

    public async showBanner(): Promise<void> {
        const yes = 'Yes, take survey now';
        const no = 'No, thanks';
        const response = await this.appShell.showInformationMessage(this.bannerMessage, yes, no);
        switch (response) {
            case yes:
                {
                    await this.launchSurvey();
                    await this.disable();
                    break;
                }
            case no: {
                await this.disable();
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    public async shouldShowBanner(): Promise<boolean> {
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

        const [threshold, launchCounter] = await Promise.all([this.getPythonLSLaunchThresholdCounter(), this.getPythonLSLaunchCounter()]);
        if (launchCounter >= threshold) {
            // now see how many times we've already attempted to show this survey banner
            if ((launchCounter - threshold) > this.maxShowAttempts) {
                // We've asked a reasonable amount of times, back off. *should we re-initialize here to the next threshold instead?
                await this.disable();
                return false;
            }
        }

        return launchCounter >= threshold;
    }

    public async disable(): Promise<void> {
        await this.persistentState.createGlobalPersistentState<boolean>(NewLSSurveyStateKeys.ShowBanner, false).updateValue(false);
    }

    public async launchSurvey(): Promise<void> {
        const launchCounter = await this.getPythonLSLaunchCounter();
        this.browserService.launch(`https://www.research.net/r/LJZV9BZ?n=${launchCounter}`);
    }

    public async onUpdateIncidentCount(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        await this.incrementPythonLanguageServiceLaunchCounter();
        const show = await this.shouldShowBanner();
        if (!show) {
            return;
        }

        await this.showBanner();
    }

    public async onInitializedPythonLanguageService(): Promise<void> {
        return this.onUpdateIncidentCount();
    }

    private async incrementPythonLanguageServiceLaunchCounter(): Promise<void> {
        const state = this.persistentState.createGlobalPersistentState<number>(NewLSSurveyStateKeys.LaunchAttemptCounter, 0);
        await state.updateValue(state.value + 1);
    }
    private async getPythonLSLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(NewLSSurveyStateKeys.LaunchAttemptCounter, 0);
        return state.value;
    }
    private async getPythonLSLaunchThresholdCounter(): Promise<number> {

        const state = this.persistentState.createGlobalPersistentState<number | undefined>(NewLSSurveyStateKeys.ShowAfterCompletionCount, undefined);
        if (state.value === undefined) {
            await state.updateValue(this.getRandomBetween(this.minCompletionsBeforeShow, this.maxCompletionsBeforeShow));
        }
        return state.value!;
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
