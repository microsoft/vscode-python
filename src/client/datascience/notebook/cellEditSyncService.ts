// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { TextDocument, TextDocumentChangeEvent } from 'vscode';
import type { NotebookCell, NotebookDocument } from '../../../../typings/vscode-proposed';
import { splitMultilineString } from '../../../datascience-ui/common';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDocumentManager, IVSCodeNotebook } from '../../common/application/types';
import { NativeNotebook } from '../../common/experiments/groups';
import { IDisposable, IDisposableRegistry, IExperimentsManager } from '../../common/types';
import { isNotebookCell } from '../../common/utils/misc';
import { traceError } from '../../logging';
import { INotebookEditorProvider, INotebookModel } from '../types';

@injectable()
export class CellEditSyncService implements IExtensionSingleActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    private mappedDocuments = new WeakMap<TextDocument, { cellId: string; model: INotebookModel }>();
    constructor(
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IExperimentsManager) private readonly experiment: IExperimentsManager
    ) {
        disposableRegistry.push(this);
    }
    public dispose() {
        while (this.disposables.length) {
            this.disposables.pop()?.dispose(); //NOSONAR
        }
    }
    public async activate(): Promise<void> {
        if (!this.experiment.inExperiment(NativeNotebook.experiment)) {
            return;
        }
        this.documentManager.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this.disposables);
    }

    private onDidChangeTextDocument(e: TextDocumentChangeEvent) {
        if (!isNotebookCell(e.document)) {
            return;
        }

        const details = this.getEditorsAndCell(e.document);
        if (!details) {
            return;
        }

        const cell = details.model.cells.find((item) => item.id === details.cellId);
        if (!cell) {
            traceError(
                `Syncing Cell Editor aborted, Unable to find corresponding ICell for ${e.document.uri.toString()}`,
                new Error('ICell not found')
            );
            return;
        }

        cell.data.source = splitMultilineString(e.document.getText());
    }

    private getEditorsAndCell(cellDocument: TextDocument) {
        if (this.mappedDocuments.has(cellDocument)) {
            return this.mappedDocuments.get(cellDocument)!;
        }

        let document: NotebookDocument | undefined;
        let cell: NotebookCell | undefined;
        this.vscNotebook.notebookEditors.find((vscEditor) => {
            const found = vscEditor.document.cells.find((item) => item.document === cellDocument);
            if (found) {
                document = vscEditor.document;
                cell = found;
            }
            return !!found;
        });

        if (!document) {
            traceError(
                `Syncing Cell Editor aborted, Unable to find corresponding Notebook for ${cellDocument.uri.toString()}`,
                new Error('Unable to find corresponding Notebook')
            );
            return;
        }
        if (!cell) {
            traceError(
                `Syncing Cell Editor aborted, Unable to find corresponding NotebookCell for ${cellDocument.uri.toString()}`,
                new Error('Unable to find corresponding NotebookCell')
            );
            return;
        }

        // Check if we have an editor associated with this document.
        const editor = this.editorProvider.editors.find((item) => item.file.toString() === document?.uri.toString());
        if (!editor) {
            traceError(
                `Syncing Cell Editor aborted, Unable to find corresponding Editor for ${cellDocument.uri.toString()}`,
                new Error('Unable to find corresponding Editor')
            );
            return;
        }
        if (!editor.model) {
            traceError(
                `Syncing Cell Editor aborted, Unable to find corresponding INotebookModel for ${cellDocument.uri.toString()}`,
                new Error('No INotebookModel in editor')
            );
            return;
        }

        this.mappedDocuments.set(cellDocument, { model: editor.model, cellId: cell.metadata.custom!.cellId });
        return this.mappedDocuments.get(cellDocument);
    }
}
