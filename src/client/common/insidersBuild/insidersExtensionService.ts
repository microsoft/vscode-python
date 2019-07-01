// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionActivationService } from '../../../client/activation/types';
import { IServiceContainer } from '../../ioc/types';
import { Channel, IApplicationEnvironment, ICommandManager } from '../application/types';
import { Commands } from '../constants';
import { IDisposable, IDisposableRegistry, Resource } from '../types';
import { IInsidersDownloadChannelRule, IInsidersDownloadChannelService, IInsidersPrompt, InsidersBuildDownloadChannels } from './types';

@injectable()
export class InsidersExtensionService implements IExtensionActivationService {
    private activatedOnce: boolean = false;
    constructor(
        @inject(IInsidersDownloadChannelService) private readonly insidersDownloadChannelService: IInsidersDownloadChannelService,
        @inject(IInsidersPrompt) private readonly insidersPrompt: IInsidersPrompt,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) private disposables: IDisposable[]
    ) { }

    public async activate(_resource: Resource) {
        if (this.activatedOnce) {
            return;
        }
        this.registerCommandsAndHandlers();
        this.activatedOnce = true;
        const downloadChannel = this.insidersDownloadChannelService.getDownloadChannel();
        const extensionChannel: Channel = downloadChannel === 'Stable' ? 'stable' : 'insiders';
        this.handleChannel(downloadChannel, extensionChannel !== this.appEnvironment.extensionChannel).ignoreErrors();
    }

    public async handleChannel(downloadChannel: InsidersBuildDownloadChannels, didChannelChange: boolean = false): Promise<void> {
        const channelRule = this.serviceContainer.get<IInsidersDownloadChannelRule>(IInsidersDownloadChannelRule, downloadChannel);
        const buildInstaller = await channelRule.getInstallerForBuild(didChannelChange);
        if (!buildInstaller) {
            return;
        }
        await buildInstaller.install();
        if (downloadChannel !== 'Stable' && this.appEnvironment.channel === 'insiders') {
            return this.insidersPrompt.notifyUser();
        }
        await this.insidersPrompt.promptToReload();
    }

    private registerCommandsAndHandlers(): void {
        this.disposables.push(this.insidersDownloadChannelService.onDidChannelChange(channel => this.handleChannel(channel, true)));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToStable, () => this.insidersDownloadChannelService.setDownloadChannel('Stable')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersDaily, () => this.insidersDownloadChannelService.setDownloadChannel('InsidersDaily')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, () => this.insidersDownloadChannelService.setDownloadChannel('InsidersWeekly')));
    }
}
