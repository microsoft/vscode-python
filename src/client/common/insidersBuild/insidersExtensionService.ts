// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionActivationService } from '../../../client/activation/types';
import { IServiceContainer } from '../../ioc/types';
import { Channel, IApplicationEnvironment, ICommandManager } from '../application/types';
import { Commands } from '../constants';
import { traceDecorators } from '../logger';
import { IDisposable, IDisposableRegistry, Resource } from '../types';
import { ExtensionChannels, IExtensionChannelRule, IExtensionChannelService, IInsiderExtensionPrompt } from './types';

@injectable()
export class InsidersExtensionService implements IExtensionActivationService {
    private activatedOnce: boolean = false;
    constructor(
        @inject(IExtensionChannelService) private readonly insidersDownloadChannelService: IExtensionChannelService,
        @inject(IInsiderExtensionPrompt) private readonly insidersPrompt: IInsiderExtensionPrompt,
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
        const downloadChannel = this.insidersDownloadChannelService.channel;
        const extensionChannel: Channel = downloadChannel === 'Stable' ? 'stable' : 'insiders';
        this.handleChannel(downloadChannel, extensionChannel !== this.appEnvironment.extensionChannel).ignoreErrors();
    }

    @traceDecorators.error('Handling channel failed')
    public async handleChannel(downloadChannel: ExtensionChannels, didChannelChange: boolean = false): Promise<void> {
        const channelRule = this.serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, downloadChannel);
        const buildInstaller = await channelRule.getInstaller(didChannelChange);
        if (!buildInstaller) {
            return;
        }
        await buildInstaller.install();
        if (this.insidersPrompt.notificationPromptEnabled.value && downloadChannel !== 'Stable' && this.appEnvironment.channel === 'insiders') {
            return this.insidersPrompt.notifyToInstallInsider();
        }
        await this.insidersPrompt.promptToReload();
    }

    private registerCommandsAndHandlers(): void {
        this.disposables.push(this.insidersDownloadChannelService.onDidChannelChange(channel => this.handleChannel(channel, true)));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToStable, () => this.insidersDownloadChannelService.updateChannel('Stable')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersDaily, () => this.insidersDownloadChannelService.updateChannel('InsidersDaily')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, () => this.insidersDownloadChannelService.updateChannel('InsidersWeekly')));
    }
}
