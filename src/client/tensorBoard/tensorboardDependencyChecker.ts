// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri, ViewColumn } from 'vscode';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { IPythonExecutionFactory } from '../common/process/types';
import {
    IInstaller,
    IPersistentState,
    IPersistentStateFactory,
    IConfigurationService,
    IDisposable,
} from '../common/types';
import { IMultiStepInputFactory } from '../common/utils/multiStepInput';
import { IInterpreterService } from '../interpreter/contracts';
import { TensorBoardSession } from './tensorBoardSession';
import { disposeAll } from '../common/utils/resourceLifecycle';
import { PREFERRED_VIEWGROUP } from './tensorBoardSessionProvider';

@injectable()
export class TensorboardDependencyChecker {
    private preferredViewGroupMemento: IPersistentState<ViewColumn>;

    constructor(
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IPythonExecutionFactory) private readonly pythonExecFactory: IPythonExecutionFactory,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
        @inject(IMultiStepInputFactory) private readonly multiStepFactory: IMultiStepInputFactory,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    ) {
        this.preferredViewGroupMemento = this.stateFactory.createGlobalPersistentState<ViewColumn>(
            PREFERRED_VIEWGROUP,
            ViewColumn.Active,
        );
    }

    public async ensureDependenciesAreInstalled(resource?: Uri): Promise<boolean> {
        const disposables: IDisposable[] = [];
        const newSession = new TensorBoardSession(
            this.installer,
            this.interpreterService,
            this.workspaceService,
            this.pythonExecFactory,
            this.commandManager,
            disposables,
            this.applicationShell,
            this.preferredViewGroupMemento,
            this.multiStepFactory,
            this.configurationService,
        );
        const result = await newSession.ensurePrerequisitesAreInstalled(resource);
        disposeAll(disposables);
        return result;
    }
}
