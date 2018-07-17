// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IBrowserService, IPersistentStateFactory,
    IPythonExtensionBanner } from '../common/types';
import { getRandomBetween } from '../common/utils';

// persistent state names, exported to make use of in testing
export enum LSSurveyStateKeys {
    ShowBanner = 'ShowLSSurveyBanner',
    ShowAttemptCounter = 'LSSurveyShowAttempt',
    ShowAfterCompletionCount = 'LSSurveyShowCount'
}

enum LSSurveyLabelIndex {
    Yes,
    No
}

/*
This class represents a popup that will ask our users for some feedback after
a specific event occurs N times. Because we are asking for some valuable
information, it will only request the feedback a specific number of times,
then it will leave the customer alone, so as to not be annoying.
*/
@injectable()
export class LanguageServerSurveyBanner implements IPythonExtensionBanner {
    private disabledInCurrentSession: boolean = false;
    private minCompletionsBeforeShow: number;
    private maxCompletionsBeforeShow: number;
    private maxShowAttempts: number;
    private bannerMessage: string = 'Can you please take 2 minutes to tell us how the Experimental Debugger is working for you?';
    private bannerLabels: string [] = [ 'Yes, take survey now', 'No, thanks'];
    private labelTriggerCount: number[] = [0, 0];

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IBrowserService) private browserService: IBrowserService,
        maxShowAttemptThreshold: number = 10,
        showAfterMinimumEventsCount: number = 100,
        showBeforeMaximumEventsCount: number = 500)
    {
        this.minCompletionsBeforeShow = showAfterMinimumEventsCount;
        this.maxCompletionsBeforeShow = showBeforeMaximumEventsCount;
        this.maxShowAttempts = maxShowAttemptThreshold;
    }

    public get optionLabels(): string[] {
        return this.bannerLabels;
    }

    public get shownCount(): Promise<number> {
        return this.getPythonLSLaunchCounter();
    }

    public optionTriggerCount(label: string): number {
        let count: number = -1;
        switch (label) {
            case this.bannerLabels[LSSurveyLabelIndex.Yes]: {
                count = this.labelTriggerCount[LSSurveyLabelIndex.Yes];
                break;
            }
            case this.bannerLabels[LSSurveyLabelIndex.No]: {
                count = this.labelTriggerCount[LSSurveyLabelIndex.No];
                break;
            }
            default: {
                break;
            }
        }
        return count;
    }

    public get enabled(): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(LSSurveyStateKeys.ShowBanner, true).value;
    }

    public async showBanner(): Promise<void> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return;
        }

        const launchCounter: number = await this.incrementPythonLanguageServiceLaunchCounter();
        const show = await this.shouldShowBanner(launchCounter);
        if (!show) {
            return;
        }

        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
        switch (response) {
            case this.bannerLabels[LSSurveyLabelIndex.Yes]:
                {
                    this.labelTriggerCount[LSSurveyLabelIndex.Yes] += 1;
                    await this.launchSurvey();
                    await this.disable();
                    break;
                }
            case this.bannerLabels[LSSurveyLabelIndex.No]: {
                this.labelTriggerCount[LSSurveyLabelIndex.No] += 1;
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
        await this.persistentState.createGlobalPersistentState<boolean>(LSSurveyStateKeys.ShowBanner, false).updateValue(false);
    }

    public async launchSurvey(): Promise<void> {
        const launchCounter = await this.getPythonLSLaunchCounter();
        this.browserService.launch(`https://www.research.net/r/LJZV9BZ?n=${launchCounter}`);
    }

    private async incrementPythonLanguageServiceLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(LSSurveyStateKeys.ShowAttemptCounter, 0);
        await state.updateValue(state.value + 1);
        return state.value;
    }

    private async getPythonLSLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(LSSurveyStateKeys.ShowAttemptCounter, 0);
        return state.value;
    }

    private async getPythonLSLaunchThresholdCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number | undefined>(LSSurveyStateKeys.ShowAfterCompletionCount, undefined);
        if (state.value === undefined) {
            await state.updateValue(getRandomBetween(this.minCompletionsBeforeShow, this.maxCompletionsBeforeShow));
        }
        return state.value!;
    }
}
