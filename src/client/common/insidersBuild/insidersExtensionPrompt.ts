// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationShell, ICommandManager } from '../application/types';
import { IPersistentStateFactory } from '../types';
import { Common, ExtensionChannels } from '../utils/localize';
import { noop } from '../utils/misc';
import { ExtensionChannel, IExtensionChannelService, IInsiderExtensionPrompt } from './types';

const insidersPromptStateKey = 'INSIDERS_PROMPT_STATE_KEY';
@injectable()
export class InsidersExtensionPrompt implements IInsiderExtensionPrompt {
    private reloadPromptDisabled: boolean = false;
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IExtensionChannelService) private readonly insidersDownloadChannelService: IExtensionChannelService,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory
    ) { }
    public async notifyToInstallInsider(): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(insidersPromptStateKey, true);
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = [ExtensionChannels.useStable(), Common.reload()];
        const telemetrySelections: ['Use Stable', 'Reload'] = ['Use Stable', 'Reload'];
        const selection = await this.appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts);
        sendTelemetryEvent(EventName.INSIDERS_PROMPT, undefined, { selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined });
        if (!selection) {
            return;
        }
        await notificationPromptEnabled.updateValue(false);
        this.reloadPromptDisabled = true;
        if (selection === ExtensionChannels.useStable()) {
            await this.insidersDownloadChannelService.updateChannel(ExtensionChannel.stable);
        } else if (selection === Common.reload()) {
            await this.insidersDownloadChannelService.updateChannel(ExtensionChannel.weekly);
            this.cmdManager.executeCommand('workbench.action.reloadWindow').then(noop);
        }
    }
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
