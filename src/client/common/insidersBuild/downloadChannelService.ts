// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, ConfigurationTarget, Event, EventEmitter } from 'vscode';
import { IApplicationEnvironment, IWorkspaceService } from '../application/types';
import { traceDecorators } from '../logger';
import { IConfigurationService, IDisposable, IDisposableRegistry, IPythonSettings } from '../types';
import { ExtensionChannel, ExtensionChannels, IExtensionChannelService, IInsiderExtensionPrompt } from './types';

export const insidersChannelSetting: keyof IPythonSettings = 'insidersChannel';

@injectable()
export class ExtensionChannelService implements IExtensionChannelService {
    public _onDidChannelChange: EventEmitter<ExtensionChannels> = new EventEmitter<ExtensionChannels>();
    constructor(
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IInsiderExtensionPrompt) private readonly insidersPrompt: IInsiderExtensionPrompt,
        @inject(IDisposableRegistry) disposables: IDisposable[]
    ) {
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }
    public get channel(): ExtensionChannels {
        const settings = this.workspaceService.getConfiguration('python').inspect<ExtensionChannels>(insidersChannelSetting);
        if (!settings) {
            throw new Error(`WorkspaceConfiguration.inspect returns 'undefined' for setting 'python.${insidersChannelSetting}'`);
        }
        if (settings.globalValue === undefined) {
            // If user has not been notified to install insiders yet, this is the first session
            const isThisFirstSession = !this.insidersPrompt.hasUserBeenNotified.value;
            return this.appEnvironment.channel === 'insiders' && isThisFirstSession ? ExtensionChannel.insidersDefaultForTheFirstSession : 'Stable';
        }
        return settings.globalValue;
    }

    @traceDecorators.error('Updating channel failed')
    public async updateChannel(value: ExtensionChannels): Promise<void> {
        await this.configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global);
    }

    public get onDidChannelChange(): Event<ExtensionChannels> {
        return this._onDidChannelChange.event;
    }

    public async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        if (event.affectsConfiguration(`python.${insidersChannelSetting}`)) {
            const settings = this.configService.getSettings();
            this._onDidChannelChange.fire(settings.insidersChannel);
        }
    }
}
