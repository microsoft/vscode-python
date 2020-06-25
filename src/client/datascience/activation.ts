// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../activation/types';
import '../common/extensions';
import { IPythonDaemonExecutionService, IPythonExecutionFactory } from '../common/process/types';
import { IDisposableRegistry } from '../common/types';
import { debounceAsync, swallowExceptions } from '../common/utils/decorators';
import { sendTelemetryEvent, setSharedProperty } from '../telemetry';
import { JupyterDaemonModule, Telemetry } from './constants';
import { ActiveEditorContextService } from './context/activeEditorContext';
import { JupyterInterpreterService } from './jupyter/interpreter/jupyterInterpreterService';
import { KernelDaemonPreWarmer } from './kernel-launcher/kernelDaemonPreWarmer';
import { INotebookAndInteractiveWindowUsageTracker, INotebookEditor, INotebookEditorProvider } from './types';

@injectable()
export class Activation implements IExtensionSingleActivationService {
    private notebookOpened = false;
    constructor(
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(JupyterInterpreterService) private readonly jupyterInterpreterService: JupyterInterpreterService,
        @inject(IPythonExecutionFactory) private readonly factory: IPythonExecutionFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(ActiveEditorContextService) private readonly contextService: ActiveEditorContextService,
        @inject(KernelDaemonPreWarmer) private readonly daemonPoolPrewarmer: KernelDaemonPreWarmer,
        @inject(INotebookAndInteractiveWindowUsageTracker)
        private readonly tracker: INotebookAndInteractiveWindowUsageTracker
    ) {}
    public async activate(): Promise<void> {
        this.disposables.push(this.notebookEditorProvider.onDidOpenNotebookEditor(this.onDidOpenNotebookEditor, this));
        this.disposables.push(this.jupyterInterpreterService.onDidChangeInterpreter(this.onDidChangeInterpreter, this));
        this.contextService.activate().ignoreErrors();
        this.daemonPoolPrewarmer.activate(undefined).ignoreErrors();
        this.tracker.startTracking();
    }

    private onDidOpenNotebookEditor(e: INotebookEditor) {
        this.notebookOpened = true;
        this.PreWarmDaemonPool().ignoreErrors();
        setSharedProperty('ds_notebookeditor', e.type);
        sendTelemetryEvent(Telemetry.OpenNotebookAll);
        // Warm up our selected interpreter for the extension
        this.jupyterInterpreterService.setInitialInterpreter().ignoreErrors();
    }

    private onDidChangeInterpreter() {
        if (this.notebookOpened) {
            // Warm up our selected interpreter for the extension
            this.jupyterInterpreterService.setInitialInterpreter().ignoreErrors();
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
        await this.factory.createDaemon<IPythonDaemonExecutionService>({
            daemonModule: JupyterDaemonModule,
            pythonPath: interpreter.path
        });
    }
}
