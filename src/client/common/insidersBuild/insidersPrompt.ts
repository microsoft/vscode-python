// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationShell, ICommandManager } from '../application/types';
import { IPersistentStateFactory } from '../types';
import { Common, Insiders } from '../utils/localize';
import { noop } from '../utils/misc';
import { IInsidersDownloadChannelService, IInsidersPrompt, InsidersBuildDownloadChannel } from './types';

const insidersPromptStateKey = 'INSIDERS_PROMPT_STATE_KEY';
@injectable()
export class InsidersPrompt implements IInsidersPrompt {
    private reloadPromptDisabled: boolean = false;
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IInsidersDownloadChannelService) private readonly insidersDownloadChannelService: IInsidersDownloadChannelService,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory
    ) { }
    public async notifyUser(): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(insidersPromptStateKey, true);
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = [Insiders.useStable(), Common.reload()];
        const telemetrySelections: ['Use Stable', 'Reload'] = ['Use Stable', 'Reload'];
        const selection = await this.appShell.showInformationMessage(Insiders.promptMessage(), ...prompts);
        sendTelemetryEvent(EventName.INSIDERS_PROMPT, undefined, { selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined });
        if (!selection) {
            return;
        }
        await notificationPromptEnabled.updateValue(false);
        this.reloadPromptDisabled = true;
        if (selection === prompts[0]) {
            await this.insidersDownloadChannelService.setDownloadChannel(InsidersBuildDownloadChannel.stable);
        } else if (selection === prompts[1]) {
            this.cmdManager.executeCommand('workbench.action.reloadWindow').then(noop);
        }
    }
    public async promptToReload(): Promise<void> {
        if (this.reloadPromptDisabled) {
            this.reloadPromptDisabled = false;
            return;
        }
        const prompts = [Common.reload()];
        const selection = await this.appShell.showInformationMessage(Insiders.reloadMessage(), ...prompts);
        sendTelemetryEvent(EventName.INSIDERS_RELOAD_PROMPT, undefined, { selection: selection ? 'Reload' : undefined });
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            this.cmdManager.executeCommand('workbench.action.reloadWindow').then(noop);
        }
    }
}
