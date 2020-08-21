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
    IPythonExtensionBanner
} from '../common/types';
import { Common, Pylance } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';

export function getPylanceExtensionUri(appEnv: IApplicationEnvironment): string {
    return `${appEnv.uriScheme}:extension/${PYLANCE_EXTENSION_ID}`;
}

// persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    ShowBanner = 'TryPylanceBanner'
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
        @inject(IExtensions) readonly extensions: IExtensions
    ) {}

    public get enabled(): boolean {
        const lsType = this.configuration.getSettings().languageServer ?? LanguageServerType.Jedi;
        if (lsType === LanguageServerType.Jedi || lsType === LanguageServerType.Node) {
            return false;
        }
        return this.persistentState.createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, true).value;
    }

    public async showBanner(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const show = await this.shouldShowBanner();
        if (!show) {
            return;
        }

        const response = await this.appShell.showInformationMessage(
            Pylance.proposePylanceMessage(),
            Pylance.tryItNow(),
            Common.bannerLabelNo(),
            Pylance.remindMeLater()
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

    public async shouldShowBanner(): Promise<boolean> {
        // Do not prompt if Pylance is already installed.
        if (this.extensions.getExtension(PYLANCE_EXTENSION_ID)) {
            return false;
        }
        // Only prompt for users in experiment.
        const inExperiment = await this.experiments.inExperiment(TryPylance.experiment);
        return inExperiment && this.enabled && !this.disabledInCurrentSession;
    }

    public async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, false)
            .updateValue(false);
    }
}
