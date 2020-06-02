// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { LanguageServerType } from '../activation/types';
import { IApplicationShell } from '../common/application/types';
import { BannerBase } from '../common/bannerBase';
import '../common/extensions';
import { IConfigurationService, IPersistentStateFactory } from '../common/types';
import * as localize from '../common/utils/localize';
import { getRandomBetween } from '../common/utils/random';

// Persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    ShowBanner = 'ProposeLSBanner',
    ReactivatedBannerForV2 = 'ReactivatedBannerForV2'
}

enum ProposeLSLabelIndex {
    Yes,
    No,
    Later
}

abstract class ProposeLanguageServerBanner extends BannerBase {
    private sampleSizePerHundred: number;
    private bannerMessage: string = localize.LanguageService.proposeLanguageServerMessage();
    private bannerLabels: string[] = [
        localize.LanguageService.tryItNow(),
        localize.LanguageService.noThanks(),
        localize.LanguageService.remindMeLater()
    ];

    constructor(
        private appShell: IApplicationShell,
        persistentState: IPersistentStateFactory,
        private configuration: IConfigurationService,
        sampleSizePerOneHundredUsers: number = 10
    ) {
        super(ProposeLSStateKeys.ShowBanner, persistentState);
        this.sampleSizePerHundred = sampleSizePerOneHundredUsers;
    }

    public async showBanner(): Promise<void> {
        const show = await this.shouldShowBanner();
        if (!show) {
            return;
        }

        const response = await this.appShell.showInformationMessage(this.bannerMessage, ...this.bannerLabels);
        switch (response) {
            case this.bannerLabels[ProposeLSLabelIndex.Yes]: {
                await this.enableLanguageServer();
                await this.disable();
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.No]: {
                await this.disable();
                break;
            }
            case this.bannerLabels[ProposeLSLabelIndex.Later]: {
                this.disabledInCurrentSession = true;
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    public async enableLanguageServer(): Promise<void> {
        await this.initialization;
        await this.configuration.updateSetting(
            'languageServer',
            LanguageServerType.Node,
            undefined,
            ConfigurationTarget.Global
        );
    }

    protected async initialize(): Promise<void> {
        // With MPLSv1 preview user could get the offer to use LS and either
        // accept or reject it. The state was then saved. With MPLSv2 we need
        // to clear the state once in order to allow banner to appear again
        // for both Jedi and MPLSv1 users.
        await this.reactivateBannerForLSv2();

        // we only want 10% of folks that use MPLSv1 to see the prompt for MPLS v2.
        const randomSample: number = getRandomBetween(0, 100);
        if (randomSample >= this.sampleSizePerHundred) {
            await this.disable();
            return;
        }
    }

    private async reactivateBannerForLSv2(): Promise<void> {
        const reactivatedPopupOnce = this.getStateValue(ProposeLSStateKeys.ReactivatedBannerForV2, false);
        if (!reactivatedPopupOnce) {
            // Enable popup once.
            await this.setStateValue(ProposeLSStateKeys.ShowBanner, true);
            // Remember we've done it.
            await this.setStateValue(ProposeLSStateKeys.ReactivatedBannerForV2, true);
        }
    }
}

@injectable()
export class ProposeLanguageServerBannerOverJedi extends ProposeLanguageServerBanner {
    constructor(
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IPersistentStateFactory) persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) configuration: IConfigurationService
    ) {
        super(appShell, persistentState, configuration, 10);
    }
}

@injectable()
export class ProposeLanguageServerBannerOverLSv1 extends ProposeLanguageServerBanner {
    constructor(
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IPersistentStateFactory) persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) configuration: IConfigurationService
    ) {
        super(appShell, persistentState, configuration, 50);
    }
}

// tslint:disable-next-line:max-classes-per-file
@injectable()
export class ProposeLanguageServerBannerOverNone extends ProposeLanguageServerBanner {
    constructor(
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IPersistentStateFactory) persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) configuration: IConfigurationService
    ) {
        super(appShell, persistentState, configuration, 50);
    }
}
