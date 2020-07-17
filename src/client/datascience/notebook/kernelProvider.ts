// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import { TreeItem } from 'vscode';
import { EventEmitter } from 'vscode';
import type {
    NotebookCell,
    NotebookDocument,
    NotebookKernel as VSCNotebookKernel,
    NotebookKernelProvider,
    NotebookCommunication
} from 'vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { createPromiseFromCancellation } from '../../common/cancellation';
import { IDisposableRegistry } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { KernelSelection } from '../jupyter/kernels/types';
import { INotebookEditorProvider } from '../types';
import { INotebookExecutionService } from './types';

/**
 * VSC will use this class to execute cells in a notebook.
 * This is where we hookup Jupyter with a Notebook in VSCode.
 */
class NotebookKernel implements VSCNotebookKernel {
    get preloads(): Uri[] {
        return this._preloads;
    }
    public readonly hasBeenValidated = createDeferred<void>();
    private _preloads: Uri[] = [];
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly preferred: boolean,
        public readonly kernelInfo: Readonly<KernelSelection>,
        private readonly execution: INotebookExecutionService
    ) {}

    public async executeCell(document: NotebookDocument, cell: NotebookCell, token: CancellationToken): Promise<void> {
        return this.execution.executeCell(document, cell, token);
    }
    public async executeAllCells(document: NotebookDocument, token: CancellationToken): Promise<void> {
        return this.execution.executeAllCells(document, token);
    }
}

export class KernelProvider implements NotebookKernelProvider {
    public get onDidChangeKernels(): Event<void> {
        return this._onDidChangeKernels.event;
    }
    private readonly _onDidChangeKernels = new EventEmitter<void>();
    /**
     * This will need to be mapped by the document WeakMap<NotebookDocument, boolean>.
     * Waiting for changes from VSC (the event triggering changes to kernel will need to provide NotebookDocument + Kernel).
     */
    private readonly isValidatingSelectedKernel?: Promise<boolean>;
    constructor(
        @inject(INotebookExecutionService) private readonly execution: INotebookExecutionService,
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(IVSCodeNotebook) private readonly notebook: IVSCodeNotebook,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        this.kernelSelectionProvider.SelectionsChanged(() => this._onDidChangeKernels.fire(), this, disposables);
        this.notebook.onDidChangeActiveNotebookKernel(this.onDidChangeActiveNotebookKernel, this, disposables);
    }
    /**
     * Called before running code against a kernel. An initialization phase.
     * If the selected kernel is being validated, we can block here.
     */
    public async resolveKernel(
        kernel: NotebookKernel,
        _document: NotebookDocument,
        _webview: NotebookCommunication,
        token: CancellationToken
    ): Promise<void> {
        return Promise.race([
            kernel.hasBeenValidated.promise,
            createPromiseFromCancellation({ cancelAction: 'resolve', token, defaultValue: void 0 })
        ]);
    }
    public async provideKernels(document: NotebookDocument, token: CancellationToken): Promise<NotebookKernel[]> {
        const [jupyterKernels, rawKernels] = await Promise.all([
            // this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'jupyter', undefined, token),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'raw', undefined, token)
        ]);

        if (token.isCancellationRequested) {
            return [];
        }

        return rawKernels
            .map(
                (kernel) =>
                    new NotebookKernel(kernel.label, kernel.description || '', false, kernel.selection, this.execution)
            )
            .concat(
                jupyterKernels.map(
                    (kernel) =>
                        new NotebookKernel(
                            kernel.label,
                            kernel.description || '',
                            false,
                            kernel.selection,
                            this.execution
                        )
                )
            );
    }
    private async onDidChangeActiveNotebookKernel() {
        const currentKernel = this.notebook.activeNotebookKernel;
        if (!currentKernel || !(currentKernel instanceof NotebookKernel)) {
            return;
        }

        // Validate the selection.
        currentKernel.hasBeenValidated.resolve();
    }
}
