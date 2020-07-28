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
import { IPyWidgetMessageDispatcherFactory } from '../ipywidgets/ipyWidgetMessageDispatcherFactory';
import { IIPyWidgetMessageDispatcher } from '../ipywidgets/types';
import { KernelSelectionProvider } from '../jupyter/kernels/kernelSelections';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { INotebookProvider } from '../types';
import { NotebookKernel } from './notebookKernel';
import { INotebookExecutionService } from './types';

@injectable()
export class KernelProvider implements NotebookKernelProvider {
    public get onDidChangeKernels(): Event<void> {
        return this._onDidChangeKernels.event;
    }
    private readonly _onDidChangeKernels = new EventEmitter<void>();

    private readonly dispatchers = new WeakMap<NotebookDocument, IIPyWidgetMessageDispatcher>();
    constructor(
        @inject(INotebookExecutionService) private readonly execution: INotebookExecutionService,
        @inject(KernelSelectionProvider) private readonly kernelSelectionProvider: KernelSelectionProvider,
        @inject(IVSCodeNotebook) private readonly notebook: IVSCodeNotebook,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IPyWidgetMessageDispatcherFactory)
        private readonly widgetMessageDispatcherFactory: IPyWidgetMessageDispatcherFactory,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider
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
        webview: NotebookCommunication,
        _token: CancellationToken
    ): Promise<void> {
        // if (process.env['1234']) {
        const model = await this.notebookStorage.get(document.uri, undefined, undefined, true);
        await this.notebookProvider.getOrCreateNotebook({
            identity: document.uri,
            resource: document.uri,
            metadata: model.metadata,
            disableUI: false,
            getOnly: false
        });

        const dispatcher = this.getIPyWidgetMessageDispatcher(document);
        // this.getIPyWidgetMessageDispatcher(document);
        // await dispatcher.initialize();
        dispatcher.postMessage((e) => {
            webview.postMessage({ type: '__IPYWIDGET_KERNEL_MESSAGE', payload: e });
        });
        // }
        // return Promise.race([
        //     kernel.hasBeenValidated.promise,
        //     createPromiseFromCancellation({ cancelAction: 'resolve', token, defaultValue: void 0 })
        // ]);
        // tslint:disable-next-line: no-console
        console.error('Kernel', kernel);
        webview.postMessage({ type: 'fromKernel', payload: 'DataFromKernel' });
        webview.onDidReceiveMessage((msg) => {
            if (msg && msg.type === '__IPYWIDGET_KERNEL_MESSAGE') {
                dispatcher.receiveMessage(msg.payload);
            }
            // tslint:disable-next-line: no-console
            console.error(`Message from UI kernel`, msg);
        });
        // Let UI kernel know we are ready.
        webview.postMessage({ type: '__IPYWIDGET_BACKEND_READY' });
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
    private getIPyWidgetMessageDispatcher(notebook: NotebookDocument) {
        if (!this.dispatchers.has(notebook)) {
            this.dispatchers.set(notebook, this.widgetMessageDispatcherFactory.create(notebook.uri));
        }
        return this.dispatchers.get(notebook)!;
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
