// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

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

    export interface NotebookCellOutputMetadata {
        /**
         * Additional attributes of a cell metadata.
         */
        custom?: { [key: string]: any };
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

        readonly metadata?: NotebookCellOutputMetadata;
    }

    export type CellOutput = CellStreamOutput | CellErrorOutput | CellDisplayOutput;

    export enum NotebookCellRunState {
        Running = 1,
        Idle = 2,
        Success = 3,
        Error = 4
    }

    export enum NotebookRunState {
        Running = 1,
        Idle = 2
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
         * Whether the [execution order](#NotebookCellMetadata.executionOrder) indicator will be displayed.
         * Defaults to true.
         */
        hasExecutionOrder?: boolean;

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
        readonly notebook: NotebookDocument;
        readonly uri: Uri;
        readonly cellKind: CellKind;
        readonly document: TextDocument;
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
         * Default value for [cell hasExecutionOrder metadata](#NotebookCellMetadata.hasExecutionOrder).
         * Defaults to true.
         */
        cellHasExecutionOrder?: boolean;

        displayOrder?: GlobPattern[];

        /**
         * Additional attributes of the document metadata.
         */
        custom?: { [key: string]: any };

        /**
         * The document's current run state
         */
        runState?: NotebookRunState;
    }

    export interface NotebookDocument {
        readonly uri: Uri;
        readonly fileName: string;
        readonly viewType: string;
        readonly isDirty: boolean;
        readonly cells: NotebookCell[];
        languages: string[];
        displayOrder?: GlobPattern[];
        metadata: NotebookDocumentMetadata;
    }

    export interface NotebookConcatTextDocument {
        uri: Uri;
        isClosed: boolean;
        dispose(): void;
        onDidChange: Event<void>;
        version: number;
        getText(): string;
        getText(range: Range): string;

        offsetAt(position: Position): number;
        positionAt(offset: number): Position;
        validateRange(range: Range): Range;
        validatePosition(position: Position): Position;

        locationAt(positionOrRange: Position | Range): Location;
        positionAt(location: Location): Position;
        contains(uri: Uri): boolean;
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

        /**
         * The column in which this editor shows.
         */
        viewColumn?: ViewColumn;

        /**
         * Whether the panel is active (focused by the user).
         */
        readonly active: boolean;

        /**
         * Whether the panel is visible.
         */
        readonly visible: boolean;

        /**
         * Fired when the panel is disposed.
         */
        readonly onDidDispose: Event<void>;

        /**
         * Active kernel used in the editor
         */
        readonly kernel?: NotebookKernel;

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
        mimeTypes?: string[];
    }

    export interface NotebookRenderRequest {
        output: CellDisplayOutput;
        mimeType: string;
        outputId: string;
    }

    export interface NotebookOutputRenderer {
        /**
         *
         * @returns HTML fragment. We can probably return `CellOutput` instead of string ?
         *
         */
        render(document: NotebookDocument, request: NotebookRenderRequest): string;

        /**
         * Call before HTML from the renderer is executed, and will be called for
         * every editor associated with notebook documents where the renderer
         * is or was used.
         *
         * The communication object will only send and receive messages to the
         * render API, retrieved via `acquireNotebookRendererApi`, acquired with
         * this specific renderer's ID.
         *
         * If you need to keep an association between the communication object
         * and the document for use in the `render()` method, you can use a WeakMap.
         */
        resolveNotebook?(document: NotebookDocument, communication: NotebookCommunication): void;

        readonly preloads?: Uri[];
    }

    export interface NotebookCellsChangeData {
        readonly start: number;
        readonly deletedCount: number;
        readonly deletedItems: NotebookCell[];
        readonly items: NotebookCell[];
    }

    export interface NotebookCellsChangeEvent {
        /**
         * The affected document.
         */
        readonly document: NotebookDocument;
        readonly changes: ReadonlyArray<NotebookCellsChangeData>;
    }

    export interface NotebookCellMoveEvent {
        /**
         * The affected document.
         */
        readonly document: NotebookDocument;
        readonly index: number;
        readonly newIndex: number;
    }

    export interface NotebookCellOutputsChangeEvent {
        /**
         * The affected document.
         */
        readonly document: NotebookDocument;
        readonly cells: NotebookCell[];
    }

    export interface NotebookCellLanguageChangeEvent {
        /**
         * The affected document.
         */
        readonly document: NotebookDocument;
        readonly cell: NotebookCell;
        readonly language: string;
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

    interface NotebookDocumentContentChangeEvent {
        /**
         * The document that the edit is for.
         */
        readonly document: NotebookDocument;
    }

    interface NotebookDocumentEditEvent {
        /**
         * The document that the edit is for.
         */
        readonly document: NotebookDocument;

        /**
         * Undo the edit operation.
         *
         * This is invoked by VS Code when the user undoes this edit. To implement `undo`, your
         * extension should restore the document and editor to the state they were in just before this
         * edit was added to VS Code's internal edit stack by `onDidChangeCustomDocument`.
         */
        undo(): Thenable<void> | void;

        /**
         * Redo the edit operation.
         *
         * This is invoked by VS Code when the user redoes this edit. To implement `redo`, your
         * extension should restore the document and editor to the state they were in just after this
         * edit was added to VS Code's internal edit stack by `onDidChangeCustomDocument`.
         */
        redo(): Thenable<void> | void;

        /**
         * Display name describing the edit.
         *
         * This will be shown to users in the UI for undo/redo operations.
         */
        readonly label?: string;
    }

    interface NotebookDocumentBackup {
        /**
         * Unique identifier for the backup.
         *
         * This id is passed back to your extension in `openCustomDocument` when opening a notebook editor from a backup.
         */
        readonly id: string;

        /**
         * Delete the current backup.
         *
         * This is called by VS Code when it is clear the current backup is no longer needed, such as when a new backup
         * is made or when the file is saved.
         */
        delete(): void;
    }

    interface NotebookDocumentBackupContext {
        readonly destination: Uri;
    }

    interface NotebookDocumentOpenContext {
        readonly backupId?: string;
    }

    /**
     * Communication object passed to the {@link NotebookContentProvider} and
     * {@link NotebookOutputRenderer} to communicate with the webview.
     */
    export interface NotebookCommunication {
        /**
         * ID of the editor this object communicates with. A single notebook
         * document can have multiple attached webviews and editors, when the
         * notebook is split for instance. The editor ID lets you differentiate
         * between them.
         */
        readonly editorId: string;

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
    }

    export interface NotebookContentProvider {
        /**
         * Content providers should always use [file system providers](#FileSystemProvider) to
         * resolve the raw content for `uri` as the resouce is not necessarily a file on disk.
         */
        openNotebook(uri: Uri, openContext: NotebookDocumentOpenContext): NotebookData | Promise<NotebookData>;
        resolveNotebook(document: NotebookDocument, webview: NotebookCommunication): Promise<void>;
        saveNotebook(document: NotebookDocument, cancellation: CancellationToken): Promise<void>;
        saveNotebookAs(targetResource: Uri, document: NotebookDocument, cancellation: CancellationToken): Promise<void>;
        readonly onDidChangeNotebook: Event<NotebookDocumentContentChangeEvent | NotebookDocumentEditEvent>;
        backupNotebook(
            document: NotebookDocument,
            context: NotebookDocumentBackupContext,
            cancellation: CancellationToken
        ): Promise<NotebookDocumentBackup>;

        kernel?: NotebookKernel;
    }

    export interface NotebookKernel {
        readonly id?: string;
        label: string;
        description?: string;
        isPreferred?: boolean;
        preloads?: Uri[];
        executeCell(document: NotebookDocument, cell: NotebookCell): void;
        cancelCellExecution(document: NotebookDocument, cell: NotebookCell): void;
        executeAllCells(document: NotebookDocument): void;
        cancelAllCellsExecution(document: NotebookDocument): void;
    }

    export interface NotebookDocumentFilter {
        viewType?: string;
        filenamePattern?: GlobPattern;
        excludeFileNamePattern?: GlobPattern;
    }

    export interface NotebookKernelProvider<T extends NotebookKernel = NotebookKernel> {
        onDidChangeKernels?: Event<void>;
        provideKernels(document: NotebookDocument, token: CancellationToken): ProviderResult<T[]>;
        resolveKernel?(
            kernel: T,
            document: NotebookDocument,
            webview: NotebookCommunication,
            token: CancellationToken
        ): ProviderResult<void>;
    }

    export namespace notebook {
        export function registerNotebookContentProvider(
            notebookType: string,
            provider: NotebookContentProvider
        ): Disposable;

        export function registerNotebookKernelProvider(
            selector: NotebookDocumentFilter,
            provider: NotebookKernelProvider
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

        /**
         * All currently known notebook documents.
         */
        export const notebookDocuments: ReadonlyArray<NotebookDocument>;

        export let visibleNotebookEditors: NotebookEditor[];
        export const onDidChangeVisibleNotebookEditors: Event<NotebookEditor[]>;

        export let activeNotebookEditor: NotebookEditor | undefined;
        export const onDidChangeActiveNotebookEditor: Event<NotebookEditor | undefined>;
        export const onDidChangeNotebookCells: Event<NotebookCellsChangeEvent>;
        export const onDidChangeCellOutputs: Event<NotebookCellOutputsChangeEvent>;
        export const onDidChangeCellLanguage: Event<NotebookCellLanguageChangeEvent>;
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

        export const onDidChangeActiveNotebookKernel: Event<{
            document: NotebookDocument;
            kernel: NotebookKernel | undefined;
        }>;
    }
}
