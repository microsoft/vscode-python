// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionActivationService } from '../../../client/activation/types';
import { IServiceContainer } from '../../ioc/types';
import { IApplicationEnvironment, ICommandManager } from '../application/types';
import { Commands } from '../constants';
import { IExtensionInstaller } from '../installer/types';
import { IFileSystem } from '../platform/types';
import { IDisposable, IDisposableRegistry, Resource } from '../types';
import { IInsidersDownloadChannelRule, IInsidersDownloadChannelService, IInsidersPrompt, InsidersBuildDownloadChannels } from './types';

@injectable()
export class InsidersExtensionService implements IExtensionActivationService {
    private activatedOnce: boolean = false;
    constructor(
        @inject(IInsidersDownloadChannelService) private readonly insidersDownloadChannelService: IInsidersDownloadChannelService,
        @inject(IInsidersPrompt) private readonly insidersPrompt: IInsidersPrompt,
        @inject(IExtensionInstaller) private readonly extensionInstaller: IExtensionInstaller,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposable[]
    ) { }

    public async activate(_resource: Resource) {
        if (this.activatedOnce) {
            return;
        }
        this.registerCommandsAndHandlers();
        this.activatedOnce = true;
        const downloadChannel = this.insidersDownloadChannelService.getDownloadChannel();
        this.handleChannel(downloadChannel).ignoreErrors();
    }

    public async handleChannel(downloadChannel: InsidersBuildDownloadChannels): Promise<void> {
        const channelRule = this.serviceContainer.get<IInsidersDownloadChannelRule>(IInsidersDownloadChannelRule, downloadChannel);
        await this.optionallyInstallInsidersAndNotify(channelRule);
        await this.optionallyInstallStable(channelRule);
        // if (onDidChannelChange) {
        //     // Channel has changed to stable, prompt to reload window
        //     // To do: Prompt user to reload
        //     const x = 5;
        // }
    }

    public registerCommandsAndHandlers(): void {
        this.insidersDownloadChannelService.onDidChannelChange(channel => this.handleChannel(channel), this, this.disposableRegistry);
        this.disposableRegistry.push(this.cmdManager.registerCommand(Commands.SwitchToStable, () => this.insidersDownloadChannelService.setDownloadChannel('Stable'), this));
        this.disposableRegistry.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersDaily, () => this.insidersDownloadChannelService.setDownloadChannel('InsidersDaily'), this));
        this.disposableRegistry.push(this.cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, () => this.insidersDownloadChannelService.setDownloadChannel('InsidersWeekly'), this));
    }

    private async optionallyInstallInsidersAndNotify(channelRule: IInsidersDownloadChannelRule): Promise<void> {
        const shouldLookForInsiders = await channelRule.shouldLookForInsidersBuild();
        if (shouldLookForInsiders) {
            const vsixFilePath = await this.extensionInstaller.downloadInsiders();
            await this.extensionInstaller.installUsingVSIX(vsixFilePath);
            await this.fs.deleteFile(vsixFilePath);
        }
        if (this.appEnvironment.channel === 'insiders') {
            await this.insidersPrompt.notifyUser();
        }
    }

    private async optionallyInstallStable(channelRule: IInsidersDownloadChannelRule): Promise<void> {
        const shouldLookForStable = await channelRule.shouldLookForStableBuild();
        if (shouldLookForStable) {
            await this.extensionInstaller.installStable();
        }
    }
}
