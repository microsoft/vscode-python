// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CellKind, ConfigurationTarget, Event, EventEmitter, Uri, WebviewPanel } from 'vscode';
import type { NotebookDocument } from 'vscode-proposed';
import { IApplicationShell, ICommandManager, IVSCodeNotebook } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { JupyterKernelPromiseFailedError } from '../jupyter/kernels/jupyterKernelPromiseFailedError';
import { IKernel, IKernelProvider } from '../jupyter/kernels/types';
import {
    INotebook,
    INotebookEditor,
    INotebookModel,
    INotebookProvider,
    InterruptResult,
    IStatusProvider
} from '../types';
import { getDefaultCodeLanguage } from './helpers/helpers';

export class NotebookEditor implements INotebookEditor {
    public readonly type = 'native';
    public get onDidChangeViewState(): Event<void> {
        return this.changedViewState.event;
    }
    public get closed(): Event<INotebookEditor> {
        return this._closed.event;
    }
    public get modified(): Event<INotebookEditor> {
        return this._modified.event;
    }

    public get executed(): Event<INotebookEditor> {
        return this._executed.event;
    }
    public get saved(): Event<INotebookEditor> {
        return this._saved.event;
    }
    public get isUntitled(): boolean {
        return this.model.isUntitled;
    }
    public get isDirty(): boolean {
        return this.document.isDirty;
    }
    public get file(): Uri {
        return this.model.file;
    }
    public get visible(): boolean {
        return !this.model.isDisposed;
    }
    public get active(): boolean {
        return this.vscodeNotebook.activeNotebookEditor?.document.uri.toString() === this.model.file.toString();
    }
    public get onExecutedCode(): Event<string> {
        return this.executedCode.event;
    }
    public notebook?: INotebook | undefined;

