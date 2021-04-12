// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { NotebookCell, NotebookCellRange, NotebookDocumentMetadata, Uri } from 'vscode';
import { NotebookDocument } from 'vscode-proposed';

export interface ISafeNotebookDocument extends NotebookDocument {}

// The old API for NotebookDocument for vscode engine version < 1.56
interface IOldNotebookDocument {
    readonly cells: ReadonlyArray<NotebookCell>;
}

// In the Python extension we often need to support different changing
// VS Code api versions. This class adds a layer of indirection so that we
// can handle changes to the NotebookDocument class in the API
// When python extension ships with engine version 1.56 for stable and insiders we can remove
// this class and just use NotebookDocument directly
export class SafeNotebookDocument implements ISafeNotebookDocument {
    constructor(private notebook: NotebookDocument) {}

    // Functions changed to handle multiple APIs
    public getCells(range?: NotebookCellRange): ReadonlyArray<NotebookCell> {
        if ('getCells' in this.notebook) {
            return this.notebook.getCells(range);
        }
        // Old API with .cells
        return (this.notebook as IOldNotebookDocument).cells;
    }

    public cellAt(index: number): NotebookCell {
        if ('cellAt' in this.notebook) {
            return this.notebook.cellAt(index);
        }

        // Old API with .cells
        return (this.notebook as IOldNotebookDocument).cells[index];
    }

    public get cellCount(): number {
        if ('cellCount' in this.notebook) {
            return this.notebook.cellCount;
        }

        // Old API with .cells
        return (this.notebook as IOldNotebookDocument).cells.length;
    }

    // Functions directly implemented by NotebookDocument
    public get uri(): Uri {
        return this.notebook.uri;
    }

    public get version(): number {
        return this.notebook.version;
    }

    public get fileName(): string {
        return this.notebook.fileName;
    }

    public get isDirty(): boolean {
        return this.notebook.isDirty;
    }

    public get isUntitled(): boolean {
        return this.notebook.isUntitled;
    }

    public get isClosed(): boolean {
        return this.notebook.isClosed;
    }

    public get metadata(): NotebookDocumentMetadata {
        return this.notebook.metadata;
    }

    public get viewType(): string {
        return this.notebook.viewType;
    }

    public save(): Thenable<boolean> {
        return this.notebook.save();
    }
}
