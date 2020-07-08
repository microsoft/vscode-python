// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { LanguageServerType } from '../activation/types';
import { IApplicationEnvironment, IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { IConfigurationService, IPersistentStateFactory, IPythonExtensionBanner } from '../common/types';
import { LanguageService } from '../common/utils/localize';
import { getRandomBetween } from '../common/utils/random';

// persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    ShowBanner = 'ProposePylanceBanner'
}

const frequencyPerServerType = new Map<LanguageServerType, number>([
    [LanguageServerType.Node, 0],
    [LanguageServerType.Microsoft, 50],
    [LanguageServerType.None, 50],
    // Banner for Jedi users is suppressed until further notice.
    [LanguageServerType.Jedi, 0]
]);

/*
This class represents a popup that propose that the user try out a new
feature of the extension, and optionally enable that new feature if they
choose to do so. It is meant to be shown only to a subset of our users,
and will show as soon as it is instructed to do so, if a random sample
function enables the popup for this user.
*/
@injectable()
export class ProposePylanceBanner implements IPythonExtensionBanner {
    private initialized?: boolean;
    private disabledInCurrentSession: boolean = false;
    private sampleSizePerHundred = 0;

    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IApplicationEnvironment) private appEnvirontment: IApplicationEnvironment,
        sampleSizePerHundred = -1
    ) {
        if (this.appEnvirontment.channel === 'insiders') {
            this.sampleSizePerHundred = 100;
        } else {
            if (sampleSizePerHundred >= 0) {
                this.sampleSizePerHundred = sampleSizePerHundred;
            } else {
                const lsType = this.configuration.getSettings().languageServer ?? LanguageServerType.Jedi;
                this.sampleSizePerHundred = frequencyPerServerType.get(lsType) ?? 0;
            }
        }
        this.initialize();
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

        const randomSample: number = getRandomBetween(0, 100);
        if (randomSample >= this.sampleSizePerHundred) {
            this.disable().ignoreErrors();
            return;
        }
    }
    public get enabled(): boolean {
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
            await this.enableLanguageServer();
            await this.disable();
        } else if (response === LanguageService.bannerLabelNo()) {
            await this.disable();
        } else {
            this.disabledInCurrentSession = true;
        }
    }

    public async shouldShowBanner(): Promise<boolean> {
        return Promise.resolve(this.enabled && !this.disabledInCurrentSession);
    }

    public async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<boolean>(ProposeLSStateKeys.ShowBanner, false)
            .updateValue(false);
    }

    public async enableLanguageServer(): Promise<void> {
        await this.configuration.updateSetting(
            'languageServer',
            LanguageServerType.Node,
            undefined,
            ConfigurationTarget.Global
        );
    }
}
