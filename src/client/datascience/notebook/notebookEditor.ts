// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event, EventEmitter, Uri, WebviewPanel } from 'vscode';
import { IVSCodeNotebook } from '../../common/application/types';
import { INotebook, INotebookEditor, INotebookModel } from '../types';

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
    constructor(public readonly model: INotebookModel, private readonly vscodeNotebook: IVSCodeNotebook) {
        model.onDidEdit(() => this._modified.fire(this));
    }
    public async load(_storage: INotebookModel, _webViewPanel?: WebviewPanel): Promise<void> {
        // Not used.
    }
    public runAllCells(): void {
        throw new Error('Method not implemented.');
    }
    public runSelectedCell(): void {
        throw new Error('Method not implemented.');
    }
    public addCellBelow(): void {
        throw new Error('Method not implemented.');
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
        throw new Error('Method not implemented.');
    }
    public redoCells(): void {
        throw new Error('Method not implemented.');
    }
    public removeAllCells(): void {
        throw new Error('Method not implemented.');
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
