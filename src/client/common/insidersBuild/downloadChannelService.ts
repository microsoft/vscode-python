// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Event, EventEmitter } from 'vscode';
import { IConfigurationService, IPersistentState, IPersistentStateFactory, IPythonSettings } from '../types';
import { IInsidersDownloadChannelService, InsidersBuildDownloadChannels } from './types';

const isChannelUsingDefaultConfigurationKey = 'IS_CHANNEL_CONFIGURED_KEY';
const insidersChannelSetting: keyof IPythonSettings = 'insidersChannel';

@injectable()
export class InsidersDownloadChannelService implements IInsidersDownloadChannelService {
    private readonly _onDidChannelChange: EventEmitter<InsidersBuildDownloadChannels> = new EventEmitter<InsidersBuildDownloadChannels>();
    private isChannelUsingDefaultConfiguration: IPersistentState<boolean>;
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IConfigurationService) private readonly configService: IConfigurationService
    ) {
        this.isChannelUsingDefaultConfiguration = this.persistentStateFactory.createGlobalPersistentState(isChannelUsingDefaultConfigurationKey, true);
    }
    public getDownloadChannel(): InsidersBuildDownloadChannels {
        const settings = this.configService.getSettings();
        return settings.insidersChannel;
    }

    public async setDownloadChannel(value: InsidersBuildDownloadChannels, fireEvent: boolean = true): Promise<void> {
        await this.configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global);
        await this.isChannelUsingDefaultConfiguration.updateValue(false);
        if (fireEvent) {
            this._onDidChannelChange.fire(value);
        }
    }

    public get hasUserConfiguredChannel(): boolean {
        return !this.isChannelUsingDefaultConfiguration.value;
    }

    public get onDidChannelChange(): Event<InsidersBuildDownloadChannels> {
        return this._onDidChannelChange.event;
    }
}
