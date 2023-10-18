// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, l10n, ViewColumn } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';
import { ContextKey } from '../common/contextKey';
import { IPythonExecutionFactory } from '../common/process/types';
import {
    IDisposableRegistry,
    IInstaller,
    IPersistentState,
    IPersistentStateFactory,
    IConfigurationService,
    IDisposable,
} from '../common/types';
import { IMultiStepInputFactory } from '../common/utils/multiStepInput';
import { IInterpreterService } from '../interpreter/contracts';
import { traceError, traceVerbose } from '../logging';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from './constants';
import { TensorBoardSession } from './tensorBoardSession';
import { TensorboardExperiment } from './tensorboarExperiment';

export const PREFERRED_VIEWGROUP = 'PythonTensorBoardWebviewPreferredViewGroup';

@injectable()
export class TensorBoardSessionProvider implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private knownSessions: TensorBoardSession[] = [];

    private preferredViewGroupMemento: IPersistentState<ViewColumn>;

    private hasActiveTensorBoardSessionContext: ContextKey;

    private readonly disposables: IDisposable[] = [];

    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IPythonExecutionFactory) private readonly pythonExecFactory: IPythonExecutionFactory,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(TensorboardExperiment) private readonly experiment: TensorboardExperiment,
    ) {
        disposables.push(this);
        this.preferredViewGroupMemento = this.stateFactory.createGlobalPersistentState<ViewColumn>(
            PREFERRED_VIEWGROUP,
            ViewColumn.Active,
        );
        this.hasActiveTensorBoardSessionContext = new ContextKey(
            'python.hasActiveTensorBoardSession',
            this.commandManager,
        );
    }

    public dispose(): void {
        Disposable.from(...this.disposables).dispose();
    }

    public async activate(): Promise<void> {
        if (TensorboardExperiment.isTensorboardExtensionInstalled) {
            return;
        }
        this.experiment.disposeOnInstallingTensorboard(this);

        this.disposables.push(
            this.commandManager.registerCommand(
                Commands.LaunchTensorBoard,
                (
                    entrypoint: TensorBoardEntrypoint = TensorBoardEntrypoint.palette,
                    trigger: TensorBoardEntrypointTrigger = TensorBoardEntrypointTrigger.palette,
                ): void => {
                    sendTelemetryEvent(EventName.TENSORBOARD_SESSION_LAUNCH, undefined, {
                        trigger,
                        entrypoint,
                    });
                    if (this.experiment.recommendAndUseNewExtension() === 'continueWithPythonExtension') {
                        void this.createNewSession();
                    }
                },
            ),
            this.commandManager.registerCommand(Commands.RefreshTensorBoard, () =>
                this.experiment.recommendAndUseNewExtension() === 'continueWithPythonExtension'
                    ? this.knownSessions.map((w) => w.refresh())
                    : undefined,
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
        traceVerbose('Starting new TensorBoard session...');
        try {
            const newSession = new TensorBoardSession(
                this.installer,
                this.interpreterService,
                this.workspaceService,
                this.pythonExecFactory,
                this.commandManager,
                this.disposables,
                this.applicationShell,
                this.preferredViewGroupMemento,
                this.multiStepFactory,
                this.configurationService,
            );
            newSession.onDidChangeViewState(() => this.updateTensorBoardSessionContext(), this, this.disposables);
            newSession.onDidDispose((e) => this.didDisposeSession(e), this, this.disposables);
            this.knownSessions.push(newSession);
            await newSession.initialize();
            return newSession;
        } catch (e) {
            traceError(`Encountered error while starting new TensorBoard session: ${e}`);
            await this.applicationShell.showErrorMessage(
                l10n.t(
                    'We failed to start a TensorBoard session due to the following error: {0}',
                    (e as Error).message,
                ),
            );
        }
        return undefined;
    }
}
