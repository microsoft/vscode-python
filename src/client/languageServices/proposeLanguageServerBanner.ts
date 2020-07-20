// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { LanguageServerType } from '../activation/types';
import { IApplicationShell } from '../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../common/constants';
import { TryPylance } from '../common/experiments/groups';
import '../common/extensions';
import {
    IConfigurationService,
    IExperimentService,
    IPersistentStateFactory,
    IPythonExtensionBanner
} from '../common/types';
import { LanguageService } from '../common/utils/localize';

export const PylanceExtensionUri = `${vscode.env.uriScheme}:extension/${PYLANCE_EXTENSION_ID}`;

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
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IExperimentService) private experiments: IExperimentService
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
            LanguageService.proposePylanceMessage(),
            LanguageService.tryItNow(),
            LanguageService.bannerLabelNo(),
            LanguageService.remindMeLater()
        );

        if (response === LanguageService.tryItNow()) {
            this.appShell.openUrl(PylanceExtensionUri);
            await this.disable();
        } else if (response === LanguageService.bannerLabelNo()) {
            await this.disable();
        } else {
            this.disabledInCurrentSession = true;
        }
    }

    public async shouldShowBanner(): Promise<boolean> {
        const inExperiment = await this.experiments.inExperiment(TryPylance.experiment);
        return inExperiment && this.enabled && !this.disabledInCurrentSession;
    }

    public async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, false)
            .updateValue(false);
    }
}
