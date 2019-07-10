// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, ConfigurationTarget, Event, EventEmitter } from 'vscode';
import { IApplicationEnvironment, IWorkspaceService } from '../application/types';
import { traceDecorators } from '../logger';
import { IConfigurationService, IDisposable, IDisposableRegistry, IPersistentState, IPersistentStateFactory, IPythonSettings } from '../types';
import { ExtensionChannel, ExtensionChannels, IExtensionChannelService } from './types';

export const insidersChannelSetting: keyof IPythonSettings = 'insidersChannel';
export const isThisFirstSessionStateKey = 'IS_THIS_FIRST_SESSION_KEY';

@injectable()
export class ExtensionChannelService implements IExtensionChannelService {
    public readonly isThisFirstSessionState: IPersistentState<boolean>;
    public _onDidChannelChange: EventEmitter<ExtensionChannels> = new EventEmitter<ExtensionChannels>();
    constructor(
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IDisposableRegistry) disposables: IDisposable[]
    ) {
        this.isThisFirstSessionState = this.persistentStateFactory.createGlobalPersistentState(isThisFirstSessionStateKey, true);
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }
    public async getChannel(): Promise<ExtensionChannels> {
        const settings = this.workspaceService.getConfiguration('python').inspect<ExtensionChannels>(insidersChannelSetting);
        if (!settings) {
            throw new Error(`WorkspaceConfiguration.inspect returns 'undefined' for setting 'python.${insidersChannelSetting}'`);
        }
        if (settings.globalValue === undefined) {
            const isThisFirstSession = this.isThisFirstSessionState.value;
            await this.isThisFirstSessionState.updateValue(false);
            // "Official" VSC default setting value is stable. To keep the official value to be in sync with what is being used,
            // Use Insiders default as 'InsidersWeekly' only for the first session (insiders gets installed for the first session).
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
