// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    Event,
    GlobPattern,
    Uri,
    TextDocument,
    ViewColumn,
    CancellationToken,
    Disposable,
    DocumentSelector
} from 'vscode';

// Copy nb section from https://github.com/microsoft/vscode/blob/master/src/vs/vscode.proposed.d.ts.
declare module 'vscode' {
    export enum CellKind {
        Markdown = 1,
        Code = 2
    }

    export enum CellOutputKind {
        Text = 1,
        Error = 2,
        Rich = 3
    }

    export interface CellStreamOutput {
        outputKind: CellOutputKind.Text;
        text: string;
    }

    export interface CellErrorOutput {
        outputKind: CellOutputKind.Error;
        /**
         * Exception Name
         */
        ename: string;
        /**
         * Exception Value
         */
        evalue: string;
        /**
         * Exception call stack
         */
        traceback: string[];
    }

    export interface CellDisplayOutput {
        outputKind: CellOutputKind.Rich;
        /**
         * { mime_type: value }
         *
         * Example:
         * ```json
         * {
         *   "outputKind": vscode.CellOutputKind.Rich,
         *   "data": {
         *      "text/html": [
         *          "<h1>Hello</h1>"
         *       ],
         *      "text/plain": [
         *        "<IPython.lib.display.IFrame at 0x11dee3e80>"
         *      ]
         *   }
         * }
         */
        data: { [key: string]: any };
    }

    export type CellOutput = CellStreamOutput | CellErrorOutput | CellDisplayOutput;

    export enum NotebookCellRunState {
        Running = 1,
        Idle = 2,
        Success = 3,
        Error = 4
    }

    export interface NotebookCellMetadata {
        /**
         * Controls if the content of a cell is editable or not.
         */
        editable?: boolean;

        /**
         * Controls if the cell is executable.
         * This metadata is ignored for markdown cell.
         */
        runnable?: boolean;

        /**
         * Controls if the cell has a margin to support the breakpoint UI.
         * This metadata is ignored for markdown cell.
         */
        breakpointMargin?: boolean;

        /**
         * The order in which this cell was executed.
         */
        executionOrder?: number;

        /**
         * A status message to be shown in the cell's status bar
         */
        statusMessage?: string;

        /**
         * The cell's current run state
         */
        runState?: NotebookCellRunState;

        /**
         * If the cell is running, the time at which the cell started running
         */
        runStartTime?: number;

        /**
         * The total duration of the cell's last run
         */
        lastRunDuration?: number;

        /**
         * Additional attributes of a cell metadata.
         */
        custom?: { [key: string]: any };
    }

    export interface NotebookCell {
        readonly uri: Uri;
        readonly cellKind: CellKind;
        readonly document: TextDocument;
        // API remove `source` or doc it as shorthand for document.getText()
        readonly source: string;
        language: string;
        outputs: CellOutput[];
        metadata: NotebookCellMetadata;
    }

    export interface NotebookDocumentMetadata {
        /**
         * Controls if users can add or delete cells
         * Defaults to true
         */
        editable?: boolean;

        /**
         * Controls whether the full notebook can be run at once.
         * Defaults to true
         */
        runnable?: boolean;

        /**
         * Default value for [cell editable metadata](#NotebookCellMetadata.editable).
         * Defaults to true.
         */
        cellEditable?: boolean;

        /**
         * Default value for [cell runnable metadata](#NotebookCellMetadata.runnable).
         * Defaults to true.
         */
        cellRunnable?: boolean;

        /**
         * Whether the [execution order](#NotebookCellMetadata.executionOrder) indicator will be displayed.
         * Defaults to true.
         */
        hasExecutionOrder?: boolean;

        displayOrder?: GlobPattern[];

        /**
         * Additional attributes of the document metadata.
         */
        custom?: { [key: string]: any };
    }

    export interface NotebookDocument {
        readonly uri: Uri;
        readonly fileName: string;
        readonly isDirty: boolean;
        readonly cells: NotebookCell[];
        languages: string[];
        displayOrder?: GlobPattern[];
        metadata: NotebookDocumentMetadata;
    }

    export interface NotebookConcatTextDocument {
        isClosed: boolean;
        dispose(): void;
        onDidChange: Event<void>;
        version: number;
        getText(): string;
        getText(range: Range): string;
        offsetAt(position: Position): number;
        positionAt(offset: number): Position;
        locationAt(positionOrRange: Position | Range): Location;
        positionAt(location: Location): Position;
    }

