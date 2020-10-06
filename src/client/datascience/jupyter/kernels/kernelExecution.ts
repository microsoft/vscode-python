// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { NotebookCell, NotebookCellRunState, NotebookDocument } from 'vscode';
import { IApplicationShell, ICommandManager, IVSCodeNotebook } from '../../../common/application/types';
import { IDisposable } from '../../../common/types';
import { noop } from '../../../common/utils/misc';
import { captureTelemetry } from '../../../telemetry';
import { Commands, Telemetry, VSCodeNativeTelemetry } from '../../constants';
import { MultiCancellationTokenSource } from '../../notebook/helpers/multiCancellationToken';
import { IDataScienceErrorHandler, INotebook, INotebookEditorProvider } from '../../types';
import { CellExecution, CellExecutionFactory } from './cellExecution';
import type { IKernel, IKernelProvider, IKernelSelectionUsage, KernelConnectionMetadata } from './types';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * Separate class that deals just with kernel execution.
 * Else the `Kernel` class gets very big.
 */
export class KernelExecution implements IDisposable {
    public notebook?: INotebook;

    private readonly cellExecutions = new WeakMap<NotebookCell, CellExecution>();

    private readonly documentExecutions = new WeakMap<NotebookDocument, MultiCancellationTokenSource>();

    private readonly kernelValidated = new WeakMap<NotebookDocument, { kernel: IKernel; promise: Promise<void> }>();

    private readonly executionFactory: CellExecutionFactory;
    private readonly disposables: IDisposable[] = [];
    constructor(
        private readonly kernelProvider: IKernelProvider,
        private readonly commandManager: ICommandManager,
        errorHandler: IDataScienceErrorHandler,
        editorProvider: INotebookEditorProvider,
        readonly kernelSelectionUsage: IKernelSelectionUsage,
        readonly appShell: IApplicationShell,
        readonly vscNotebook: IVSCodeNotebook,
        readonly metadata: Readonly<KernelConnectionMetadata>
    ) {
        this.executionFactory = new CellExecutionFactory(errorHandler, editorProvider, appShell, vscNotebook);
    }

    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    public async executeCell(cell: NotebookCell): Promise<void> {
        if (!this.notebook) {
            throw new Error('executeObservable cannot be called if kernel has not been started!');
        }
        // Cannot execute empty cells.
        if (this.cellExecutions.has(cell) || cell.document.getText().trim().length === 0) {
            return;
        }
        const cellExecution = this.executionFactory.create(cell);
        this.cellExecutions.set(cell, cellExecution);

        const kernel = this.getKernel(cell.notebook);

        try {
            await this.executeIndividualCell(kernel, cellExecution);
        } finally {
            this.cellExecutions.delete(cell);
        }
    }

    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, true)
    @captureTelemetry(VSCodeNativeTelemetry.RunAllCells, undefined, true)
    public async executeAllCells(document: NotebookDocument): Promise<void> {
        if (!this.notebook) {
            throw new Error('executeObservable cannot be called if kernel has not been started!');
        }
        if (this.documentExecutions.has(document)) {
            return;
        }
        const editor = this.vscNotebook.notebookEditors.find((item) => item.document === document);
        if (!editor) {
            return;
        }
        const cancelTokenSource = new MultiCancellationTokenSource();
        this.documentExecutions.set(document, cancelTokenSource);
        const kernel = this.getKernel(document);

        await editor.edit((edit) =>
            edit.replaceMetadata({ ...document.metadata, runState: vscodeNotebookEnums.NotebookRunState.Running })
        );
        const codeCellsToExecute = document.cells
            .filter((cell) => cell.cellKind === vscodeNotebookEnums.CellKind.Code)
            .filter((cell) => cell.document.getText().trim().length > 0)
            .map((cell) => {
                const cellExecution = this.executionFactory.create(cell);
                this.cellExecutions.set(cellExecution.cell, cellExecution);
                return cellExecution;
            });
        cancelTokenSource.token.onCancellationRequested(
            () => codeCellsToExecute.forEach((cell) => cell.cancel()),
            this,
            this.disposables
        );

        try {
            for (const cellToExecute of codeCellsToExecute) {
                const result = this.executeIndividualCell(kernel, cellToExecute);
                result.finally(() => this.cellExecutions.delete(cellToExecute.cell)).catch(noop);
                const executionResult = await result;
                // If a cell has failed or execution cancelled, the get out.
                if (
                    cancelTokenSource.token.isCancellationRequested ||
                    executionResult === vscodeNotebookEnums.NotebookCellRunState.Error
                ) {
                    await Promise.all(codeCellsToExecute.map((cell) => cell.cancel())); // Cancel pending cells.
                    break;
                }
            }
        } finally {
            await Promise.all(codeCellsToExecute.map((cell) => cell.cancel())); // Cancel pending cells.
            this.documentExecutions.delete(document);
            await editor.edit((edit) =>
                edit.replaceMetadata({ ...document.metadata, runState: vscodeNotebookEnums.NotebookRunState.Idle })
            );
        }
    }

    public async cancelCell(cell: NotebookCell) {
        if (this.cellExecutions.get(cell)) {
            await this.cellExecutions.get(cell)!.cancel();
        }
    }

    public cancelAllCells(document: NotebookDocument): void {
        if (this.documentExecutions.get(document)) {
            this.documentExecutions.get(document)!.cancel();
        }
        document.cells.forEach((cell) => this.cancelCell(cell));
    }
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    private async getKernel(document: NotebookDocument): Promise<IKernel> {
        await this.validateKernel(document);
        let kernel = this.kernelProvider.get(document.uri);
        if (!kernel) {
            kernel = this.kernelProvider.getOrCreate(document.uri, { metadata: this.metadata });
        }
        if (!kernel) {
            throw new Error('Unable to create a Kernel to run cell');
        }
        await kernel.start();
        return kernel;
    }

    private async executeIndividualCell(
        kernelPromise: Promise<IKernel>,
        cellExecution: CellExecution
    ): Promise<NotebookCellRunState | undefined> {
        if (!this.notebook) {
            throw new Error('No notebook object');
        }

        cellExecution.token.onCancellationRequested(
            // Interrupt kernel only if we need to cancel a cell execution.
            () => this.commandManager.executeCommand(Commands.NotebookEditorInterruptKernel).then(noop, noop),
            this,
            this.disposables
        );

        // Start execution
        await cellExecution.start(kernelPromise, this.notebook);

        // The result promise will resolve when complete.
        return cellExecution.result;
    }

    private async validateKernel(document: NotebookDocument): Promise<void> {
        const kernel = this.kernelProvider.get(document.uri);
        if (!kernel) {
            return;
        }
        if (!this.kernelValidated.get(document)) {
            const promise = new Promise<void>((resolve) =>
                this.kernelSelectionUsage
                    .useSelectedKernel(kernel?.metadata, document.uri, 'raw')
                    .finally(() => {
                        // If there's an exception, then we cannot use the kernel and a message would have been displayed.
                        // We don't want to cache such a promise, as its possible the user later installs the dependencies.
                        if (this.kernelValidated.get(document)?.kernel === kernel) {
                            this.kernelValidated.delete(document);
                        }
                    })
                    .finally(resolve)
                    .catch(noop)
            );

            this.kernelValidated.set(document, { kernel, promise });
        }
        await this.kernelValidated.get(document)!.promise;
    }
}
