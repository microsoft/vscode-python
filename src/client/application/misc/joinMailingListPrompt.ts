// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as querystring from 'querystring';
import { env, UIKind } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationEnvironment, IApplicationShell } from '../../common/application/types';
import { JoinMailingListPromptVariants } from '../../common/experiments/groups';
import { IBrowserService, IExperimentService, IPersistentState, IPersistentStateFactory } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import { Common } from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';

@injectable()
export class JoinMailingListPrompt implements IExtensionSingleActivationService {
    private readonly storage: IPersistentState<boolean>;

    constructor(
        @inject(IApplicationShell) private readonly shell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly factory: IPersistentStateFactory,
        @inject(IExperimentService) private readonly experiments: IExperimentService,
        @inject(IBrowserService) private browserService: IBrowserService,
        @inject(IApplicationEnvironment) private appEnvironment: IApplicationEnvironment
    ) {
        this.storage = this.factory.createGlobalPersistentState('JoinMailingListPrompt', false);
    }

    public async activate(): Promise<void> {
        // Only show the prompt if we have never shown it before. True here, means we have
        // shown the prompt before. Also do not show the prompt if running in Codespaces.
        if (this.storage.value || env.uiKind === UIKind?.Web) {
            return;
        }

        let promptContent: string | undefined;
        if (await this.experiments.inExperiment(JoinMailingListPromptVariants.variant1)) {
            promptContent = await this.experiments.getExperimentValue<string>(JoinMailingListPromptVariants.variant1);
        } else if (await this.experiments.inExperiment(JoinMailingListPromptVariants.variant2)) {
            promptContent = await this.experiments.getExperimentValue<string>(JoinMailingListPromptVariants.variant2);
        } else if (await this.experiments.inExperiment(JoinMailingListPromptVariants.variant3)) {
            promptContent = await this.experiments.getExperimentValue<string>(JoinMailingListPromptVariants.variant3);
        } else {
            // Not in any experiment, so no content to show.
            promptContent = undefined;
        }

        // Show the prompt only if there is any content to show.
        if (promptContent) {
            this.showTip(promptContent).ignoreErrors();
        }

        // Disable this prompt for all users after the first load. Even if they
        // never saw the prompt.
        await this.storage.updateValue(true);
    }

    @swallowExceptions('Failed to display tip')
    private async showTip(promptContent: string) {
        const selection = await this.shell.showInformationMessage(
            promptContent,
            Common.bannerLabelYes(),
            Common.bannerLabelNo()
        );

        if (selection === Common.bannerLabelYes()) {
            sendTelemetryEvent(EventName.JOIN_MAILING_LIST_PROMPT, undefined, { selection: 'Yes' });
            const query = querystring.stringify({
                m: encodeURIComponent(this.appEnvironment.sessionId)
            });
            const url = `https://aka.ms/python-vscode-mailinglist?${query}`;
            this.browserService.launch(url);
        } else if (selection === Common.bannerLabelNo()) {
            sendTelemetryEvent(EventName.JOIN_MAILING_LIST_PROMPT, undefined, { selection: 'No' });
        } else {
            sendTelemetryEvent(EventName.JOIN_MAILING_LIST_PROMPT, undefined, { selection: undefined });
        }
    }
}
