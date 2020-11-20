// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import { traceError, traceInfo } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IInstaller } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { TensorBoardSession } from './tensorBoardSession';
import { ITensorBoardSessionProvider } from './types';

@injectable()
export class TensorBoardSessionProvider implements ITensorBoardSessionProvider {
    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem
    ) {}

    public async createNewSession(): Promise<void> {
        traceInfo('Starting new TensorBoard session...');
        try {
            const newSession = new TensorBoardSession(this.installer, this.interpreterService, this.workspaceService, this.fileSystem);
            await newSession.initialize();
        } catch (e) {
            traceError(`Encountered error while starting new TensorBoard session: ${e}`);
            await this.applicationShell.showErrorMessage(TensorBoard.failedToStartSessionError().format(e));
        }
    }
}
