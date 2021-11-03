// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ViewColumn } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import { TorchProfiler } from '../common/experiments/groups';
import { IProcessServiceFactory } from '../common/process/types';
import {
    IDisposableRegistry,
    IExperimentService,
    IInstaller,
    IPersistentState,
    IPersistentStateFactory,
} from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { IMultiStepInputFactory } from '../common/utils/multiStepInput';
import { IInterpreterService } from '../interpreter/contracts';
import { traceError, traceInfo } from '../logging';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from './constants';
import { TensorBoardSession } from './tensorBoardSession';

const PREFERRED_VIEWGROUP = 'PythonTensorBoardWebviewPreferredViewGroup';

@injectable()
export class TensorBoardSessionProvider implements IExtensionSingleActivationService {
    private knownSessions: TensorBoardSession[] = [];

    private preferredViewGroupMemento: IPersistentState<ViewColumn>;

    private hasActiveTensorBoardSessionContext: ContextKey;

    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
    ) {
        this.preferredViewGroupMemento = this.stateFactory.createGlobalPersistentState<ViewColumn>(
            PREFERRED_VIEWGROUP,
            ViewColumn.Active,
        );
        this.hasActiveTensorBoardSessionContext = new ContextKey(
            'python.hasActiveTensorBoardSession',
            this.commandManager,
        );
    }

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
            this.commandManager.registerCommand(Commands.RefreshTensorBoard, () =>
                this.knownSessions.map((w) => w.refresh()),
            ),
        );
    }

    private async updateTensorBoardSessionContext() {
        let hasActiveTensorBoardSession = false;
        this.knownSessions.forEach((viewer) => {
            if (viewer.active) {
                hasActiveTensorBoardSession = true;
            }
        });
        await this.hasActiveTensorBoardSessionContext.set(hasActiveTensorBoardSession);
    }

    private async didDisposeSession(session: TensorBoardSession) {
        this.knownSessions = this.knownSessions.filter((s) => s !== session);
        this.updateTensorBoardSessionContext();
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
                await this.experimentService.inExperiment(TorchProfiler.experiment),
                this.preferredViewGroupMemento,
                this.multiStepFactory,
            );
            newSession.onDidChangeViewState(() => this.updateTensorBoardSessionContext(), this, this.disposables);
            newSession.onDidDispose((e) => this.didDisposeSession(e), this, this.disposables);
            this.knownSessions.push(newSession);
            await newSession.initialize();
            return newSession;
        } catch (e) {
            traceError(`Encountered error while starting new TensorBoard session: ${e}`);
            await this.applicationShell.showErrorMessage(TensorBoard.failedToStartSessionError().format(e));
        }
        return undefined;
    }
}
