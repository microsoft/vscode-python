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
import { IDisposableRegistry } from '../../common/types';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { NotebookKernel } from './notebookKernel';
import { INotebookExecutionService } from './types';

@injectable()
export class KernelProvider implements NotebookKernelProvider {
    public get onDidChangeKernels(): Event<void> {
        return this._onDidChangeKernels.event;
    }
    private readonly _onDidChangeKernels = new EventEmitter<void>();
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
        webview: NotebookCommunication,
        _token: CancellationToken
    ): Promise<void> {
        // return Promise.race([
        //     kernel.hasBeenValidated.promise,
        //     createPromiseFromCancellation({ cancelAction: 'resolve', token, defaultValue: void 0 })
        // ]);
        // tslint:disable-next-line: no-console
        console.error('Kernel', kernel);
        webview.postMessage({ type: 'fromKernel', payload: 'DataFromKernel' });
        webview.onDidReceiveMessage((msg) => {
            // tslint:disable-next-line: no-console
            console.error(`Message from kernel`, msg);
        });
        return;
    }
    public async provideKernels(document: NotebookDocument, token: CancellationToken): Promise<NotebookKernel[]> {
        const [rawKernels] = await Promise.all([
            // this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'jupyter', undefined, token),
            this.kernelSelectionProvider.getKernelSelectionsForLocalSession(document.uri, 'raw', undefined, token)
        ]);

        if (token.isCancellationRequested) {
            return [];
        }

        return rawKernels.map(
            (kernel) =>
                new NotebookKernel(kernel.label, kernel.description || '', false, kernel.selection, this.execution)
        );
        // )
        // .concat(
        //     jupyterKernels.map(
        //         (kernel) =>
        //             new NotebookKernel(
        //                 kernel.label,
        //                 kernel.description || '',
        //                 false,
        //                 kernel.selection,
        //                 this.execution
        //             )
        //     )
        // );
    }
    private async onDidChangeActiveNotebookKernel(e: {
        document: NotebookDocument;
        kernel: VSCNotebookKernel | undefined;
    }) {
        if (!e.kernel || !(e.kernel instanceof NotebookKernel)) {
            return;
        }

        // Validate the selection.
        // currentKernel.hasBeenValidated.resolve();
    }
}
