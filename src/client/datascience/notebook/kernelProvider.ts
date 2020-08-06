// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
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
import { KernelSelection } from '../jupyter/kernels/types';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { INotebook, INotebookProvider } from '../types';
import { getNotebookMetadata, isJupyterNotebook, updateKernelInNotebookMetadata } from './helpers/helpers';
import { NotebookKernel } from './notebookKernel';
import { INotebookContentProvider, INotebookExecutionService } from './types';
@injectable()
export class VSCodeKernelPickerProvider implements NotebookKernelProvider {
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
        @inject(INotebookStorageProvider) private readonly storageProvider: INotebookStorageProvider,
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
        document: NotebookDocument,
        _webview: NotebookCommunication,
        token: CancellationToken
    ): Promise<void> {
        await Promise.race([
            kernel.validate(document.uri),
            createPromiseFromCancellation({ cancelAction: 'resolve', token, defaultValue: void 0 })
        ]);
    }
    public async provideKernels(document: NotebookDocument, token: CancellationToken): Promise<NotebookKernel[]> {
        const [preferredKernel, kernels] = await Promise.all([
            this.kernelSelector.getKernelForLocalConnection(
                document.uri,
                'raw',
                undefined,
                getNotebookMetadata(document),
                true,
                token
            ),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'raw', undefined, token)
        ]);
        if (token.isCancellationRequested) {
            return [];
        }
        function isPreferredKernel(item: KernelSelection) {
            if (!preferredKernel.interpreter && !preferredKernel.kernelModel && !preferredKernel.kernelSpec) {
                return false;
            }
            if (
                preferredKernel.interpreter &&
                item.interpreter &&
                preferredKernel.interpreter.path === item.interpreter.path
            ) {
                return true;
            }
            if (
                preferredKernel.kernelSpec &&
                item.kernelSpec &&
                JSON.stringify(preferredKernel.kernelSpec) === JSON.stringify(item.kernelSpec)
            ) {
                return true;
            }
            if (
                preferredKernel.kernelModel &&
                item.kernelModel &&
                JSON.stringify(preferredKernel.kernelModel) === JSON.stringify(item.kernelModel)
            ) {
                return true;
            }
            return false;
        }

        return kernels.map((kernel) => {
            return new NotebookKernel(
                kernel.label,
                kernel.description || kernel.detail || '',
                kernel.selection,
                isPreferredKernel(kernel.selection),
                this.execution,
                this.kernelSelector
            );
        });
    }
    private async onDidChangeActiveNotebookKernel(newKernelInfo: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        if (!newKernelInfo.kernel || !(newKernelInfo.kernel instanceof NotebookKernel)) {
            return;
        }

        const document = newKernelInfo.document;
        if (!isJupyterNotebook(document)) {
            return;
        }
        const selection = await newKernelInfo.kernel.validate(document.uri);
        const editor = this.notebook.notebookEditors.find((item) => item.document === document);
        if (!selection || !editor || editor.kernel !== newKernelInfo.kernel) {
            // Possibly closed or different kernel picked.
            return;
        }
        const model = await this.storageProvider.getOrCreateModel(document.uri);
        if (!model || !model.isTrusted) {
            // If a model is not trusted, we cannot change the kernel (this results in changes to notebook metadata).
            // This is because we store selected kernel in the notebook metadata.
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
                this.notebookKernelChangeHandled.add(notebook);
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
