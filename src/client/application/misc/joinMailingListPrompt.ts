// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as querystring from 'querystring';
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
        if (this.storage.value) {
            return Promise.resolve();
        }

        let promptContent: string | undefined;
        if (await this.experiments.inExperiment(JoinMailingListPromptVariants.joinMailingListWordingVariant1)) {
            promptContent = await this.experiments.getExperimentValue<string>(
                JoinMailingListPromptVariants.joinMailingListWordingVariant1
            );
        } else if (await this.experiments.inExperiment(JoinMailingListPromptVariants.joinMailingListWordingVariant2)) {
            promptContent = await this.experiments.getExperimentValue<string>(
                JoinMailingListPromptVariants.joinMailingListWordingVariant2
            );
        } else if (await this.experiments.inExperiment(JoinMailingListPromptVariants.joinMailingListWordingVariant3)) {
            promptContent = await this.experiments.getExperimentValue<string>(
                JoinMailingListPromptVariants.joinMailingListWordingVariant3
            );
        }

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
