// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../activation/types';
import '../common/extensions';
import { IPythonExecutionFactory } from '../common/process/types';
import { IDisposableRegistry } from '../common/types';
import { debounceAsync, swallowExceptions } from '../common/utils/decorators';
import { IInterpreterService } from '../interpreter/contracts';
import { sendTelemetryEvent } from '../telemetry';
import { PythonDaemonModule, Telemetry } from './constants';
import { INotebookEditor, INotebookEditorProvider } from './types';

@injectable()
export class Activation implements IExtensionSingleActivationService {
    private notebookOpened = false;
    constructor(
        @inject(INotebookEditorProvider) private readonly notebookProvider: INotebookEditorProvider,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IPythonExecutionFactory) private readonly factory: IPythonExecutionFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async activate(): Promise<void> {
        this.disposables.push(this.notebookProvider.onDidOpenNotebookEditor(this.onDidOpenNotebookEditor, this));
        this.disposables.push(this.interpreterService.onDidChangeInterpreter(this.onDidChangeInterpreter, this));
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
    @swallowExceptions('Failed to create daemon when notebook opened')
    private async PreWarmDaemonPool() {
        const activeInterpreter = await this.interpreterService.getActiveInterpreter(undefined);
        if (!activeInterpreter) {
            return;
        }
        await this.factory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: activeInterpreter.path });
    }
}
