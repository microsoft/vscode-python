// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationEnvironment, ICommandManager } from '../application/types';
import { Commands } from '../constants';
import { IExtensionBuildInstaller, INSIDERS_INSTALLER } from '../installer/types';
import { traceDecorators } from '../logger';
import { IDisposable, IDisposableRegistry } from '../types';
import { ExtensionChannels, IExtensionChannelRule, IExtensionChannelService, IInsiderExtensionPrompt } from './types';

@injectable()
export class InsidersExtensionService implements IExtensionSingleActivationService {
    constructor(
        @inject(IExtensionChannelService) private readonly extensionChannelService: IExtensionChannelService,
        @inject(IInsiderExtensionPrompt) private readonly insidersPrompt: IInsiderExtensionPrompt,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IExtensionBuildInstaller) @named(INSIDERS_INSTALLER) private readonly insidersInstaller: IExtensionBuildInstaller,
        @inject(IDisposableRegistry) public readonly disposables: IDisposable[]
    ) { }

    public async activate() {
        this.registerCommandsAndHandlers();
        const installChannel = this.extensionChannelService.getChannel();
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
     * Choose what to do in miscellaneous situations
     * * 'Notify to install insiders prompt' - Only when using VSC insiders and if they have not been notified before (usually the first session)
     * * 'Resolve discrepency' - When install channel is not in sync with what is installed.
     */
    public async handleEdgeCases(installChannel: ExtensionChannels): Promise<void> {
        if (this.appEnvironment.channel === 'insiders' && !this.insidersPrompt.hasUserBeenNotified.value && this.extensionChannelService.isChannelUsingDefaultConfiguration) {
            await this.insidersPrompt.notifyToInstallInsiders();
        } else if (installChannel !== 'off' && this.appEnvironment.extensionChannel === 'stable') {
            // Install channel is set to "weekly" or "daily" but stable version of extension is installed. Switch channel to "off" to use the installed version
            await this.extensionChannelService.updateChannel('off');
        }
    }

    public registerCommandsAndHandlers(): void {
        this.disposables.push(this.extensionChannelService.onDidChannelChange(channel => this.handleChannel(channel, true)));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchOffInsidersChannel, () => this.extensionChannelService.updateChannel('off')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersDaily, () => this.extensionChannelService.updateChannel('daily')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, () => this.extensionChannelService.updateChannel('weekly')));
    }
}
