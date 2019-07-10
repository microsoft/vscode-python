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
    public activatedOnce: boolean = false;
    constructor(
        @inject(IExtensionChannelService) private readonly extensionChannelService: IExtensionChannelService,
        @inject(IInsiderExtensionPrompt) private readonly insidersPrompt: IInsiderExtensionPrompt,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) public readonly disposables: IDisposable[]
    ) { }

    public async activate(_resource: Resource) {
        if (this.activatedOnce) {
            return;
        }
        this.registerCommandsAndHandlers();
        this.activatedOnce = true;
        const installChannel = await this.extensionChannelService.getChannel();
        const newExtensionChannel: Channel = installChannel === 'Stable' ? 'stable' : 'insiders';
        this.handleChannel(installChannel, newExtensionChannel !== this.appEnvironment.extensionChannel).ignoreErrors();
    }

    @traceDecorators.error('Handling channel failed')
    public async handleChannel(installChannel: ExtensionChannels, didChannelChange: boolean = false): Promise<void> {
        const channelRule = this.serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, installChannel);
        const buildInstaller = await channelRule.getInstaller(didChannelChange);
        if (!buildInstaller) {
            return;
        }
        await buildInstaller.install();
        await this.choosePromptAndDisplay(installChannel, didChannelChange);
    }

    /**
     * Choose between the following prompts and display the right one
     * * 'Reload prompt' - Ask users to reload on channel change
     * * 'Notify to install insiders prompt' - Only when using VSC insiders and if they have not been notified before (usually the first session)
     */
    public async choosePromptAndDisplay(installChannel: ExtensionChannels, didChannelChange: boolean): Promise<void> {
        if (this.appEnvironment.channel === 'insiders' && installChannel !== 'Stable' && !this.insidersPrompt.hasUserBeenNotified.value) {
            // If user is using VS Code Insiders, channel is `Insiders*` and user has not been notified, then notify user
            await this.insidersPrompt.notifyToInstallInsiders();
        } else if (didChannelChange) {
            await this.insidersPrompt.promptToReload();
        }
    }

    public registerCommandsAndHandlers(): void {
        this.disposables.push(this.extensionChannelService.onDidChannelChange(channel => this.handleChannel(channel, true)));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToStable, () => this.extensionChannelService.updateChannel('Stable')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersDaily, () => this.extensionChannelService.updateChannel('InsidersDaily')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, () => this.extensionChannelService.updateChannel('InsidersWeekly')));
    }
}
