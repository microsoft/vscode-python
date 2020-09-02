// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
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
import { IInterpreterService } from '../../interpreter/contracts';
import { areKernelConnectionsEqual } from '../jupyter/kernels/helpers';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { getKernelConnectionId, IKernelProvider, KernelConnectionMetadata } from '../jupyter/kernels/types';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { INotebook, INotebookProvider } from '../types';
import { getNotebookMetadata, isJupyterNotebook, updateKernelInNotebookMetadata } from './helpers/helpers';
import { INotebookContentProvider } from './types';

class VSCodeNotebookKernelMetadata implements VSCNotebookKernel {
    get preloads(): Uri[] {
        return [];
    }
    get id() {
        return getKernelConnectionId(this.selection);
    }
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly selection: Readonly<KernelConnectionMetadata>,
        public readonly isPreferred: boolean,
        private readonly kernelProvider: IKernelProvider
    ) {}
    public executeCell(_: NotebookDocument, cell: NotebookCell) {
        this.kernelProvider.getOrCreate(cell.notebook.uri, { metadata: this.selection })?.executeCell(cell); // NOSONAR
    }
    public executeAllCells(document: NotebookDocument) {
        this.kernelProvider.getOrCreate(document.uri, { metadata: this.selection })?.executeAllCells(document); // NOSONAR
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
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService
    ) {
        this.kernelSelectionProvider.SelectionsChanged(() => this._onDidChangeKernels.fire(), this, disposables);
        this.notebook.onDidChangeActiveNotebookKernel(this.onDidChangeActiveNotebookKernel, this, disposables);
    }
    public async provideKernels(
        document: NotebookDocument,
        token: CancellationToken
    ): Promise<VSCodeNotebookKernelMetadata[]> {
        const [preferredKernel, kernels, activeInterpreter] = await Promise.all([
            this.getPreferredKernel(document, token),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'raw', undefined, token),
            this.interpreterService.getActiveInterpreter(document.uri)
        ]);
        if (token.isCancellationRequested) {
            return [];
        }

        // Default the interpreter to the local interpreter (if none is provided).
        const withInterpreter = kernels.map((kernel) => {
            const selection = cloneDeep(kernel.selection); // Always clone, so we can make changes to this.
            selection.interpreter = selection.interpreter || activeInterpreter;
            return { ...kernel, selection };
        });

        // Turn this into our preferred list.
        const mapped = withInterpreter.map((kernel) => {
            return new VSCodeNotebookKernelMetadata(
                kernel.label,
                kernel.description || kernel.detail || '',
                kernel.selection,
                areKernelConnectionsEqual(kernel.selection, preferredKernel),
                this.kernelProvider
            );
        });

        // If no preferred kernel set but we have a language, use that to set preferred instead.
        if (!mapped.find((v) => v.isPreferred) && document.cells.length) {
            const languages = document.cells.map((c) => c.language);
            // Find the first that matches on language
            const languageMatch = kernels.findIndex((k) =>
                languages.find((l) => l === k.selection.kernelSpec?.language)
            );
            if (languageMatch >= 0) {
                const kernel = kernels[languageMatch];
                mapped.splice(
                    languageMatch,
                    1,
                    new VSCodeNotebookKernelMetadata(
                        kernel.label,
                        kernel.description || kernel.detail || '',
                        kernel.selection,
                        true,
                        this.kernelProvider
                    )
                );
            }
        }

        return mapped;
    }
    private async getPreferredKernel(document: NotebookDocument, token: CancellationToken) {
        // If we already have a kernel selected, then return that.
        const editor =
            this.notebook.notebookEditors.find((e) => e.document === document) ||
            (this.notebook.activeNotebookEditor?.document === document
                ? this.notebook.activeNotebookEditor
                : undefined);
        if (editor && editor.kernel && editor.kernel instanceof VSCodeNotebookKernelMetadata) {
            return editor.kernel.selection;
        }
        return this.kernelSelector.getPreferredKernelForLocalConnection(
            document.uri,
            'raw',
            undefined,
            getNotebookMetadata(document),
            true,
            token,
            true
        );
    }
    private async onDidChangeActiveNotebookKernel({
        document,
        kernel
    }: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        // We're only interested in our Jupyter Notebooks & our kernels.
        if (!kernel || !(kernel instanceof VSCodeNotebookKernelMetadata) || !isJupyterNotebook(document)) {
            return;
        }
        const selectedKernelConnectionMetadata = kernel.selection;

        const model = this.storageProvider.get(document.uri);
        if (!model || !model.isTrusted) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: https://github.com/microsoft/vscode-python/issues/13476
            // If a model is not trusted, we cannot change the kernel (this results in changes to notebook metadata).
            // This is because we store selected kernel in the notebook metadata.
            return;
        }

        const existingKernel = this.kernelProvider.get(document.uri);
        if (existingKernel && areKernelConnectionsEqual(existingKernel.metadata, selectedKernelConnectionMetadata)) {
            return;
        }

        // Make this the new kernel (calling this method will associate the new kernel with this Uri).
        // Calling `getOrCreate` will ensure a kernel is created and it is mapped to the Uri provided.
        // This way other parts of extension have access to this kernel immediately after event is handled.
        this.kernelProvider.getOrCreate(document.uri, {
            metadata: selectedKernelConnectionMetadata
        });

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
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: https://github.com/microsoft/vscode-python/issues/13514
            // We need to handle these exceptions in `siwthKernelWithRetry`.
            // We shouldn't handle them here, as we're already handling some errors in the `siwthKernelWithRetry` method.
            // Adding comment here, so we have context for the requirement.
            this.kernelSwitcher.switchKernelWithRetry(notebook, selectedKernelConnectionMetadata).catch(noop);
        } else {
            updateKernelInNotebookMetadata(document, selectedKernelConnectionMetadata, this.notebookContentProvider);
        }
    }
}
