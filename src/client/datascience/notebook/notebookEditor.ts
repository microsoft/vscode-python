// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CellKind, Event, EventEmitter, NotebookDocument, Uri, WebviewPanel } from 'vscode';
import { CancellationTokenSource } from 'vscode-jsonrpc';
import { ICommandManager, IVSCodeNotebook } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { noop } from '../../common/utils/misc';
import { INotebook, INotebookEditor, INotebookModel } from '../types';
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
    constructor(
        public readonly model: INotebookModel,
        private readonly document: NotebookDocument,
        private readonly vscodeNotebook: IVSCodeNotebook,
        private readonly executionService: INotebookExecutionService,
        private readonly commandManager: ICommandManager
    ) {
        model.onDidEdit(() => this._modified.fire(this));
    }
    public async load(_storage: INotebookModel, _webViewPanel?: WebviewPanel): Promise<void> {
        // Not used.
    }
    public runAllCells(): void {
        this.executionService.executeAllCells(this.document, new CancellationTokenSource().token).catch(noop);
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
        this.vscodeNotebook.activeNotebookEditor?.edit((editor) => {
            const totalLength = this.document.cells.length;
            editor.insert(this.document.cells.length, '', PYTHON_LANGUAGE, CellKind.Code, [], undefined);
            for (let i = totalLength - 1; i >= 0; i = i - 1) {
                editor.delete(i);
            }
        });
    }
    public interruptKernel(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public restartKernel(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public dispose() {
        // Not required.
    }
}