    private changedViewState = new EventEmitter<void>();
    private _closed = new EventEmitter<INotebookEditor>();
    private _saved = new EventEmitter<INotebookEditor>();
    private _executed = new EventEmitter<INotebookEditor>();
    private _modified = new EventEmitter<INotebookEditor>();
    private executedCode = new EventEmitter<string>();
    private restartingKernel?: boolean;
    constructor(
        public readonly model: INotebookModel,
        public readonly document: NotebookDocument,
        private readonly vscodeNotebook: IVSCodeNotebook,
        private readonly commandManager: ICommandManager,
        private readonly notebookProvider: INotebookProvider,
        private readonly kernelProvider: IKernelProvider,
        private readonly statusProvider: IStatusProvider,
        private readonly applicationShell: IApplicationShell,
        private readonly configurationService: IConfigurationService,
        disposables: IDisposableRegistry
    ) {
        disposables.push(model.onDidEdit(() => this._modified.fire(this)));
        disposables.push(
            model.changed((e) => {
                if (e.kind === 'save') {
                    this._saved.fire(this);
                }
            })
        );
        disposables.push(model.onDidDispose(this._closed.fire.bind(this._closed, this)));
    }
    public async load(_storage: INotebookModel, _webViewPanel?: WebviewPanel): Promise<void> {
        // Not used.
    }
    public runAllCells(): void {
        this.commandManager.executeCommand('notebook.execute').then(noop, noop);
    }
    public runSelectedCell(): void {
        this.commandManager.executeCommand('notebook.cell.execute').then(noop, noop);
    }
    public addCellBelow(): void {
        this.commandManager.executeCommand('notebook.cell.insertCodeCellBelow').then(noop, noop);
    }
    public show(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public startProgress(): void {
        throw new Error('Method not implemented.');
    }
    public stopProgress(): void {
        throw new Error('Method not implemented.');
    }
    public undoCells(): void {
        this.commandManager.executeCommand('notebook.undo').then(noop, noop);
    }
    public redoCells(): void {
        this.commandManager.executeCommand('notebook.redo').then(noop, noop);
    }
    public async hasCell(id: string): Promise<boolean> {
        return this.model.cells.find((c) => c.id === id) ? true : false;
    }
    public removeAllCells(): void {
        if (!this.vscodeNotebook.activeNotebookEditor) {
            return;
        }
        const defaultLanguage = getDefaultCodeLanguage(this.model);
        this.vscodeNotebook.activeNotebookEditor.edit((editor) => {
            const totalLength = this.document.cells.length;
            editor.insert(this.document.cells.length, '', defaultLanguage, CellKind.Code, [], undefined);
            for (let i = totalLength - 1; i >= 0; i = i - 1) {
                editor.delete(i);
            }
        });
    }
    public notifyExecution(code: string) {
        this._executed.fire(this);
        this.executedCode.fire(code);
    }
    public async interruptKernel(): Promise<void> {
        if (this.restartingKernel) {
            return;
        }
        const kernel = this.kernelProvider.get(this.file);
        if (!kernel || this.restartingKernel) {
            return;
        }
        const status = this.statusProvider.set(DataScience.interruptKernelStatus(), true, undefined, undefined);

        try {
            const result = await kernel.interrupt();
            status.dispose();

            // We timed out, ask the user if they want to restart instead.
            if (result === InterruptResult.TimedOut) {
                const message = DataScience.restartKernelAfterInterruptMessage();
                const yes = DataScience.restartKernelMessageYes();
                const no = DataScience.restartKernelMessageNo();
                const v = await this.applicationShell.showInformationMessage(message, yes, no);
                if (v === yes) {
                    this.restartingKernel = false;
                    await this.restartKernel();
                }
            }
        } catch (err) {
            status.dispose();
            traceError(err);
            this.applicationShell.showErrorMessage(err);
        }
    }

    public async restartKernel(): Promise<void> {
        sendTelemetryEvent(Telemetry.RestartKernelCommand);
        if (this.restartingKernel) {
            return;
        }
        const kernel = this.kernelProvider.get(this.file);

        if (kernel && !this.restartingKernel) {
            if (await this.shouldAskForRestart()) {
                // Ask the user if they want us to restart or not.
                const message = DataScience.restartKernelMessage();
                const yes = DataScience.restartKernelMessageYes();
                const dontAskAgain = DataScience.restartKernelMessageDontAskAgain();
                const no = DataScience.restartKernelMessageNo();

                const response = await this.applicationShell.showInformationMessage(message, yes, dontAskAgain, no);
                if (response === dontAskAgain) {
                    await this.disableAskForRestart();
                    await this.restartKernelInternal(kernel);
                } else if (response === yes) {
                    await this.restartKernelInternal(kernel);
                }
            } else {
                await this.restartKernelInternal(kernel);
            }
        }
    }
    public dispose() {
        this._closed.fire(this);
    }
    private async restartKernelInternal(kernel: IKernel): Promise<void> {
        this.restartingKernel = true;

        // Set our status
        const status = this.statusProvider.set(DataScience.restartingKernelStatus(), true, undefined, undefined);

        // Disable running cells.
        const [cellRunnable, runnable] = [this.document.metadata.cellRunnable, this.document.metadata.runnable];
        try {
            this.document.metadata.cellRunnable = false;
            this.document.metadata.runnable = false;
            await kernel.restart();
        } catch (exc) {
            // If we get a kernel promise failure, then restarting timed out. Just shutdown and restart the entire server.
            // Note, this code might not be necessary, as such an error is thrown only when interrupting a kernel times out.
            if (exc instanceof JupyterKernelPromiseFailedError && kernel) {
                // Old approach (INotebook is not exposed in IKernel, and INotebook will eventually go away).
                const notebook = await this.notebookProvider.getOrCreateNotebook({
                    resource: this.file,
                    identity: this.file,
                    getOnly: true
                });
                if (notebook) {
                    await notebook.dispose();
                }
                await this.notebookProvider.connect({ getOnly: false, disableUI: false });
            } else {
                // Show the error message
                this.applicationShell.showErrorMessage(exc);
                traceError(exc);
            }
        } finally {
            status.dispose();
            this.restartingKernel = false;
            // Restore previous state.
            [this.document.metadata.cellRunnable, this.document.metadata.runnable] = [cellRunnable, runnable];
        }
    }
    private async shouldAskForRestart(): Promise<boolean> {
        const settings = this.configurationService.getSettings(this.file);
        return settings && settings.datascience && settings.datascience.askForKernelRestart === true;
    }

    private async disableAskForRestart(): Promise<void> {
        const settings = this.configurationService.getSettings(this.file);
        if (settings && settings.datascience) {
            settings.datascience.askForKernelRestart = false;
            this.configurationService
                .updateSetting('dataScience.askForKernelRestart', false, undefined, ConfigurationTarget.Global)
                .ignoreErrors();
        }
    }
}
