// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { LanguageServerType } from '../activation/types';
import { IApplicationEnvironment, IApplicationShell } from '../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../common/constants';
import { TryPylance } from '../common/experiments/groups';
import '../common/extensions';
import {
    IConfigurationService,
    IExperimentService,
    IExtensions,
    IPersistentStateFactory,
    IPythonExtensionBanner,
} from '../common/types';
import { Common, Pylance } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';

export function getPylanceExtensionUri(appEnv: IApplicationEnvironment): string {
    return `${appEnv.uriScheme}:extension/${PYLANCE_EXTENSION_ID}`;
}

// persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    ShowBanner = 'TryPylanceBanner',
}

/*
This class represents a popup that propose that the user try out a new
feature of the extension, and optionally enable that new feature if they
choose to do so. It is meant to be shown only to a subset of our users,
and will show as soon as it is instructed to do so, if a random sample
function enables the popup for this user.
*/
@injectable()
export class ProposePylanceBanner implements IPythonExtensionBanner {
    private disabledInCurrentSession: boolean = false;

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IApplicationEnvironment) private appEnv: IApplicationEnvironment,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IExperimentService) private experiments: IExperimentService,
        @inject(IExtensions) readonly extensions: IExtensions,
    ) {}

    public get enabled(): boolean {
        return this.persistentState.createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, true).value;
    }

    public async showBanner(): Promise<void> {
        // Call this first to ensure that the experiment service is called.
        const message = await this.getPromptMessage();
        if (!message) {
            return;
        }

        if (!this.enabled) {
            return;
        }

        const response = await this.appShell.showInformationMessage(
            message,
            Pylance.tryItNow(),
            Common.bannerLabelNo(),
            Pylance.remindMeLater(),
        );

        let userAction: string;
        if (response === Pylance.tryItNow()) {
            this.appShell.openUrl(getPylanceExtensionUri(this.appEnv));
            userAction = 'yes';
            await this.disable();
        } else if (response === Common.bannerLabelNo()) {
            await this.disable();
            userAction = 'no';
        } else {
            this.disabledInCurrentSession = true;
            userAction = 'later';
        }
        sendTelemetryEvent(EventName.LANGUAGE_SERVER_TRY_PYLANCE, undefined, { userAction });
    }

    public async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, false)
            .updateValue(false);
    }

    public async getPromptMessage(): Promise<string | undefined> {
        if (this.disabledInCurrentSession) {
            return undefined;
        }

        const lsType = this.configuration.getSettings().languageServer ?? LanguageServerType.Jedi;

        let message: string | undefined;

        if (lsType === LanguageServerType.Jedi) {
            if (await this.experiments.inExperiment(TryPylance.jediPrompt1)) {
                message = await this.experiments.getExperimentValue<string>(TryPylance.jediPrompt1);
            } else if (await this.experiments.inExperiment(TryPylance.jediPrompt2)) {
                message = await this.experiments.getExperimentValue<string>(TryPylance.jediPrompt2);
            }
        } else if (lsType === LanguageServerType.Microsoft || lsType === LanguageServerType.None) {
            if (await this.experiments.inExperiment(TryPylance.experiment)) {
                message = Pylance.proposePylanceMessage();
            }
        }

        // Do not prompt if Pylance is already installed.
        if (this.extensions.getExtension(PYLANCE_EXTENSION_ID)) {
            return undefined;
        }

        return message;
    }
}
