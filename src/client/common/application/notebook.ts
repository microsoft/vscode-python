// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter } from 'vscode';
import type {
    notebook,
    NotebookCellsChangeEvent as VSCNotebookCellsChangeEvent,
    NotebookContentProvider,
    NotebookDocument,
    NotebookDocumentFilter,
    NotebookEditor,
    NotebookKernel,
    NotebookKernelProvider,
    NotebookOutputRenderer,
    NotebookOutputSelector
} from 'vscode-proposed';
import { UseProposedApi } from '../constants';
import { IDisposableRegistry } from '../types';
import {
    IApplicationEnvironment,
    IVSCodeNotebook,
    NotebookCellLanguageChangeEvent,
    NotebookCellOutputsChangeEvent,
    NotebookCellsChangeEvent
} from './types';

@injectable()
export class VSCodeNotebook implements IVSCodeNotebook {
    public get onDidChangeActiveNotebookKernel(): Event<{
        document: NotebookDocument;
        kernel: NotebookKernel | undefined;
    }> {
        return this.canUseNotebookApi
            ? this.notebook.onDidChangeActiveNotebookKernel
            : new EventEmitter<{
                  document: NotebookDocument;
                  kernel: NotebookKernel | undefined;
              }>().event;
    }
    public get onDidChangeActiveNotebookEditor(): Event<NotebookEditor | undefined> {
        return this.canUseNotebookApi
            ? this.notebook.onDidChangeActiveNotebookEditor
            : new EventEmitter<NotebookEditor | undefined>().event;
    }
    public get onDidOpenNotebookDocument(): Event<NotebookDocument> {
        return this.canUseNotebookApi
            ? this.notebook.onDidOpenNotebookDocument
            : new EventEmitter<NotebookDocument>().event;
    }
    public get onDidCloseNotebookDocument(): Event<NotebookDocument> {
        return this.canUseNotebookApi
            ? this.notebook.onDidCloseNotebookDocument
            : new EventEmitter<NotebookDocument>().event;
    }
    public get notebookDocuments(): ReadonlyArray<NotebookDocument> {
        return this.canUseNotebookApi ? this.notebook.notebookDocuments : [];
    }
    public get notebookEditors() {
        return this.canUseNotebookApi ? this.notebook.visibleNotebookEditors : [];
    }
    public get onDidChangeNotebookDocument(): Event<
        NotebookCellsChangeEvent | NotebookCellOutputsChangeEvent | NotebookCellLanguageChangeEvent
    > {
        return this.canUseNotebookApi
            ? this._onDidChangeNotebookDocument.event
            : new EventEmitter<
                  NotebookCellsChangeEvent | NotebookCellOutputsChangeEvent | NotebookCellLanguageChangeEvent
              >().event;
    }
    public get activeNotebookEditor(): NotebookEditor | undefined {
        if (!this.useProposedApi) {
            return;
        }
        return this.notebook.activeNotebookEditor;
    }
    private get notebook() {
        if (!this._notebook) {
            // tslint:disable-next-line: no-require-imports
            this._notebook = require('vscode').notebook;
        }
        return this._notebook!;
    }
    private readonly _onDidChangeNotebookDocument = new EventEmitter<
        NotebookCellsChangeEvent | NotebookCellOutputsChangeEvent | NotebookCellLanguageChangeEvent
    >();
    private addedEventHandlers?: boolean;
    private _notebook?: typeof notebook;
    private readonly canUseNotebookApi?: boolean;
    private readonly handledCellChanges = new WeakSet<VSCNotebookCellsChangeEvent>();
    constructor(
        @inject(UseProposedApi) private readonly useProposedApi: boolean,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IApplicationEnvironment) readonly env: IApplicationEnvironment
    ) {
        if (this.useProposedApi && this.env.channel === 'insiders') {
            this.addEventHandlers();
            this.canUseNotebookApi = true;
        }
    }
    public registerNotebookContentProvider(notebookType: string, provider: NotebookContentProvider): Disposable {
        return this.notebook.registerNotebookContentProvider(notebookType, provider);
    }
    public registerNotebookKernelProvider(
        selector: NotebookDocumentFilter,
        provider: NotebookKernelProvider
    ): Disposable {
        return this.notebook.registerNotebookKernelProvider(selector, provider);
    }
    public registerNotebookOutputRenderer(
        id: string,
        outputSelector: NotebookOutputSelector,
        renderer: NotebookOutputRenderer
    ): Disposable {
        return this.notebook.registerNotebookOutputRenderer(id, outputSelector, renderer);
    }
    private addEventHandlers() {
        if (this.addedEventHandlers) {
            return;
        }
        this.addedEventHandlers = true;
        this.disposables.push(
            ...[
                this.notebook.onDidChangeCellLanguage((e) =>
                    this._onDidChangeNotebookDocument.fire({ ...e, type: 'changeCellLanguage' })
                ),
                this.notebook.onDidChangeCellOutputs((e) =>
                    this._onDidChangeNotebookDocument.fire({ ...e, type: 'changeCellOutputs' })
                ),
                this.notebook.onDidChangeNotebookCells((e) => {
                    if (this.handledCellChanges.has(e)) {
                        return;
                    }
                    this.handledCellChanges.add(e);
                    this._onDidChangeNotebookDocument.fire({ ...e, type: 'changeCells' });
                })
            ]
        );
    }
}
