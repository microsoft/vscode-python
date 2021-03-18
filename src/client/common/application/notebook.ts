// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { DocumentSelector, Event, EventEmitter } from 'vscode';
import type { notebook, NotebookConcatTextDocument, NotebookDocument } from 'vscode-proposed';
import { UseProposedApi } from '../constants';
import { IApplicationEnvironment, IVSCodeNotebook } from './types';

@injectable()
export class VSCodeNotebook implements IVSCodeNotebook {
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
    private get notebook() {
        if (!this._notebook) {
            this._notebook = require('vscode').notebook;
        }
        return this._notebook!;
    }
    private _notebook?: typeof notebook;
    private readonly canUseNotebookApi?: boolean;
    constructor(
        @inject(UseProposedApi) private readonly useProposedApi: boolean,
        @inject(IApplicationEnvironment) readonly env: IApplicationEnvironment,
    ) {
        if (this.useProposedApi) {
            this.canUseNotebookApi = true;
        }
    }
    public createConcatTextDocument(doc: NotebookDocument, selector?: DocumentSelector): NotebookConcatTextDocument {
        if (this.useProposedApi) {
            return this.notebook.createConcatTextDocument(doc, selector) as any; // Types of Position are different for some reason. Fix this later.
        }
        throw new Error('createConcatDocument not supported');
    }
}
