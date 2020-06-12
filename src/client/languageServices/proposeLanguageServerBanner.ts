// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { LanguageServerType } from '../activation/types';
import { IApplicationEnvironment, IApplicationShell } from '../common/application/types';
import { BannerBase } from '../common/bannerBase';
import '../common/extensions';
import { IConfigurationService, IPersistentStateFactory } from '../common/types';
import * as localize from '../common/utils/localize';
import { getRandomBetween } from '../common/utils/random';

// Persistent state names, exported to make use of in testing
export enum ProposeLSStateKeys {
    // State to remember that we've shown the banner. The name must be
    // different from earlier 'ProposeLSBanner' which was used for MPLSv1.
    ProposeLSBanner = 'ProposeLSBannerV2'
}

enum ProposeLSLabelIndex {
    Yes,
    No,
    Later
}

const bannerShowRate: Map<LanguageServerType, number> = new Map([
    [LanguageServerType.Node, 0],
    [LanguageServerType.Microsoft, 50],
    [LanguageServerType.None, 50],
    [LanguageServerType.Jedi, 10]
]);

@injectable()
export class ProposeLanguageServerBanner extends BannerBase {
    private readonly sampleSizePerHundred: number;
    private bannerMessage: string = localize.LanguageService.proposeLanguageServerMessage();
    private bannerLabels: string[] = [
        localize.LanguageService.tryItNow(),
        localize.LanguageService.noThanks(),
        localize.LanguageService.remindMeLater()
    ];

    constructor(
        @inject(IApplicationEnvironment) private readonly appEnvirontment: IApplicationEnvironment,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) persistentState: IPersistentStateFactory,
        @inject(IConfigurationService) private readonly configuration: IConfigurationService,
        sampleSizePerHundred: number = 10
    ) {
        super(ProposeLSStateKeys.ProposeLSBanner, persistentState);
        if (this.appEnvirontment.channel === 'insiders') {
            // If this is insiders build, everyone gets the banner once. Default is 10%.
            this.sampleSizePerHundred = 100;
            return;
        }
        // Banner for general audience is suppressed until July 7th 2020.
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: remove this eventually.
        const now = new Date();
        const target = new Date('July 7, 2020 0:0:1');
        if (
            now.getFullYear() < target.getFullYear() ||
            now.getMonth() < target.getMonth() ||
            now.getDay() < target.getDay()
        ) {
            this.sampleSizePerHundred = 0;
            this.disable();
            return;
        }

        const ls = configuration.getSettings()?.languageServer ?? LanguageServerType.Jedi;
        this.sampleSizePerHundred = sampleSizePerHundred ?? bannerShowRate.get(ls) ?? 10;
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
        // We only want certain percentage of folks to see the prompt.
        const randomSample: number = getRandomBetween(0, 100);
        if (randomSample >= this.sampleSizePerHundred) {
            await this.disable();
            return;
        }
    }
}
