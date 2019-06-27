// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationShell, ICommandManager } from '../application/types';
import { IConfigurationService } from '../types';
import { Insiders } from '../utils/localize';
import { noop } from '../utils/misc';
import { IInsidersDownloadChannelService, IInsidersPrompt, InsidersBuildDownloadChannel } from './types';

@injectable()
export class InsidersPrompt implements IInsidersPrompt {
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IInsidersDownloadChannelService) private readonly insidersDownloadChannelService: IInsidersDownloadChannelService,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IConfigurationService) private readonly configService: IConfigurationService
    ) { }
    public async notifyUser() {
        const prompts = [Insiders.useStable(), Insiders.reload()];
        const telemetrySelections: ['Use Stable', 'Reload'] = ['Use Stable', 'Reload'];
        const selection = await this.appShell.showInformationMessage(Insiders.promptMessage(), ...prompts);
        sendTelemetryEvent(EventName.INSIDERS_PROMPT, undefined, { selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined });
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            await this.insidersDownloadChannelService.setDownloadChannel(InsidersBuildDownloadChannel.stable, false);
        } else if (selection === prompts[1]) {
            await this.useInsidersAndReload();
        }
    }

    private async useInsidersAndReload() {
        const settings = this.configService.getSettings();
        if (settings.insidersChannel === 'Stable') {
            await this.insidersDownloadChannelService.setDownloadChannel('InsidersWeekly', false);
        }
        this.cmdManager.executeCommand('workbench.action.reloadWindow').then(noop);
    }
}
