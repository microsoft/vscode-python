// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { Commands } from '../common/constants';
import { IDisposableRegistry, IPersistentState, IPersistentStateFactory } from '../common/types';
import { Common, TensorBoard } from '../common/utils/localize';
import { ITensorBoardImportTracker } from './types';

enum TensorBoardPromptStateKeys {
    ShowNativeTensorBoardPrompt = 'showNativeTensorBoardPrompt'
}

@injectable()
export class TensorBoardPrompt {
    private state: IPersistentState<boolean>;
    private enabled: Promise<boolean> | undefined;
    private enabledInCurrentSession: boolean = true;
    private waitingForUserSelection: boolean = false;

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(ITensorBoardImportTracker) private importTracker: ITensorBoardImportTracker,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IPersistentStateFactory) private persistentStateFactory: IPersistentStateFactory
    ) {
        this.state = this.persistentStateFactory.createWorkspacePersistentState<boolean>(
            TensorBoardPromptStateKeys.ShowNativeTensorBoardPrompt,
            true
        );
        this.enabled = this.isPromptEnabled();
        this.importTracker.onDidImportTensorBoard(this.showNativeTensorBoardPrompt, this, this.disposableRegistry);
    }

    public async showNativeTensorBoardPrompt() {
        if ((await this.enabled) && this.enabledInCurrentSession && !this.waitingForUserSelection) {
            const yes = Common.bannerLabelYes();
            const no = Common.bannerLabelNo();
            const doNotAskAgain = Common.doNotShowAgain();
            const options = [yes, no, doNotAskAgain];
            this.waitingForUserSelection = true;
            const selection = await this.applicationShell.showInformationMessage(
                TensorBoard.nativeTensorBoardPrompt(),
                ...options
            );
            this.waitingForUserSelection = false;
            this.enabledInCurrentSession = false;
            switch (selection) {
                case yes:
                    await this.commandManager.executeCommand(Commands.LaunchTensorBoard);
                    break;
                case doNotAskAgain:
                    await this.disablePrompt();
                    break;
                default:
                    break;
            }
        }
    }

    private async isPromptEnabled() {
        return this.state.value;
    }

    private async disablePrompt() {
        await this.state.updateValue(false);
    }
}
