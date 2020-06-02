// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { FolderVersionPair, ILanguageServerFolderService } from '../activation/types';
import { IApplicationShell } from '../common/application/types';
import { BannerBase } from '../common/bannerBase';
import '../common/extensions';
import { IBrowserService, IPersistentStateFactory } from '../common/types';
import * as localize from '../common/utils/localize';
import { getRandomBetween } from '../common/utils/random';

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
a specific event occurs N times.
*/
@injectable()
export class LanguageServerSurveyBanner extends BannerBase {
    private minCompletionsBeforeShow: number;
    private maxCompletionsBeforeShow: number;
    private bannerMessage: string = localize.LanguageService.bannerMessage();
    private bannerLabels: string[] = [
        localize.LanguageService.bannerLabelYes(),
        localize.LanguageService.bannerLabelNo()
    ];

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) persistentState: IPersistentStateFactory,
        @inject(IBrowserService) private browserService: IBrowserService,
        @inject(ILanguageServerFolderService) private lsService: ILanguageServerFolderService,
        showAfterMinimumEventsCount: number = 100,
        showBeforeMaximumEventsCount: number = 500
    ) {
        super(LSSurveyStateKeys.ShowBanner, persistentState);
        this.minCompletionsBeforeShow = showAfterMinimumEventsCount;
        this.maxCompletionsBeforeShow = showBeforeMaximumEventsCount;
        if (this.minCompletionsBeforeShow >= this.maxCompletionsBeforeShow) {
            this.disable().ignoreErrors();
        }
    }

    public async showBanner(): Promise<void> {
        const launchCounter: number = await this.incrementPythonLanguageServiceLaunchCounter();
        const show = await this.shouldShowBannerEx(launchCounter);
        if (!show) {
            return;
        }

        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
        switch (response) {
            case this.bannerLabels[LSSurveyLabelIndex.Yes]: {
                await this.launchSurvey();
                await this.disable();
                break;
            }
            case this.bannerLabels[LSSurveyLabelIndex.No]: {
                await this.disable();
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    public async shouldShowBannerEx(launchCounter?: number): Promise<boolean> {
        if (!(await super.shouldShowBanner())) {
            return false;
        }

        if (!launchCounter) {
            launchCounter = await this.getPythonLSLaunchCounter();
        }

        const threshold: number = await this.getPythonLSLaunchThresholdCounter();
        return launchCounter >= threshold;
    }

    public async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(LSSurveyStateKeys.ShowBanner, false)
            .updateValue(false);
    }

    public async launchSurvey(): Promise<void> {
        const launchCounter = await this.getPythonLSLaunchCounter();
        let lsVersion: string = await this.getPythonLSVersion();
        lsVersion = encodeURIComponent(lsVersion);
        this.browserService.launch(`https://www.surveymonkey.com/r/ZK7YYVF?n=${launchCounter}&v=${lsVersion}`);
    }

    private async incrementPythonLanguageServiceLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(LSSurveyStateKeys.ShowAttemptCounter, 0);
        await state.updateValue(state.value + 1);
        return state.value;
    }

    private async getPythonLSVersion(fallback: string = 'unknown'): Promise<string> {
        const langServiceLatestFolder:
            | FolderVersionPair
            | undefined = await this.lsService.getCurrentLanguageServerDirectory();
        return langServiceLatestFolder ? langServiceLatestFolder.version.raw : fallback;
    }

    private async getPythonLSLaunchCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(LSSurveyStateKeys.ShowAttemptCounter, 0);
        return state.value;
    }

    private async getPythonLSLaunchThresholdCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number | undefined>(
            LSSurveyStateKeys.ShowAfterCompletionCount,
            undefined
        );
        if (state.value === undefined) {
            await state.updateValue(getRandomBetween(this.minCompletionsBeforeShow, this.maxCompletionsBeforeShow));
        }
        return state.value!;
    }
}
