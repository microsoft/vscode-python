// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import { traceError, traceInfo } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IDisposableRegistry, IInstaller } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { TensorBoardSession } from './tensorBoardSession';

@injectable()
export class TensorBoardSessionProvider implements IExtensionSingleActivationService {
    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}

    public async activate() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.LaunchTensorBoard, () => this.createNewSession())
        );
        const contextKey = new ContextKey('python.isInNativeTensorBoardExperiment', this.commandManager);
        await contextKey.set(true);
    }

    private async createNewSession(): Promise<void> {
        traceInfo('Starting new TensorBoard session...');
        try {
            const newSession = new TensorBoardSession(
                this.installer,
                this.interpreterService,
                this.workspaceService,
                this.fileSystem
            );
            await newSession.initialize();
        } catch (e) {
            traceError(`Encountered error while starting new TensorBoard session: ${e}`);
            await this.applicationShell.showErrorMessage(TensorBoard.failedToStartSessionError().format(e));
        }
    }
}
