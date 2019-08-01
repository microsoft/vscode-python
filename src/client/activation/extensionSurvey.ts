// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, optional } from 'inversify';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { traceDecorators } from '../common/logger';
import {
    IBrowserService, IPersistentStateFactory
} from '../common/types';
import { Common, ExtensionSurveyBanner, LanguageService } from '../common/utils/localize';
import { getRandomBetween } from '../common/utils/random';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IExtensionSurvey } from './types';

// persistent state names, exported to make use of in testing
export enum extensionSurveyStateKeys {
    doNotShowAgain = 'doNotShowExtensionSurveyAgain',
    disableSurveyForTime = 'doNotShowExtensionSurveyUntilTime'
}

export const timeToDisableSurveyFor = 1000 * 60 * 60 * 24 * 7 * 12; // 12 weeks
const waitTimeToShowSurvey = 1000 * 60 * 60 * 3; // 3 hours

@injectable()
export class ExtensionSurveyPrompt implements IExtensionSurvey {
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IBrowserService) private browserService: IBrowserService,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @optional() private sampleSizePerOneHundredUsers: number = 10,
        @optional() private waitTime: number = waitTimeToShowSurvey) { }

    public async initialize(): Promise<void> {
        const show = this.shouldShowBanner();
        if (!show) {
            return;
        }
        setTimeout(() => this.showSurvey().ignoreErrors(), this.waitTime);
    }

    @traceDecorators.error('Failed to check whether to display prompt for extension survey')
    public shouldShowBanner(): boolean {
        const doNotShowSurveyAgain = this.persistentState.createWorkspacePersistentState(extensionSurveyStateKeys.doNotShowAgain, false);
        if (doNotShowSurveyAgain.value) {
            return false;
        }
        const isSurveyDisabledForTimeState = this.persistentState.createWorkspacePersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, timeToDisableSurveyFor);
        if (isSurveyDisabledForTimeState.value) {
            return false;
        }
        // we only want 10% of folks to see this survey.
        const randomSample: number = getRandomBetween(0, 100);
        if (randomSample >= this.sampleSizePerOneHundredUsers) {
            return false;
        }
        return true;
    }

    @traceDecorators.error('Failed to display prompt for extension survey')
    public async showSurvey() {
        const prompts = [LanguageService.bannerLabelYes(), ExtensionSurveyBanner.maybeLater(), Common.doNotShowAgain()];
        const telemetrySelections: ['Yes', 'Maybe later', 'Do not show again'] = ['Yes', 'Maybe later', 'Do not show again'];
        const selection = await this.appShell.showInformationMessage(ExtensionSurveyBanner.bannerMessage(), ...prompts);
        sendTelemetryEvent(EventName.EXTENSION_SURVEY_PROMPT, undefined, { selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined });
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            this.launchSurvey();
            // Disable survey for a few weeks
            await this.persistentState.createWorkspacePersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, timeToDisableSurveyFor).updateValue(true);
        } else if (selection === prompts[2]) {
            // Never show the survey again
            await this.persistentState.createWorkspacePersistentState(extensionSurveyStateKeys.doNotShowAgain, false).updateValue(true);
        }
    }

    private launchSurvey() {
        this.browserService.launch('https://aka.ms/AA5rjx5');
    }
}
