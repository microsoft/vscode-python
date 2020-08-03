// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject } from 'inversify';
import { CancellationToken, Event, EventEmitter } from 'vscode';
import {
    NotebookCommunication,
    NotebookDocument,
    NotebookKernel as VSCNotebookKernel,
    NotebookKernelProvider
} from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { createPromiseFromCancellation } from '../../common/cancellation';
import { IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { INotebook, INotebookProvider } from '../types';
import { updateKernelInNotebookMetadata } from './helpers/helpers';
import { NotebookKernel } from './notebookKernel';
import { INotebookContentProvider, INotebookExecutionService } from './types';
export class KernelProvider implements NotebookKernelProvider {
    public get onDidChangeKernels(): Event<void> {
        return this._onDidChangeKernels.event;
    }
    private readonly _onDidChangeKernels = new EventEmitter<void>();
    private notebookKernelChangeHandled = new WeakSet<INotebook>();
    constructor(
        @inject(INotebookExecutionService) private readonly execution: INotebookExecutionService,
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(KernelSelector) private readonly kernelSelector: KernelSelector,
        @inject(IVSCodeNotebook) private readonly notebook: IVSCodeNotebook,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(KernelSwitcher) private readonly kernelSwitcher: KernelSwitcher,
        @inject(INotebookContentProvider) private readonly notebookContentProvider: INotebookContentProvider,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
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
            kernel.hasBeenValidated.then(() => void 0),
            createPromiseFromCancellation({ cancelAction: 'resolve', token, defaultValue: void 0 })
        ]);
    }
    public async provideKernels(document: NotebookDocument, token: CancellationToken): Promise<NotebookKernel[]> {
        const rawKernels = await this.kernelSelectionProvider.getKernelSelectionsForLocalSession(
            document.uri,
            'raw',
            undefined,
            token
        );

        if (token.isCancellationRequested) {
            return [];
        }

        return rawKernels.map(
            (kernel) =>
                new NotebookKernel(
                    kernel.label,
                    kernel.description || '',
                    kernel.selection,
                    this.execution,
                    this.kernelSelector
                )
        );
    }
    private async onDidChangeActiveNotebookKernel(newKernelInfo: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        if (!newKernelInfo.kernel || !(newKernelInfo.kernel instanceof NotebookKernel)) {
            return;
        }

        const document = newKernelInfo.document;
        const selection = await newKernelInfo.kernel.validate(document.uri);
        const editor = this.notebook.notebookEditors.find((item) => item.document === document);
        if (!selection || !editor || editor.kernel !== newKernelInfo.kernel) {
            // Possibly closed or different kernel picked.
            return;
        }

        // Change kernel and update metadata.
        const notebook = await this.notebookProvider.getOrCreateNotebook({
            resource: document.uri,
            identity: document.uri,
            getOnly: true
        });

        // If we have a notebook, change its kernel now
        if (notebook) {
            if (!this.notebookKernelChangeHandled.has(notebook)) {
                notebook.onKernelChanged(
                    (e) => {
                        if (notebook.disposed) {
                            return;
                        }
                        updateKernelInNotebookMetadata(
                            document,
                            e,
                            notebook.getMatchingInterpreter(),
                            this.notebookContentProvider
                        );
                    },
                    this,
                    this.disposables
                );
            }
            this.kernelSwitcher.switchKernelWithRetry(notebook, selection).catch(noop);
        } else {
            updateKernelInNotebookMetadata(
                document,
                selection.kernelModel || selection.kernelSpec,
                selection.interpreter,
                this.notebookContentProvider
            );
        }
    }
}
