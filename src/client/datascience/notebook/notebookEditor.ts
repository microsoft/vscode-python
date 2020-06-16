// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CellKind, ConfigurationTarget, Event, EventEmitter, Uri, WebviewPanel } from 'vscode';
import type { NotebookDocument } from 'vscode-proposed';
import { IApplicationShell, ICommandManager, IVSCodeNotebook } from '../../common/application/types';
import { IConfigurationService } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { traceError } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';
import { Telemetry } from '../constants';
import { JupyterKernelPromiseFailedError } from '../jupyter/kernels/jupyterKernelPromiseFailedError';
import {
    INotebook,
    INotebookEditor,
    INotebookModel,
    INotebookProvider,
    InterruptResult,
    IStatusProvider
} from '../types';
import { getDefaultCodeLanguage } from './helpers/helpers';
import { INotebookExecutionService } from './types';

export class NotebookEditor implements INotebookEditor {
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
        return this.model.isDirty;
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
        private readonly executionService: INotebookExecutionService,
        private readonly commandManager: ICommandManager,
        private readonly notebookProvider: INotebookProvider,
        private readonly statusProvider: IStatusProvider,
        private readonly applicationShell: IApplicationShell,
        private readonly configurationService: IConfigurationService
    ) {
        model.onDidEdit(() => this._modified.fire(this));
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
    public async interruptKernel(): Promise<void> {
        this.executionService.cancelPendingExecutions(this.document);

        if (this.restartingKernel) {
            return;
        }
        const notebook = await this.notebookProvider.getOrCreateNotebook({
            resource: this.file,
            identity: this.file,
            getOnly: true
        });
        if (!notebook || this.restartingKernel) {
            return;
        }
        this.restartingKernel = true;

        const status = this.statusProvider.set(DataScience.interruptKernelStatus(), true, undefined, undefined);

        try {
            const interruptTimeout = this.configurationService.getSettings(this.file).datascience
                .jupyterInterruptTimeout;
            const result = await notebook.interruptKernel(interruptTimeout);
            status.dispose();

            // We timed out, ask the user if they want to restart instead.
            if (result === InterruptResult.TimedOut) {
                const message = DataScience.restartKernelAfterInterruptMessage();
                const yes = DataScience.restartKernelMessageYes();
                const no = DataScience.restartKernelMessageNo();
                const v = await this.applicationShell.showInformationMessage(message, yes, no);
                if (v === yes) {
                    await this.restartKernel();
                }
            }
        } catch (err) {
            status.dispose();
            traceError(err);
            this.applicationShell.showErrorMessage(err);
        } finally {
            this.restartingKernel = false;
        }
    }

    public async restartKernel(internal: boolean = false): Promise<void> {
        this.executionService.cancelPendingExecutions(this.document);

        // Only log this if it's user requested restart
        if (!internal) {
            sendTelemetryEvent(Telemetry.RestartKernelCommand);
        }
        if (this.restartingKernel) {
            return;
        }
        const notebook = await this.notebookProvider.getOrCreateNotebook({
            resource: this.file,
            identity: this.file,
            getOnly: true
        });

        if (notebook && !this.restartingKernel) {
            this.restartingKernel = true;

            try {
                if (await this.shouldAskForRestart()) {
                    // Ask the user if they want us to restart or not.
                    const message = DataScience.restartKernelMessage();
                    const yes = DataScience.restartKernelMessageYes();
                    const dontAskAgain = DataScience.restartKernelMessageDontAskAgain();
                    const no = DataScience.restartKernelMessageNo();

                    const v = await this.applicationShell.showInformationMessage(message, yes, dontAskAgain, no);
                    if (v === dontAskAgain) {
                        await this.disableAskForRestart();
                        await this.restartKernelInternal(notebook);
                    } else if (v === yes) {
                        await this.restartKernelInternal(notebook);
                    }
                } else {
                    await this.restartKernelInternal(notebook);
                }
            } finally {
                this.restartingKernel = false;
            }
        }
    }
    public dispose() {
        this._closed.fire(this);
    }
    private async restartKernelInternal(notebook: INotebook): Promise<void> {
        this.restartingKernel = true;

        // Set our status
        const status = this.statusProvider.set(DataScience.restartingKernelStatus(), true, undefined, undefined);

        try {
            await notebook.restartKernel(
                this.configurationService.getSettings(this.file).datascience.jupyterInterruptTimeout
            );

            // // Compute if dark or not.
            // const knownDark = await this.isDark();

            // // Before we run any cells, update the dark setting
            // await notebook.setMatplotLibStyle(knownDark);
        } catch (exc) {
            // If we get a kernel promise failure, then restarting timed out. Just shutdown and restart the entire server
            if (exc instanceof JupyterKernelPromiseFailedError && notebook) {
                await notebook.dispose();
                await this.notebookProvider.connect({ getOnly: false, disableUI: false });
            } else {
                // Show the error message
                this.applicationShell.showErrorMessage(exc);
                traceError(exc);
            }
        } finally {
            status.dispose();
            this.restartingKernel = false;
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
