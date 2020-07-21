// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { ICommandManager } from '../../common/application/types';
import { IDisposable } from '../../common/types';
import { Commands } from '../constants';
import { KernelSelector, KernelSpecInterpreter } from '../jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { IInteractiveWindowProvider, INotebookEditorProvider, INotebookProvider } from '../types';

@injectable()
export class NotebookCommands implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(KernelSelector) private readonly kernelSelector: KernelSelector,
        @inject(KernelSwitcher) private readonly kernelSwitcher: KernelSwitcher
    ) {}
    public register() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.SwitchJupyterKernel, this.switchKernel, this),
            this.commandManager.registerCommand(Commands.SetJupyterKernel, this.setKernel, this)
        );
    }
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    private async switchKernel(
        identity: Uri | undefined,
        resource: Uri | undefined,
        currentKernelSpecName: string | undefined
    ) {
        if (!identity) {
            identity = this.notebookEditorProvider.activeEditor
                ? this.notebookEditorProvider.activeEditor.file
                : this.interactiveWindowProvider.activeWindow?.identity;
        }
        if (!resource) {
            resource = this.notebookEditorProvider.activeEditor
                ? this.notebookEditorProvider.activeEditor.file
                : this.interactiveWindowProvider.activeWindow?.owner;
        }
        if (!currentKernelSpecName) {
            currentKernelSpecName = this.notebookEditorProvider.activeEditor
                ? this.notebookEditorProvider.activeEditor.model.metadata?.kernelspec?.display_name ||
                  this.notebookEditorProvider.activeEditor.model.metadata?.kernelspec?.name
                : this.interactiveWindowProvider.activeWindow?.notebook?.getKernelSpec()?.display_name ||
                  this.interactiveWindowProvider.activeWindow?.notebook?.getKernelSpec()?.name;
        }
        if (identity) {
            // Make sure we have a connection or we can't get remote kernels.
            const connection = await this.notebookProvider.connect({ getOnly: false, disableUI: false });

            // Might also have

            // Select a new kernel using the connection information
            const kernel = await this.kernelSelector.selectJupyterKernel(
                identity,
                connection,
                connection?.type || this.notebookProvider.type,
                currentKernelSpecName
            );
            if (kernel && identity) {
                await this.setKernel(kernel, identity, resource);
            }
        }
    }

    private async setKernel(kernel: KernelSpecInterpreter, identity: Uri, resource: Uri | undefined) {
        const specOrModel = kernel?.kernelModel || kernel?.kernelSpec;
        if (kernel && specOrModel) {
            const notebook = await this.notebookProvider.getOrCreateNotebook({
                resource,
                identity,
                getOnly: true
            });

            // If we have a notebook, change its kernel now
            if (notebook) {
                return this.kernelSwitcher.switchKernelWithRetry(notebook, kernel);
            }
        }
    }
}
