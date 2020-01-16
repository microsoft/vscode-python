// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../activation/types';
import '../common/extensions';
import { IPythonExecutionFactory } from '../common/process/types';
import { IDisposableRegistry } from '../common/types';
import { debounceAsync, swallowExceptions } from '../common/utils/decorators';
import { sendTelemetryEvent } from '../telemetry';
import { PythonDaemonModule, Telemetry } from './constants';
import { ActiveEditorContextService } from './context/activeEditorContext';
import { JupyterInterpreterService } from './jupyter/interpreter/jupyterInterpreterService';
import { INotebookEditor, INotebookEditorProvider } from './types';

@injectable()
export class Activation implements IExtensionSingleActivationService {
    private notebookOpened = false;
    constructor(
        @inject(INotebookEditorProvider) private readonly notebookProvider: INotebookEditorProvider,
        @inject(JupyterInterpreterService) private readonly jupyterInterpreterService: JupyterInterpreterService,
        @inject(IPythonExecutionFactory) private readonly factory: IPythonExecutionFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(ActiveEditorContextService) private readonly contextService: ActiveEditorContextService
    ) {}
    public async activate(): Promise<void> {
        this.disposables.push(this.notebookProvider.onDidOpenNotebookEditor(this.onDidOpenNotebookEditor, this));
        this.disposables.push(this.jupyterInterpreterService.onDidChangeInterpreter(this.onDidChangeInterpreter, this));
        await this.contextService.activate();
    }

    private onDidOpenNotebookEditor(_: INotebookEditor) {
        this.notebookOpened = true;
        this.PreWarmDaemonPool().ignoreErrors();
        sendTelemetryEvent(Telemetry.OpenNotebookAll);
    }

    private onDidChangeInterpreter() {
        if (this.notebookOpened) {
            this.PreWarmDaemonPool().ignoreErrors();
        }
    }

    @debounceAsync(500)
    @swallowExceptions('Failed to pre-warm daemon pool')
    private async PreWarmDaemonPool() {
        const interpreter = await this.jupyterInterpreterService.getSelectedInterpreter();
        if (!interpreter) {
            return;
        }
        await this.factory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path });
    }
}
