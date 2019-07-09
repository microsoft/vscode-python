// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationShell, ICommandManager } from '../application/types';
import { traceDecorators } from '../logger';
import { IPersistentState, IPersistentStateFactory } from '../types';
import { Common, ExtensionChannels } from '../utils/localize';
import { noop } from '../utils/misc';
import { ExtensionChannel, IExtensionChannelService, IInsiderExtensionPrompt } from './types';

export const insidersPromptStateKey = 'INSIDERS_PROMPT_STATE_KEY';
@injectable()
export class InsidersExtensionPrompt implements IInsiderExtensionPrompt {
    public readonly hasUserBeenNotified: IPersistentState<boolean>;
    public reloadPromptDisabled: boolean = false;
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IExtensionChannelService) private readonly insidersDownloadChannelService: IExtensionChannelService,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory
    ) {
        this.hasUserBeenNotified = this.persistentStateFactory.createGlobalPersistentState(insidersPromptStateKey, false);
    }

    @traceDecorators.error('Error in prompting to install insiders')
    public async notifyToInstallInsiders(): Promise<void> {
        const prompts = [ExtensionChannels.useStable(), Common.reload()];
        const telemetrySelections: ['Use Stable', 'Reload'] = ['Use Stable', 'Reload'];
        const selection = await this.appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts);
        sendTelemetryEvent(EventName.INSIDERS_PROMPT, undefined, { selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined });
        await this.hasUserBeenNotified.updateValue(true);
        this.reloadPromptDisabled = true;
        if (!selection) {
            // Insiders is already installed, but the official default setting is still Stable. Update the setting to be in sync with what is installed.
            return this.insidersDownloadChannelService.updateChannel(ExtensionChannel.insidersDefaultForTheFirstSession);
        }
        if (selection === ExtensionChannels.useStable()) {
            await this.insidersDownloadChannelService.updateChannel(ExtensionChannel.stable);
        } else if (selection === Common.reload()) {
            await this.insidersDownloadChannelService.updateChannel(ExtensionChannel.insidersDefaultForTheFirstSession);
            this.cmdManager.executeCommand('workbench.action.reloadWindow').then(noop);
        }
    }

    @traceDecorators.error('Error in prompting to reload')
    public async promptToReload(): Promise<void> {
        if (this.reloadPromptDisabled) {
            this.reloadPromptDisabled = false;
            return;
        }
        const selection = await this.appShell.showInformationMessage(ExtensionChannels.reloadMessage(), Common.reload());
        sendTelemetryEvent(EventName.INSIDERS_RELOAD_PROMPT, undefined, { selection: selection ? 'Reload' : undefined });
        if (!selection) {
            return;
        }
        if (selection === Common.reload()) {
            this.cmdManager.executeCommand('workbench.action.reloadWindow').then(noop);
        }
    }
}
