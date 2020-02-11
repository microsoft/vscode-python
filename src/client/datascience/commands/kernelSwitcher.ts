// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ICommandManager } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IDisposable } from '../../common/types';
import { Commands } from '../constants';
import { KernelSpecInterpreter } from '../jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { IInteractiveWindowProvider, INotebook, INotebookEditorProvider } from '../types';

@injectable()
export class KernelSwitcherCommand implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(KernelSwitcher) private kernelSwitcher: KernelSwitcher,
        @inject(INotebookEditorProvider) private notebookProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider
    ) {}
    public register() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.SwitchJupyterKernel, this.switchKernel, this)
        );
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private async switchKernel(notebook?: INotebook): Promise<KernelSpecInterpreter | undefined> {
        // If notebook isn't know, then user invoked this command from command palette or similar.
        // We need to identify the current notebook (active native editor or interactive window).
        if (!notebook) {
            notebook =
                this.notebookProvider.activeEditor?.notebook ?? this.interactiveWindowProvider.getActive()?.notebook;
        }
        if (!notebook) {
            traceError('No active notebook');
            return;
        }
        return this.kernelSwitcher.switchKernel(notebook);
    }
}
