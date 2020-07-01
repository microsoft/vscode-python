// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { TextDocument, TextDocumentChangeEvent } from 'vscode';
import type { NotebookCell, NotebookDocument } from '../../../../typings/vscode-proposed';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDocumentManager, IVSCodeNotebook } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { isNotebookCell } from '../../common/utils/misc';
import { VSCodeNotebookModel } from '../notebookStorage/vscNotebookModel';
import { INotebookEditorProvider } from '../types';
import { getOriginalCellId } from './helpers/cellMappers';

@injectable()
export class CellEditSyncService implements IExtensionSingleActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    private mappedDocuments = new WeakMap<TextDocument, { cellId: string; model: VSCodeNotebookModel }>();
    private nonJupyterNotebookDocuments = new WeakSet<TextDocument>();
    constructor(
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider
    ) {
        disposableRegistry.push(this);
    }
    public dispose() {
        while (this.disposables.length) {
            this.disposables.pop()?.dispose(); //NOSONAR
        }
    }
    public async activate(): Promise<void> {
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

        details.model.updateCellSource(details.cellId, e.document.getText());
    }

    private getEditorsAndCell(cellDocument: TextDocument) {
        if (this.mappedDocuments.has(cellDocument)) {
            return this.mappedDocuments.get(cellDocument)!;
        }
        if (this.nonJupyterNotebookDocuments.has(cellDocument)) {
            return;
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

        if (!document || !cell) {
            if (this.isNonJupyterTextDocument(cellDocument)) {
                return;
            }

            traceError(
                `Syncing Cell Editor aborted, Unable to find corresponding Notebook for ${cellDocument.uri.toString()}`,
                new Error('Unable to find corresponding Notebook')
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

        if (!(editor.model instanceof VSCodeNotebookModel)) {
            throw new Error('Notebook Model is not of type VSCodeNotebookModel');
        }

        this.mappedDocuments.set(cellDocument, { model: editor.model, cellId: getOriginalCellId(cell)! });
        return this.mappedDocuments.get(cellDocument);
    }
    /**
     * Check if the text document belongs to a notebook that's not ours.
     */
    private isNonJupyterTextDocument(cellDocument: TextDocument) {
        // If this text document is for a note book thats
        if (
            this.vscNotebook.notebookDocuments.find(
                (doc) => doc.cells.findIndex((cell) => cell.document === cellDocument) >= 0
            )
        ) {
            this.nonJupyterNotebookDocuments.add(cellDocument);
            return true;
        }
        return false;
    }
}
