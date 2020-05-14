// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugAdapterTracker, DebugAdapterTrackerFactory, DebugSession, ProviderResult } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IApplicationShell } from '../../../common/application/types';
import { IBrowserService } from '../../../common/types';
import { Common, OutdatedDebugger } from '../../../common/utils/localize';
import { IPromptShowState } from './types';

// This situation occurs when user connects to old containers or server where
// the debugger they had installed was ptvsd. We should show a prompt to ask them to update.
class OutdatedDebuggerPrompt implements DebugAdapterTracker {
    constructor(
        private promptCheck: IPromptShowState,
        private appShell: IApplicationShell,
        private browserService: IBrowserService
    ) {}

    public onDidSendMessage(message: DebugProtocol.ProtocolMessage) {
        if (this.promptCheck.shouldShowPrompt() && this.isPtvsd(message)) {
            const prompts = [Common.moreInfo()];
            this.appShell
                .showInformationMessage(OutdatedDebugger.outdatedDebuggerMessage(), ...prompts)
                .then((selection) => {
                    if (selection === prompts[0]) {
                        this.browserService.launch('https://aka.ms/migrateToDebugpy');
                    }
                });
        }
    }

    private isPtvsd(message: DebugProtocol.ProtocolMessage) {
        if (message.type === 'event') {
            const eventMessage = message as DebugProtocol.Event;
            if (eventMessage.event === 'output') {
                const outputMessage = eventMessage as DebugProtocol.OutputEvent;
                if (outputMessage.body.category === 'telemetry') {
                    // debugpy sends telemetry as both ptvsd and debugpy. This was done to help with
                    // transition from ptvsd to debugpy while analyzing usage telemetry.
                    if (
                        outputMessage.body.output === 'ptvsd' &&
                        !outputMessage.body.data.packageVersion.startsWith('1')
                    ) {
                        this.promptCheck.setShowPrompt(false);
                        return true;
                    }
                    if (outputMessage.body.output === 'debugpy') {
                        this.promptCheck.setShowPrompt(false);
                    }
                }
            }
        }
        return false;
    }
}

class OutdatedDebuggerPromptState implements IPromptShowState {
    private shouldShow: boolean = true;
    public shouldShowPrompt(): boolean {
        return this.shouldShow;
    }
    public setShowPrompt(show: boolean) {
        this.shouldShow = show;
    }
}

@injectable()
export class OutdatedDebuggerPromptFactory implements DebugAdapterTrackerFactory {
    private readonly promptCheck: OutdatedDebuggerPromptState;
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IBrowserService) private browserService: IBrowserService
    ) {
        this.promptCheck = new OutdatedDebuggerPromptState();
    }
    public createDebugAdapterTracker(_session: DebugSession): ProviderResult<DebugAdapterTracker> {
        return new OutdatedDebuggerPrompt(this.promptCheck, this.appShell, this.browserService);
    }
}
