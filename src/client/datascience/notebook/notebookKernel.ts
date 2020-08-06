// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, EventEmitter, Uri } from 'vscode';
import type { NotebookCell, NotebookDocument, NotebookKernel as VSCNotebookKernel } from 'vscode-proposed';
import { createDeferredFromPromise, Deferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { KernelSpecInterpreter } from '../jupyter/kernels/kernelSelector';
import { IKernelSelectionUsage, KernelSelection } from '../jupyter/kernels/types';
import { INotebookExecutionService } from './types';

/**
 * Cancellation token source that can be cancelled multiple times.
 */
class MultiCancellationTokenSource {
    /**
     * The cancellation token of this source.
     */
    public readonly token: CancellationToken;
    private readonly eventEmitter = new EventEmitter<void>();
    constructor() {
        this.token = {
            isCancellationRequested: false,
            onCancellationRequested: this.eventEmitter.event.bind(this.eventEmitter)
        };
    }
    public cancel(): void {
        this.token.isCancellationRequested = true;
        this.eventEmitter.fire();
    }

    /**
     * Dispose object and free resources.
     */
    public dispose(): void {
        this.eventEmitter.dispose();
    }
}

/**
 * VSC will use this class to execute cells in a notebook.
 * This is where we hookup Jupyter with a Notebook in VSCode.
 */
export class NotebookKernel implements VSCNotebookKernel {
    get preloads(): Uri[] {
        return [];
    }
    private kernelValidated?: Deferred<KernelSpecInterpreter | {}>;
    private cellExecutions = new WeakMap<NotebookCell, MultiCancellationTokenSource>();
    private documentExecutions = new WeakMap<NotebookDocument, MultiCancellationTokenSource>();
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly selection: Readonly<KernelSelection>,
        public readonly isPreferred: boolean,
        private readonly execution: INotebookExecutionService,
        private readonly kernelSelectionUsage: IKernelSelectionUsage
    ) {}
    public executeCell(document: NotebookDocument, cell: NotebookCell) {
        if (this.cellExecutions.has(cell)) {
            return;
        }
        const source = new MultiCancellationTokenSource();
        this.cellExecutions.set(cell, source);
        this.validate(document.uri)
            .then(() =>
                this.execution.executeCell(document, cell, source.token).finally(() => {
                    if (this.cellExecutions.get(cell) === source) {
                        this.cellExecutions.delete(cell);
                    }
                })
            )
            .catch(noop);
    }
    public executeAllCells(document: NotebookDocument) {
        if (this.documentExecutions.has(document)) {
            return;
        }
        const source = new MultiCancellationTokenSource();
        this.documentExecutions.set(document, source);
        this.validate(document.uri)
            .then(() =>
                this.execution.executeAllCells(document, source.token).finally(() => {
                    if (this.documentExecutions.get(document) === source) {
                        this.documentExecutions.delete(document);
                    }
                })
            )
            .catch(noop);
    }
    public cancelCellExecution(_document: NotebookDocument, cell: NotebookCell) {
        this.cellExecutions.get(cell)?.cancel(); // NOSONAR
    }
    public cancelAllCellsExecution(document: NotebookDocument) {
        this.documentExecutions.get(document)?.cancel(); // NOSONAR
    }
    private async validate(uri: Uri): Promise<KernelSpecInterpreter | {}> {
        if (this.kernelValidated) {
            return this.kernelValidated.promise;
        }
        return (this.kernelValidated = createDeferredFromPromise<KernelSpecInterpreter | {}>(
            this.kernelSelectionUsage.useSelectedKernel(this.selection, uri, 'raw').catch(() => {
                // Possible this gets resolved later, hence clear cached promise.
                this.kernelValidated = undefined;
                // tslint:disable-next-line: no-any
            }) as any
        ));
    }
}
