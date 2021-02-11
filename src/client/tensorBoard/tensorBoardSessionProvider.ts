// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';
import { traceError, traceInfo } from '../common/logger';
import { IProcessServiceFactory } from '../common/process/types';
import { IDisposableRegistry, IInstaller } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from './constants';
import { TensorBoardSession } from './tensorBoardSession';

@injectable()
export class TensorBoardSessionProvider implements IExtensionSingleActivationService {
    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
    ) {}

    public async activate(): Promise<void> {
        this.disposables.push(
            this.commandManager.registerCommand(
                Commands.LaunchTensorBoard,
                (
                    entrypoint: TensorBoardEntrypoint = TensorBoardEntrypoint.palette,
                    trigger: TensorBoardEntrypointTrigger = TensorBoardEntrypointTrigger.palette,
                ) => {
                    sendTelemetryEvent(EventName.TENSORBOARD_SESSION_LAUNCH, undefined, {
                        trigger,
                        entrypoint,
                    });
                    return this.createNewSession();
                },
            ),
        );
    }

    private async createNewSession(): Promise<TensorBoardSession | undefined> {
        traceInfo('Starting new TensorBoard session...');
        try {
            const newSession = new TensorBoardSession(
                this.installer,
                this.interpreterService,
                this.workspaceService,
                this.processServiceFactory,
                this.commandManager,
                this.disposables,
                this.applicationShell,
            );
            await newSession.initialize();
            return newSession;
        } catch (e) {
            traceError(`Encountered error while starting new TensorBoard session: ${e}`);
            await this.applicationShell.showErrorMessage(TensorBoard.failedToStartSessionError().format(e));
        }
        return undefined;
    }
}
