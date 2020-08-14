// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fastDeepEqual from 'fast-deep-equal';
import { inject, injectable } from 'inversify';
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import {
    NotebookCell,
    NotebookDocument,
    NotebookKernel as VSCNotebookKernel,
    NotebookKernelProvider
} from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { kernelConnectionMetadataHasKernelSpec } from '../jupyter/kernels/helpers';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { IKernelProvider, KernelConnectionMetadata } from '../jupyter/kernels/types';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { INotebook, INotebookProvider } from '../types';
import { getNotebookMetadata, isJupyterNotebook, updateKernelInNotebookMetadata } from './helpers/helpers';
import { INotebookContentProvider } from './types';

class VSCodeNotebookKernelMetadata implements VSCNotebookKernel {
    get preloads(): Uri[] {
        return [];
    }
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly selection: Readonly<KernelConnectionMetadata>,
        public readonly isPreferred: boolean,
        private readonly kernelProvider: IKernelProvider
    ) {}
    public executeCell(_: NotebookDocument, cell: NotebookCell) {
        this.kernelProvider.get(cell.notebook.uri)?.executeCell(cell); // NOSONAR
    }
    public executeAllCells(document: NotebookDocument) {
        this.kernelProvider.get(document.uri)?.executeAllCells(document); // NOSONAR
    }
    public cancelCellExecution(_: NotebookDocument, cell: NotebookCell) {
        this.kernelProvider.get(cell.notebook.uri)?.interrupt(); // NOSONAR
    }
    public cancelAllCellsExecution(document: NotebookDocument) {
        this.kernelProvider.get(document.uri)?.interrupt(); // NOSONAR
    }
}

@injectable()
export class VSCodeKernelPickerProvider implements NotebookKernelProvider {
    public get onDidChangeKernels(): Event<void> {
        return this._onDidChangeKernels.event;
    }
    private readonly _onDidChangeKernels = new EventEmitter<void>();
    private notebookKernelChangeHandled = new WeakSet<INotebook>();
    constructor(
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(KernelSelector) private readonly kernelSelector: KernelSelector,
        @inject(IKernelProvider) private readonly kernelProvider: IKernelProvider,
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
    public async provideKernels(
        document: NotebookDocument,
        token: CancellationToken
    ): Promise<VSCodeNotebookKernelMetadata[]> {
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
        function isPreferredKernel(item: KernelConnectionMetadata) {
            if (!preferredKernel) {
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
                kernelConnectionMetadataHasKernelSpec(preferredKernel) &&
                preferredKernel.kernelSpec &&
                kernelConnectionMetadataHasKernelSpec(item) &&
                item.kernelSpec &&
                fastDeepEqual(preferredKernel.kernelSpec, item.kernelSpec)
            ) {
                return true;
            }
            // tslint:disable-next-line: no-suspicious-comment
            // TODO for Remote kernels.
            // if (
            //     kernelConnectionMetadataHasKernelModel(preferredKernel) &&
            //     preferredKernel.kernelModel &&
            //     kernelConnectionMetadataHasKernelModel(item) &&
            //     item.kernelModel &&
            //     fastDeepEqual(preferredKernel.kernelModel, item.kernelModel)
            // ) {
            //     return true;
            // }
            return false;
        }

        return kernels.map((kernel) => {
            return new VSCodeNotebookKernelMetadata(
                kernel.label,
                kernel.description || kernel.detail || '',
                kernel.selection,
                isPreferredKernel(kernel.selection),
                this.kernelProvider
            );
        });
    }
    private async onDidChangeActiveNotebookKernel(newKernelInfo: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        if (!newKernelInfo.kernel || !(newKernelInfo.kernel instanceof VSCodeNotebookKernelMetadata)) {
            return;
        }

        const document = newKernelInfo.document;
        if (!isJupyterNotebook(document)) {
            return;
        }
        const selection = newKernelInfo.kernel.selection;

        const model = this.storageProvider.get(document.uri);
        if (!model || !model.isTrusted) {
            // If a model is not trusted, we cannot change the kernel (this results in changes to notebook metadata).
            // This is because we store selected kernel in the notebook metadata.
            return;
        }

        // Check what the existing kernel is.
        const existingKernel = this.kernelProvider.get(document.uri);
        if (existingKernel && fastDeepEqual(existingKernel.metadata, newKernelInfo.kernel.selection)) {
            return;
        }

        // Make this the new kernel (calling this method will associate the new kernel with this Uri).
        this.kernelProvider.getOrCreate(document.uri, { metadata: newKernelInfo.kernel.selection });

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
                        updateKernelInNotebookMetadata(document, e, this.notebookContentProvider);
                    },
                    this,
                    this.disposables
                );
            }
            this.kernelSwitcher.switchKernelWithRetry(notebook, selection).catch(noop);
        } else {
            updateKernelInNotebookMetadata(document, selection, this.notebookContentProvider);
        }
    }
}