    export interface NotebookEditorCellEdit {
        insert(
            index: number,
            content: string | string[],
            language: string,
            type: CellKind,
            outputs: CellOutput[],
            metadata: NotebookCellMetadata | undefined
        ): void;
        delete(index: number): void;
    }

    export interface NotebookEditor {
        /**
         * The document associated with this notebook editor.
         */
        readonly document: NotebookDocument;

        /**
         * The primary selected cell on this notebook editor.
         */
        readonly selection?: NotebookCell;

        viewColumn?: ViewColumn;

        /**
         * Fired when the output hosting webview posts a message.
         */
        readonly onDidReceiveMessage: Event<any>;
        /**
         * Post a message to the output hosting webview.
         *
         * Messages are only delivered if the editor is live.
         *
         * @param message Body of the message. This must be a string or other json serilizable object.
         */
        postMessage(message: any): Thenable<boolean>;

        /**
         * Convert a uri for the local file system to one that can be used inside outputs webview.
         */
        asWebviewUri(localResource: Uri): Uri;

        edit(callback: (editBuilder: NotebookEditorCellEdit) => void): Thenable<boolean>;
    }

    export interface NotebookOutputSelector {
        type: string;
        subTypes?: string[];
    }

    export interface NotebookOutputRenderer {
        /**
         *
         * @returns HTML fragment. We can probably return `CellOutput` instead of string ?
         *
         */
        render(document: NotebookDocument, output: CellDisplayOutput, mimeType: string): string;
        preloads?: Uri[];
    }

    export interface NotebookDocumentChangeEvent {
        /**
         * The affected document.
         */
        readonly document: NotebookDocument;

        /**
         * An array of content changes.
         */
        // readonly contentChanges: ReadonlyArray<TextDocumentContentChangeEvent>;
    }

    export interface NotebookCellData {
        readonly cellKind: CellKind;
        readonly source: string;
        language: string;
        outputs: CellOutput[];
        metadata: NotebookCellMetadata;
    }

    export interface NotebookData {
        readonly cells: NotebookCellData[];
        readonly languages: string[];
        readonly metadata: NotebookDocumentMetadata;
    }

    interface NotebookDocumentEditEvent {
        /**
         * The document that the edit is for.
         */
        readonly document: NotebookDocument;
    }

    export interface NotebookContentProvider {
        openNotebook(uri: Uri): NotebookData | Promise<NotebookData>;
        saveNotebook(document: NotebookDocument, cancellation: CancellationToken): Promise<void>;
        saveNotebookAs(targetResource: Uri, document: NotebookDocument, cancellation: CancellationToken): Promise<void>;
        readonly onDidChangeNotebook: Event<NotebookDocumentEditEvent>;

        // revert?(document: NotebookDocument, cancellation: CancellationToken): Thenable<void>;
        // backup?(document: NotebookDocument, cancellation: CancellationToken): Thenable<CustomDocumentBackup>;

        kernel?: NotebookKernel;
    }

    export interface NotebookKernel {
        label: string;
        preloads?: Uri[];
        executeCell(document: NotebookDocument, cell: NotebookCell, token: CancellationToken): Promise<void>;
        executeAllCells(document: NotebookDocument, token: CancellationToken): Promise<void>;
    }

    export namespace notebook {
        export function registerNotebookContentProvider(
            notebookType: string,
            provider: NotebookContentProvider
        ): Disposable;

        export function registerNotebookKernel(
            id: string,
            selectors: GlobPattern[],
            kernel: NotebookKernel
        ): Disposable;

        export function registerNotebookOutputRenderer(
            id: string,
            outputSelector: NotebookOutputSelector,
            renderer: NotebookOutputRenderer
        ): Disposable;

        export const onDidOpenNotebookDocument: Event<NotebookDocument>;
        export const onDidCloseNotebookDocument: Event<NotebookDocument>;
        // export const onDidChangeVisibleNotebookEditors: Event<NotebookEditor[]>;

        // remove activeNotebookDocument, now that there is activeNotebookEditor.document
        export let activeNotebookDocument: NotebookDocument | undefined;

        export let activeNotebookEditor: NotebookEditor | undefined;

        export const onDidChangeNotebookDocument: Event<NotebookDocumentChangeEvent>;

        /**
         * Create a document that is the concatenation of all  notebook cells. By default all code-cells are included
         * but a selector can be provided to narrow to down the set of cells.
         *
         * @param notebook
         * @param selector
         */
        export function createConcatTextDocument(
            notebook: NotebookDocument,
            selector?: DocumentSelector
        ): NotebookConcatTextDocument;
    }
}
