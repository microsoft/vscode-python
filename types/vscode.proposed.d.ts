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
         * Controls whether a cell's editor is editable/readonly.
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
         * Whether a code cell's editor is collapsed
         */
        inputCollapsed?: boolean;

        /**
         * Whether a code cell's outputs are collapsed
         */
        outputCollapsed?: boolean;

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
        readonly language: string;
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
        readonly version: number;
        readonly fileName: string;
        readonly viewType: string;
        readonly isDirty: boolean;
        readonly isUntitled: boolean;
        readonly cells: ReadonlyArray<NotebookCell>;
        languages: string[];
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

    export interface WorkspaceEdit {
        replaceCells(
            uri: Uri,
            start: number,
            end: number,
            cells: NotebookCellData[],
            metadata?: WorkspaceEditEntryMetadata
        ): void;
        replaceCellOutput(uri: Uri, index: number, outputs: CellOutput[], metadata?: WorkspaceEditEntryMetadata): void;
        replaceCellMetadata(
            uri: Uri,
            index: number,
            cellMetadata: NotebookCellMetadata,
            metadata?: WorkspaceEditEntryMetadata
        ): void;
    }

    export interface NotebookEditorCellEdit {
        replaceCells(start: number, end: number, cells: NotebookCellData[]): void;
        replaceOutput(index: number, outputs: CellOutput[]): void;
        replaceMetadata(index: number, metadata: NotebookCellMetadata): void;

        /** @deprecated */
        insert(
            index: number,
            content: string | string[],
            language: string,
            type: CellKind,
            outputs: CellOutput[],
            metadata: NotebookCellMetadata | undefined
        ): void;
        /** @deprecated */
        delete(index: number): void;
    }

    export interface NotebookCellRange {
        readonly start: number;
        readonly end: number;
    }

    export enum NotebookEditorRevealType {
        /**
         * The range will be revealed with as little scrolling as possible.
         */
        Default = 0,
        /**
         * The range will always be revealed in the center of the viewport.
         */
        InCenter = 1,
        /**
         * If the range is outside the viewport, it will be revealed in the center of the viewport.
         * Otherwise, it will be revealed with as little scrolling as possible.
         */
        InCenterIfOutsideViewport = 2
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
         * The current visible ranges in the editor (vertically).
         */
        readonly visibleRanges: NotebookCellRange[];

        /**
         * The column in which this editor shows.
         */
        readonly viewColumn?: ViewColumn;

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

        revealRange(range: NotebookCellRange, revealType?: NotebookEditorRevealType): void;
    }

    export interface NotebookOutputSelector {
        mimeTypes?: string[];
    }

    export interface NotebookRenderRequest {
        output: CellDisplayOutput;
        mimeType: string;
        outputId: string;
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

    export interface NotebookCellMetadataChangeEvent {
        readonly document: NotebookDocument;
        readonly cell: NotebookCell;
    }

    export interface NotebookEditorSelectionChangeEvent {
        readonly notebookEditor: NotebookEditor;
        readonly selection?: NotebookCell;
    }

    export interface NotebookEditorVisibleRangesChangeEvent {
        readonly notebookEditor: NotebookEditor;
        readonly visibleRanges: ReadonlyArray<NotebookCellRange>;
    }

    export interface NotebookCellData {
        readonly cellKind: CellKind;
        readonly source: string;
        readonly language: string;
        readonly outputs: CellOutput[];
        readonly metadata: NotebookCellMetadata | undefined;
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
    }

    export interface NotebookKernel {
        readonly id?: string;
        label: string;
        description?: string;
        detail?: string;
        isPreferred?: boolean;
        preloads?: Uri[];
        executeCell(document: NotebookDocument, cell: NotebookCell): void;
        cancelCellExecution(document: NotebookDocument, cell: NotebookCell): void;
        executeAllCells(document: NotebookDocument): void;
        cancelAllCellsExecution(document: NotebookDocument): void;
    }

    export interface NotebookDocumentFilter {
        viewType?: string | string[];
        filenamePattern?: GlobPattern | { include: GlobPattern; exclude: GlobPattern };
    }

    export interface NotebookKernelProvider<T extends NotebookKernel = NotebookKernel> {
        onDidChangeKernels?: Event<NotebookDocument | undefined>;
        provideKernels(document: NotebookDocument, token: CancellationToken): ProviderResult<T[]>;
        resolveKernel?(
            kernel: T,
            document: NotebookDocument,
            webview: NotebookCommunication,
            token: CancellationToken
        ): ProviderResult<void>;
    }

    /**
     * Represents the alignment of status bar items.
     */
    export enum NotebookCellStatusBarAlignment {
        /**
         * Aligned to the left side.
         */
        Left = 1,

        /**
         * Aligned to the right side.
         */
        Right = 2
    }

    export interface NotebookCellStatusBarItem {
        readonly cell: NotebookCell;
        readonly alignment: NotebookCellStatusBarAlignment;
        readonly priority?: number;
        text: string;
        tooltip: string | undefined;
        command: string | Command | undefined;
        accessibilityInformation?: AccessibilityInformation;
        show(): void;
        hide(): void;
        dispose(): void;
    }

    export namespace notebook {
        export function registerNotebookContentProvider(
            notebookType: string,
            provider: NotebookContentProvider,
            options?: {
                /**
                 * Controls if outputs change will trigger notebook document content change and if it will be used in the diff editor
                 * Default to false. If the content provider doesn't persisit the outputs in the file document, this should be set to true.
                 */
                transientOutputs: boolean;
                /**
                 * Controls if a meetadata property change will trigger notebook document content change and if it will be used in the diff editor
                 * Default to false. If the content provider doesn't persisit a metadata property in the file document, it should be set to true.
                 */
                transientMetadata: { [K in keyof NotebookCellMetadata]?: boolean };
            }
        ): Disposable;

        export function registerNotebookKernelProvider(
            selector: NotebookDocumentFilter,
            provider: NotebookKernelProvider
        ): Disposable;

        export const onDidOpenNotebookDocument: Event<NotebookDocument>;
        export const onDidCloseNotebookDocument: Event<NotebookDocument>;
        export const onDidSaveNotebookDocument: Event<NotebookDocument>;

        /**
         * All currently known notebook documents.
         */
        export const notebookDocuments: ReadonlyArray<NotebookDocument>;

        export const visibleNotebookEditors: NotebookEditor[];
        export const onDidChangeVisibleNotebookEditors: Event<NotebookEditor[]>;

        export const activeNotebookEditor: NotebookEditor | undefined;
        export const onDidChangeActiveNotebookEditor: Event<NotebookEditor | undefined>;
        export const onDidChangeNotebookEditorSelection: Event<NotebookEditorSelectionChangeEvent>;
        export const onDidChangeNotebookEditorVisibleRanges: Event<NotebookEditorVisibleRangesChangeEvent>;
        export const onDidChangeNotebookCells: Event<NotebookCellsChangeEvent>;
        export const onDidChangeCellOutputs: Event<NotebookCellOutputsChangeEvent>;
        export const onDidChangeCellLanguage: Event<NotebookCellLanguageChangeEvent>;
        export const onDidChangeCellMetadata: Event<NotebookCellMetadataChangeEvent>;
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

        /**
         * Creates a notebook cell status bar [item](#NotebookCellStatusBarItem).
         * It will be disposed automatically when the notebook document is closed or the cell is deleted.
         *
         * @param cell The cell on which this item should be shown.
         * @param alignment The alignment of the item.
         * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
         * @return A new status bar item.
         */
        export function createCellStatusBarItem(
            cell: NotebookCell,
            alignment?: NotebookCellStatusBarAlignment,
            priority?: number
        ): NotebookCellStatusBarItem;
    }
}
