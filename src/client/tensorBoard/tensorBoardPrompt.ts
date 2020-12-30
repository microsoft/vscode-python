// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { Commands } from '../common/constants';
import { NativeTensorBoard } from '../common/experiments/groups';
import { IExperimentService, IPersistentState, IPersistentStateFactory } from '../common/types';
import { Common, TensorBoard } from '../common/utils/localize';
import { callOnce, sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntryPoint, TensorBoardLaunchSource, TensorBoardPromptSelection } from './constants';

enum TensorBoardPromptStateKeys {
    ShowNativeTensorBoardPrompt = 'showNativeTensorBoardPrompt',
}

@injectable()
export class TensorBoardPrompt {
    private state: IPersistentState<boolean>;

    private enabled: boolean;

    private inExperiment: Promise<boolean>;

    private enabledInCurrentSession = true;

    private waitingForUserSelection = false;

    private sendTelemetryOnce = callOnce(sendTelemetryEvent, EventName.TENSORBOARD_ENTRYPOINT_SHOWN, undefined, {
        entrypoint: TensorBoardEntryPoint.prompt,
    });

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {
        this.state = this.persistentStateFactory.createWorkspacePersistentState<boolean>(
            TensorBoardPromptStateKeys.ShowNativeTensorBoardPrompt,
            true,
        );
        this.enabled = this.isPromptEnabled();
        this.inExperiment = this.isInExperiment();
    }

    public async showNativeTensorBoardPrompt(source: TensorBoardLaunchSource): Promise<void> {
        if (
            (await this.inExperiment) &&
            this.enabled &&
            this.enabledInCurrentSession &&
            !this.waitingForUserSelection
        ) {
            const yes = Common.bannerLabelYes();
            const no = Common.bannerLabelNo();
            const doNotAskAgain = Common.doNotShowAgain();
            const options = [yes, no, doNotAskAgain];
            this.waitingForUserSelection = true;
            this.sendTelemetryOnce();
            const selection = await this.applicationShell.showInformationMessage(
                TensorBoard.nativeTensorBoardPrompt(),
                ...options,
            );
            this.waitingForUserSelection = false;
            this.enabledInCurrentSession = false;
            let telemetrySelection = TensorBoardPromptSelection.Yes;
            switch (selection) {
                case yes:
                    await this.commandManager.executeCommand(Commands.LaunchTensorBoard, source);
                    break;
                case doNotAskAgain:
                    telemetrySelection = TensorBoardPromptSelection.No;
                    await this.disablePrompt();
                    break;
                case no:
                    telemetrySelection = TensorBoardPromptSelection.DoNotAskAgain;
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

    private async isInExperiment(): Promise<boolean> {
        return this.experimentService.inExperiment(NativeTensorBoard.experiment);
    }

    private async disablePrompt() {
        await this.state.updateValue(false);
    }
}
