// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, ConfigurationTarget, Event, EventEmitter } from 'vscode';
import { IApplicationEnvironment, IWorkspaceService } from '../application/types';
import { IConfigurationService, IDisposable, IDisposableRegistry, IPythonSettings } from '../types';
import { IInsidersDownloadChannelService, InsidersBuildDownloadChannels } from './types';

const insidersChannelSetting: keyof IPythonSettings = 'insidersChannel';

@injectable()
export class InsidersDownloadChannelService implements IInsidersDownloadChannelService {
    private readonly _onDidChannelChange: EventEmitter<InsidersBuildDownloadChannels> = new EventEmitter<InsidersBuildDownloadChannels>();
    constructor(
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDisposableRegistry) disposables: IDisposable[]
    ) {
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }
    public getDownloadChannel(): InsidersBuildDownloadChannels {
        const settings = this.workspaceService.getConfiguration('python').inspect<InsidersBuildDownloadChannels>(insidersChannelSetting);
        if (!settings) {
            throw new Error(`WorkspaceConfiguration.inspect returns 'undefined' for setting 'python.${insidersChannelSetting}'`);
        }
        if (settings.globalValue === undefined) {
            if (this.appEnvironment.channel === 'insiders') {
                return 'InsidersWeekly';
            }
            return 'Stable';
        }
        return settings.globalValue;
    }

    public async setDownloadChannel(value: InsidersBuildDownloadChannels): Promise<void> {
        await this.configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global);
    }

    public get onDidChannelChange(): Event<InsidersBuildDownloadChannels> {
        return this._onDidChannelChange.event;
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        if (event.affectsConfiguration(`python.${insidersChannelSetting}`)) {
            const settings = this.configService.getSettings();
            this._onDidChannelChange.fire(settings.insidersChannel);
        }
    }
}
