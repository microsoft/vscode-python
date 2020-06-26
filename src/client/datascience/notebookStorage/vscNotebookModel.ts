import type { nbformat } from '@jupyterlab/coreutils';
import { Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { ICell } from '../types';
import { BaseNotebookModel } from './baseModel';

// Exported for test mocks
export class VSCodeNotebookModel extends BaseNotebookModel {
    private document?: NotebookDocument;
    public get isDirty(): boolean {
        return this.document?.isDirty === true;
    }

    constructor(
        isTrusted: boolean,
        file: Uri,
        cells: ICell[],
        json: Partial<nbformat.INotebookContent> = {},
        indentAmount: string = ' ',
        pythonNumber: number = 3
    ) {
        super(isTrusted, file, cells, json, indentAmount, pythonNumber);
    }
    /**
     * Unfortunately Notebook models are created early, well before a VSC Notebook Document is created.
     * We can associate an INotebookModel with a VSC Notebook, only after the Notebook has been opened.
     */
    public associateNotebookDocument(document: NotebookDocument) {
        this.document = document;
    }
    protected handleRedo(change: NotebookModelChange): boolean {
        super.handleRedo(change);
        return true;
    }
}
