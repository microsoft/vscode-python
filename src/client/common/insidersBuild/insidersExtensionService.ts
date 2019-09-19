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
        if (await this.handleEdgeCases(installChannel)) {
            // Simply return if channel is already handled and doesn't need further handling
            return;
        }
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
     * @returns `true` if install channel is handled in these miscellaneous cases, `false` if install channel needs further handling
     */
    public async handleEdgeCases(installChannel: ExtensionChannels): Promise<boolean> {
        let caseHandled = true;
        if (installChannel === 'off' && !this.extensionChannelService.isChannelUsingDefaultConfiguration) {
            // If previously in the Insiders Program but not now, request them enroll in the program again
            await this.insidersPrompt.promptToEnrollBackToInsiders();
        } else if (this.appEnvironment.channel === 'insiders' && !this.insidersPrompt.hasUserBeenNotified.value && this.extensionChannelService.isChannelUsingDefaultConfiguration) {
            // Only when using VSC insiders and if they have not been notified before (usually the first session), notify to enroll into the insiders program
            await this.insidersPrompt.notifyToInstallInsiders();
        } else if (installChannel !== 'off' && this.appEnvironment.extensionChannel === 'stable') {
            // When install channel is not in sync with what is installed, we have to resolve discrepency
            // Install channel is set to "weekly" or "daily" but stable version of extension is installed. Switch channel to "off" to use the installed version
            await this.extensionChannelService.updateChannel('off');
        } else {
            caseHandled = false;
        }
        return caseHandled;
    }

    public registerCommandsAndHandlers(): void {
        this.disposables.push(this.extensionChannelService.onDidChannelChange(channel => this.handleChannel(channel, true)));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchOffInsidersChannel, () => this.extensionChannelService.updateChannel('off')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersDaily, () => this.extensionChannelService.updateChannel('daily')));
        this.disposables.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, () => this.extensionChannelService.updateChannel('weekly')));
    }
}
