// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { IExtensionActivationService } from '../../../client/activation/types';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationEnvironment, ICommandManager } from '../application/types';
import { Commands } from '../constants';
import { IExtensionBuildInstaller, INSIDERS_INSTALLER } from '../installer/types';
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
        @inject(IExtensionBuildInstaller) @named(INSIDERS_INSTALLER) private readonly insidersInstaller: IExtensionBuildInstaller,
        @inject(IDisposableRegistry) public readonly disposables: IDisposable[]
    ) { }

    public async activate(_resource: Resource) {
        if (this.activatedOnce) {
            return;
        }
        this.registerCommandsAndHandlers();
        this.activatedOnce = true;
        const installChannel = await this.extensionChannelService.getChannel();
        await this.handleEdgeCases(installChannel);
        this.handleChannel(installChannel).ignoreErrors();
    }

    @traceDecorators.error('Handling channel failed')
    public async handleChannel(installChannel: ExtensionChannels, didChannelChange: boolean = false): Promise<void> {
        const channelRule = this.serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, installChannel);
        const shouldInstall = await channelRule.shouldLookForInsidersBuild(didChannelChange);
        if (!shouldInstall) {
            return;
        }
        await this.insidersInstaller.install();
        await this.insidersPrompt.promptToReload();
    }

    /**
     * Choose between the following prompts and display the right one
     * * 'Notify to install insiders prompt' - Only when using VSC insiders and if they have not been notified before (usually the first session)
     * * 'Discrepency prompt'
     */
    public async handleEdgeCases(installChannel: ExtensionChannels): Promise<void> {
        if (this.appEnvironment.channel === 'insiders' && !this.insidersPrompt.hasUserBeenNotified.value && this.extensionChannelService.isChannelUsingDefaultConfiguration) {
            await this.insidersPrompt.notifyToInstallInsiders();
        } else if (installChannel !== 'default' && this.appEnvironment.extensionChannel === 'stable') {
            // Install channel is set to "weekly" or "daily" but stable version of extension is installed. Change channel to "default" to use the installed version
            await this.extensionChannelService.updateChannel('default');
        }
    }

    public registerCommandsAndHandlers(): void {
        this.disposables.push(this.extensionChannelService.onDidChannelChange(channel => this.handleChannel(channel, true)));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToDefault, () => this.extensionChannelService.updateChannel('default')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersDaily, () => this.extensionChannelService.updateChannel('daily')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, () => this.extensionChannelService.updateChannel('weekly')));
    }
}
