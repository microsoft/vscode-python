// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { TextDocument } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import '../common/extensions';
import { IPythonExecutionFactory } from '../common/process/types';
import { IDisposableRegistry } from '../common/types';
import { debounceAsync, swallowExceptions } from '../common/utils/decorators';
import { IInterpreterService } from '../interpreter/contracts';
import { PythonDaemonModule } from './constants';

@injectable()
export class Activation implements IExtensionSingleActivationService {
    private notebookOpened = false;
    constructor(
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IPythonExecutionFactory) private readonly factory: IPythonExecutionFactory,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async activate(): Promise<void> {
        this.disposables.push(this.documentManager.onDidOpenTextDocument(this.onDidOpenTextDocument, this));
        this.disposables.push(this.interpreterService.onDidChangeInterpreter(this.onDidChangeInterpreter, this));
    }

    private onDidOpenTextDocument(e: TextDocument) {
        if (e.fileName.toLowerCase().endsWith('.ipynb')) {
            this.notebookOpened = true;
            this.PreWarmDaemonPool().ignoreErrors();
        }
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
