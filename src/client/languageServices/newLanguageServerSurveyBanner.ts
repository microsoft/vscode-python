// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { randomBytes } from 'crypto';
import { inject, injectable } from 'inversify';
import { IApplicationEnvironment, IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IBrowserService, IPersistentStateFactory } from '../common/types';

// persistent state names, exported to make use of in testing
export enum NewLSSurveyStateKeys {
    ShowBanner = 'ShowLSSurveyBanner',
    ShowAttemptCounter = 'LSSurveyLaunchAttempts',
    ShowAfterCompletionCount = 'LSSurveyLaunchAfterCompletionCount'
}

/*
This class represents a popup that will ask our users for some feedback after
a specific event occurs N times. Because we are asking for some valuable
information, it will only request the feedback a specific number of times,
then it will leave the customer alone, so as to not be annoying.
*/
@injectable()
export class NewLanguageServerSurveyBanner {
    private initialized?: boolean;
    private disabledInCurrentSession: boolean = false;
    private bannerMessage: string = 'Can you please take 2 minutes to tell us how the Experimental Debugger is working for you?';
    private minCompletionsBeforeShow: number;
    private maxCompletionsBeforeShow: number;
    private maxShowAttempts: number;

    constructor(@inject(IApplicationShell) private appShell: IApplicationShell,
                @inject(IApplicationEnvironment) private appEnv: IApplicationEnvironment,
                @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
                @inject(IBrowserService) private browserService: IBrowserService,
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

    public async shouldShowBanner(launchCounter?: number): Promise<boolean> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return false;
        }

        if (! launchCounter) {
            launchCounter = await this.getPythonLSLaunchCounter();
        }
        const threshold: number = await this.getPythonLSLaunchThresholdCounter();

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
        if (!this.enabled || this.disabledInCurrentSession) {
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
        const state = this.persistentState.createGlobalPersistentState<number>(NewLSSurveyStateKeys.ShowAttemptCounter, 0);
        await state.updateValue(state.value + 1);
    }
    private async getPythonLSLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(NewLSSurveyStateKeys.ShowAttemptCounter, 0);
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
            const buf: Buffer = randomBytes(2);
            num = (buf.readUInt8(0) << 8) + buf.readUInt8(1);
        }

        const maxValue: number = Math.pow(16, 4) - 1;
        return (num / maxValue);
    }

    private getRandomBetween(min: number = 0, max: number = 10): number {
        const randomVal: number = this.getRandom();
        return min + (randomVal * (max - min));
    }
}
