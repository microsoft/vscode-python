// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IBrowserService, IPersistentStateFactory, IPythonExtensionBanner } from '../common/types';
import * as localize from '../common/utils/localize';

export enum DSSurveyStateKeys {
    ShowBanner = 'ShowDSSurveyBanner',
    ShowAttemptCounter = 'DSSurveyShowAttempt'
}

enum DSSurveyLabelIndex {
    Yes,
    No
}

@injectable()
export class DataScienceSurveyBanner implements IPythonExtensionBanner {
    private disabledInCurrentSession: boolean = false;
    private isInitialized: boolean = false;
    private bannerMessage: string = localize.DataScienceSurveyBanner.bannerMessage();
    private bannerLabels: string[] = [
        localize.DataScienceSurveyBanner.bannerLabelYes(),
        localize.DataScienceSurveyBanner.bannerLabelNo()
    ];
    private readonly commandThreshold: number;
    private readonly surveyLink: string;

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IBrowserService) private browserService: IBrowserService,
        commandThreshold: number = 500,
        surveyLink: string = 'https://aka.ms/pyaisurvey'
    ) {
        this.commandThreshold = commandThreshold;
        this.surveyLink = surveyLink;
        this.initialize();
    }

    public initialize(): void {
        if (this.isInitialized) {
            return;
        }
        this.isInitialized = true;
    }
    public get enabled(): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(DSSurveyStateKeys.ShowBanner, true).value;
    }

    public async showBanner(): Promise<void> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return;
        }

        const launchCounter: number = await this.incrementPythonDataScienceCommandCounter();
        const show = await this.shouldShowBanner(launchCounter);
        if (!show) {
            return;
        }

        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
        switch (response) {
            case this.bannerLabels[DSSurveyLabelIndex.Yes]: {
                await this.launchSurvey();
                await this.disable();
                break;
            }
            case this.bannerLabels[DSSurveyLabelIndex.No]: {
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

        if (!launchCounter) {
            launchCounter = await this.getPythonDSCommandCounter();
        }

        return launchCounter >= this.commandThreshold;
    }

    public async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(DSSurveyStateKeys.ShowBanner, false)
            .updateValue(false);
    }

    public async launchSurvey(): Promise<void> {
        this.browserService.launch(this.surveyLink);
    }

    private async getPythonDSCommandCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(DSSurveyStateKeys.ShowAttemptCounter, 0);
        return state.value;
    }

    private async incrementPythonDataScienceCommandCounter(): Promise<number> {
        const state = this.persistentState.createGlobalPersistentState<number>(DSSurveyStateKeys.ShowAttemptCounter, 0);
        await state.updateValue(state.value + 1);
        return state.value;
    }
}
