// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { once } from 'lodash';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { Commands } from '../common/constants';
import { IPersistentState, IPersistentStateFactory } from '../common/types';
import { Common, TensorBoard } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger, TensorBoardPromptSelection } from './constants';

enum TensorBoardPromptStateKeys {
    ShowNativeTensorBoardPrompt = 'showNativeTensorBoardPrompt',
}

@injectable()
export class TensorBoardPrompt {
    private state: IPersistentState<boolean>;

    private enabled: boolean;

    private enabledInCurrentSession = true;

    private waitingForUserSelection = false;

    private sendTelemetryOnce = once((trigger) => {
        sendTelemetryEvent(EventName.TENSORBOARD_ENTRYPOINT_SHOWN, undefined, {
            entrypoint: TensorBoardEntrypoint.prompt,
            trigger,
        });
    });

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory,
    ) {
        this.state = this.persistentStateFactory.createWorkspacePersistentState<boolean>(
            TensorBoardPromptStateKeys.ShowNativeTensorBoardPrompt,
            true,
        );
        this.enabled = this.isPromptEnabled();
    }

    public async showNativeTensorBoardPrompt(trigger: TensorBoardEntrypointTrigger): Promise<void> {
        if (this.enabled && this.enabledInCurrentSession && !this.waitingForUserSelection) {
            const yes = Common.bannerLabelYes();
            const no = Common.bannerLabelNo();
            const doNotAskAgain = Common.doNotShowAgain();
            const options = [yes, no, doNotAskAgain];
            this.waitingForUserSelection = true;
            this.sendTelemetryOnce(trigger);
            const selection = await this.applicationShell.showInformationMessage(
                TensorBoard.nativeTensorBoardPrompt(),
                ...options,
            );
            this.waitingForUserSelection = false;
            this.enabledInCurrentSession = false;
            let telemetrySelection = TensorBoardPromptSelection.None;
            switch (selection) {
                case yes:
                    telemetrySelection = TensorBoardPromptSelection.Yes;
                    await this.commandManager.executeCommand(
                        Commands.LaunchTensorBoard,
                        TensorBoardEntrypoint.prompt,
                        trigger,
                    );
                    break;
                case doNotAskAgain:
                    telemetrySelection = TensorBoardPromptSelection.DoNotAskAgain;
                    await this.disablePrompt();
                    break;
                case no:
                    telemetrySelection = TensorBoardPromptSelection.No;
                    break;
                default:
                    break;
            }
            sendTelemetryEvent(EventName.TENSORBOARD_LAUNCH_PROMPT_SELECTION, undefined, {
                selection: telemetrySelection,
            });
        }
    }

    private isPromptEnabled(): boolean {
        return this.state.value;
    }

    private async disablePrompt() {
        await this.state.updateValue(false);
    }
}
