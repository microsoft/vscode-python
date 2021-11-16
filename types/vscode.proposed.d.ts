// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable */
// Copy nb section from https://github.com/microsoft/vscode/blob/master/src/vs/vscode.proposed.d.ts.
declare module 'vscode' {
    //#region https://github.com/microsoft/vscode/issues/106744, Notebooks (misc)

    export enum NotebookCellKind {
        Markdown = 1,
        Code = 2,
    }

    export class NotebookCellMetadata {
        /**
         * Whether a code cell's editor is collapsed
         */
        readonly inputCollapsed?: boolean;

        /**
         * Whether a code cell's outputs are collapsed
         */
        readonly outputCollapsed?: boolean;

        /**
         * @deprecated
         * Additional attributes of a cell metadata.
         */
        readonly custom?: Record<string, any>;

        /**
         * Additional attributes of a cell metadata.
         */
        readonly [key: string]: any;

        constructor(inputCollapsed?: boolean, outputCollapsed?: boolean, custom?: Record<string, any>);

        with(change: {
            inputCollapsed?: boolean | null;
            outputCollapsed?: boolean | null;
            custom?: Record<string, any> | null;
            [key: string]: any;
        }): NotebookCellMetadata;
    }

    export interface NotebookCellExecutionSummary {
        executionOrder?: number;
        success?: boolean;
        startTime?: number;
        endTime?: number;
    }

    // todo@API support ids https://github.com/jupyter/enhancement-proposals/blob/master/62-cell-id/cell-id.md
    export interface NotebookCell {
        readonly index: number;
        readonly notebook: NotebookDocument;
        readonly kind: NotebookCellKind;
        readonly document: TextDocument;
        readonly metadata: NotebookCellMetadata;
        readonly outputs: ReadonlyArray<NotebookCellOutput>;
        readonly latestExecutionSummary: NotebookCellExecutionSummary | undefined;
    }

    export class NotebookDocumentMetadata {
        /**
         * @deprecated
         * Additional attributes of the document metadata.
         */
        readonly custom: { [key: string]: any };
        /**
         * Whether the document is trusted, default to true
         * When false, insecure outputs like HTML, JavaScript, SVG will not be rendered.
         */
        readonly trusted: boolean;

        /**
         * Additional attributes of the document metadata.
         */
        readonly [key: string]: any;

        constructor(trusted?: boolean, custom?: { [key: string]: any });

        with(change: {
            trusted?: boolean | null;
            custom?: { [key: string]: any } | null;
            [key: string]: any;
        }): NotebookDocumentMetadata;
    }

    export interface NotebookDocumentContentOptions {
        /**
         * Controls if outputs change will trigger notebook document content change and if it will be used in the diff editor
         * Default to false. If the content provider doesn't persisit the outputs in the file document, this should be set to true.
         */
        transientOutputs?: boolean;

        /**
         * Controls if a meetadata property change will trigger notebook document content change and if it will be used in the diff editor
         * Default to false. If the content provider doesn't persisit a metadata property in the file document, it should be set to true.
         */
        transientMetadata?: { [K in keyof NotebookCellMetadata]?: boolean };
    }

    export interface NotebookDocument {
        readonly uri: Uri;
        readonly version: number;

        readonly isDirty: boolean;
        readonly isUntitled: boolean;

        /**
         * `true` if the notebook has been closed. A closed notebook isn't synchronized anymore
         * and won't be re-used when the same resource is opened again.
         */
        readonly isClosed: boolean;

        readonly metadata: NotebookDocumentMetadata;

        // todo@API should we really expose this?
        readonly notebookType: string;

        /**
         * The number of cells in the notebook document.
         */
        readonly cellCount: number;

        /**
         * Return the cell at the specified index. The index will be adjusted to the notebook.
         *
         * @param index - The index of the cell to retrieve.
         * @return A [cell](#NotebookCell).
         */
        cellAt(index: number): NotebookCell;

        /**
         * Get the cells of this notebook. A subset can be retrieved by providing
         * a range. The range will be adjuset to the notebook.
         *
         * @param range A notebook range.
         * @returns The cells contained by the range or all cells.
         */
        getCells(range?: NotebookRange): NotebookCell[];

        /**
         * Save the document. The saving will be handled by the corresponding content provider
         *
         * @return A promise that will resolve to true when the document
         * has been saved. If the file was not dirty or the save failed,
         * will return false.
         */
        save(): Thenable<boolean>;
    }

    export class NotebookRange {
        readonly start: number;
        /**
         * exclusive
         */
        readonly end: number;

        readonly isEmpty: boolean;

        constructor(start: number, end: number);

        with(change: { start?: number; end?: number }): NotebookRange;
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
        InCenterIfOutsideViewport = 2,

        /**
         * The range will always be revealed at the top of the viewport.
         */
        AtTop = 3,
    }

    export interface NotebookEditor {
        /**
         * The document associated with this notebook editor.
         */
        readonly document: NotebookDocument;

        /**
         * The selections on this notebook editor.
         *
         * The primary selection (or focused range) is `selections[0]`. When the document has no cells, the primary selection is empty `{ start: 0, end: 0 }`;
         */
        readonly selections: NotebookRange[];

        /**
         * The current visible ranges in the editor (vertically).
         */
        readonly visibleRanges: NotebookRange[];

        revealRange(range: NotebookRange, revealType?: NotebookEditorRevealType): void;

        /**
         * The column in which this editor shows.
         */
        readonly viewColumn?: ViewColumn;
    }

    export interface NotebookDocumentMetadataChangeEvent {
        readonly document: NotebookDocument;
    }

    export interface NotebookCellsChangeData {
        readonly start: number;
        // todo@API end? Use NotebookCellRange instead?
        readonly deletedCount: number;
        // todo@API removedCells, deletedCells?
        readonly deletedItems: NotebookCell[];
        // todo@API addedCells, insertedCells, newCells?
        readonly items: NotebookCell[];
    }

    export interface NotebookCellsChangeEvent {
        /**
         * The affected document.
         */
        readonly document: NotebookDocument;
        readonly changes: ReadonlyArray<NotebookCellsChangeData>;
    }

    export interface NotebookCellOutputsChangeEvent {
        /**
         * The affected document.
         */
        readonly document: NotebookDocument;
        readonly cells: NotebookCell[];
    }

    export interface NotebookCellMetadataChangeEvent {
        readonly document: NotebookDocument;
        readonly cell: NotebookCell;
    }

    export interface NotebookEditorSelectionChangeEvent {
        readonly notebookEditor: NotebookEditor;
        readonly selections: ReadonlyArray<NotebookRange>;
    }

    export interface NotebookEditorVisibleRangesChangeEvent {
        readonly notebookEditor: NotebookEditor;
        readonly visibleRanges: ReadonlyArray<NotebookRange>;
    }

    export interface NotebookCellExecutionStateChangeEvent {
        readonly document: NotebookDocument;
        readonly cell: NotebookCell;
        readonly executionState: NotebookCellExecutionState;
    }

    // todo@API support ids https://github.com/jupyter/enhancement-proposals/blob/master/62-cell-id/cell-id.md
    export class NotebookCellData {
        // todo@API should they all be readonly?
        kind: NotebookCellKind;
        // todo@API better names: value? text?
        source: string;
        // todo@API how does language and MD relate?
        language: string;
        // todo@API ReadonlyArray?
        outputs?: NotebookCellOutput[];
        metadata?: NotebookCellMetadata;
        latestExecutionSummary?: NotebookCellExecutionSummary;
        constructor(
            kind: NotebookCellKind,
            source: string,
            language: string,
            outputs?: NotebookCellOutput[],
            metadata?: NotebookCellMetadata,
            latestExecutionSummary?: NotebookCellExecutionSummary,
        );
    }

    export class NotebookData {
        // todo@API should they all be readonly?
        cells: NotebookCellData[];
        metadata: NotebookDocumentMetadata;
        constructor(cells: NotebookCellData[], metadata?: NotebookDocumentMetadata);
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
         * @param message Body of the message. This must be a string or other json serializable object.
         */
        postMessage(message: any): Thenable<boolean>;

        /**
         * Convert a uri for the local file system to one that can be used inside outputs webview.
         */
        asWebviewUri(localResource: Uri): Uri;

        // @rebornix
        // readonly onDidDispose: Event<void>;
    }

    // export function registerNotebookKernel(selector: string, kernel: NotebookKernel): Disposable;

    export interface NotebookDocumentShowOptions {
        viewColumn?: ViewColumn;
        preserveFocus?: boolean;
        preview?: boolean;
        selections?: NotebookRange[];
    }

    export namespace notebook {
        export function openNotebookDocument(uri: Uri): Thenable<NotebookDocument>;

        export const onDidOpenNotebookDocument: Event<NotebookDocument>;
        export const onDidCloseNotebookDocument: Event<NotebookDocument>;

        export const onDidSaveNotebookDocument: Event<NotebookDocument>;

        /**
         * All currently known notebook documents.
         */
        export const notebookDocuments: ReadonlyArray<NotebookDocument>;
        export const onDidChangeNotebookDocumentMetadata: Event<NotebookDocumentMetadataChangeEvent>;
        export const onDidChangeNotebookCells: Event<NotebookCellsChangeEvent>;
        export const onDidChangeCellOutputs: Event<NotebookCellOutputsChangeEvent>;

        export const onDidChangeCellMetadata: Event<NotebookCellMetadataChangeEvent>;
    }

    export namespace window {
        export const visibleNotebookEditors: NotebookEditor[];
        export const onDidChangeVisibleNotebookEditors: Event<NotebookEditor[]>;
        export const activeNotebookEditor: NotebookEditor | undefined;
        export const onDidChangeActiveNotebookEditor: Event<NotebookEditor | undefined>;
        export const onDidChangeNotebookEditorSelection: Event<NotebookEditorSelectionChangeEvent>;
        export const onDidChangeNotebookEditorVisibleRanges: Event<NotebookEditorVisibleRangesChangeEvent>;

        export function showNotebookDocument(uri: Uri, options?: NotebookDocumentShowOptions): Thenable<NotebookEditor>;
        export function showNotebookDocument(
            document: NotebookDocument,
            options?: NotebookDocumentShowOptions,
        ): Thenable<NotebookEditor>;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookCellOutput

    // code specific mime types
    // application/x.notebook.error-traceback
    // application/x.notebook.stdout
    // application/x.notebook.stderr
    // application/x.notebook.stream
    export class NotebookCellOutputItem {
        // todo@API
        // add factory functions for common mime types
        // static textplain(value:string): NotebookCellOutputItem;
        // static errortrace(value:any): NotebookCellOutputItem;

        readonly mime: string;
        readonly value: unknown;
        readonly metadata?: Record<string, any>;

        constructor(mime: string, value: unknown, metadata?: Record<string, any>);
    }

    // @jrieken
    // todo@API think about readonly...
    //TODO@API add execution count to cell output?
    export class NotebookCellOutput {
        readonly id: string;
        readonly outputs: NotebookCellOutputItem[];
        readonly metadata?: Record<string, any>;

        constructor(outputs: NotebookCellOutputItem[], metadata?: Record<string, any>);

        constructor(outputs: NotebookCellOutputItem[], id: string, metadata?: Record<string, any>);
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookEditorEdit

    export interface WorkspaceEdit {
        replaceNotebookMetadata(uri: Uri, value: NotebookDocumentMetadata): void;

        // todo@API use NotebookCellRange
        replaceNotebookCells(
            uri: Uri,
            start: number,
            end: number,
            cells: NotebookCellData[],
            metadata?: WorkspaceEditEntryMetadata,
        ): void;
        replaceNotebookCellMetadata(
            uri: Uri,
            index: number,
            cellMetadata: NotebookCellMetadata,
            metadata?: WorkspaceEditEntryMetadata,
        ): void;

        replaceNotebookCellOutput(
            uri: Uri,
            index: number,
            outputs: NotebookCellOutput[],
            metadata?: WorkspaceEditEntryMetadata,
        ): void;
        appendNotebookCellOutput(
            uri: Uri,
            index: number,
            outputs: NotebookCellOutput[],
            metadata?: WorkspaceEditEntryMetadata,
        ): void;

        // TODO@api
        // https://jupyter-protocol.readthedocs.io/en/latest/messaging.html#update-display-data
        replaceNotebookCellOutputItems(
            uri: Uri,
            index: number,
            outputId: string,
            items: NotebookCellOutputItem[],
            metadata?: WorkspaceEditEntryMetadata,
        ): void;
        appendNotebookCellOutputItems(
            uri: Uri,
            index: number,
            outputId: string,
            items: NotebookCellOutputItem[],
            metadata?: WorkspaceEditEntryMetadata,
        ): void;
    }

    export interface NotebookEditorEdit {
        replaceMetadata(value: NotebookDocumentMetadata): void;
        replaceCells(start: number, end: number, cells: NotebookCellData[]): void;
        replaceCellOutput(index: number, outputs: NotebookCellOutput[]): void;
        replaceCellMetadata(index: number, metadata: NotebookCellMetadata): void;
    }

    export interface NotebookEditor {
        /**
         * Perform an edit on the notebook associated with this notebook editor.
         *
         * The given callback-function is invoked with an [edit-builder](#NotebookEditorEdit) which must
         * be used to make edits. Note that the edit-builder is only valid while the
         * callback executes.
         *
         * @param callback A function which can create edits using an [edit-builder](#NotebookEditorEdit).
         * @return A promise that resolves with a value indicating if the edits could be applied.
         */
        // @jrieken REMOVE maybe
        edit(callback: (editBuilder: NotebookEditorEdit) => void): Thenable<boolean>;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookSerializer

    export interface NotebookSerializer {
        deserializeNotebook(data: Uint8Array, token: CancellationToken): NotebookData | Thenable<NotebookData>;
        serializeNotebook(data: NotebookData, token: CancellationToken): Uint8Array | Thenable<Uint8Array>;
    }

    export namespace notebook {
        // todo@API remove output when notebook marks that as transient, same for metadata
        export function registerNotebookSerializer(
            notebookType: string,
            provider: NotebookSerializer,
            options?: NotebookDocumentContentOptions,
        ): Disposable;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/119949

    export interface NotebookFilter {
        readonly viewType?: string;
        readonly scheme?: string;
        readonly pattern?: GlobPattern;
    }

    export type NotebookSelector = NotebookFilter | string | ReadonlyArray<NotebookFilter | string>;

    export interface NotebookController {
        readonly id: string;

        // select notebook of a type and/or by file-pattern
        readonly selector: NotebookSelector;

        /**
         * A kernel can apply to one or many notebook documents but a notebook has only one active
         * kernel. This event fires whenever a notebook has been associated to a kernel or when
         * that association has been removed.
         */
        readonly onDidChangeNotebookAssociation: Event<{ notebook: NotebookDocument; selected: boolean }>;

        // UI properties (get/set)
        label: string;
        description?: string;
        isPreferred?: boolean;

        supportedLanguages: string[];
        hasExecutionOrder?: boolean;
        preloads?: NotebookKernelPreload[];

        /**
         * The execute handler is invoked when the run gestures in the UI are selected, e.g Run Cell, Run All,
         * Run Selection etc.
         */
        readonly executeHandler: (cells: NotebookCell[], controller: NotebookController) => void;

        // optional kernel interrupt command
        interruptHandler?: (notebook: NotebookDocument) => void;

        // remove kernel
        dispose(): void;

        /**
         * Manually create an execution task. This should only be used when cell execution
         * has started before creating the kernel instance or when execution can be triggered
         * from another source.
         *
         * @param cell The notebook cell for which to create the execution
         * @returns A notebook cell execution.
         */
        createNotebookCellExecutionTask(cell: NotebookCell): NotebookCellExecutionTask;

        // ipc
        readonly onDidReceiveMessage: Event<{ editor: NotebookEditor; message: any }>;
        postMessage(message: any, editor?: NotebookEditor): Thenable<boolean>;
        asWebviewUri(localResource: Uri, editor: NotebookEditor): Uri;
    }

    export interface NotebookControllerOptions {
        id: string;
        label: string;
        description?: string;
        selector: NotebookSelector;
        supportedLanguages?: string[];
        hasExecutionOrder?: boolean;
        executeHandler: (cells: NotebookCell[], controller: NotebookController) => void;
        interruptHandler?: (notebook: NotebookDocument) => void;
    }

    export namespace notebook {
        export function createNotebookController(options: NotebookControllerOptions): NotebookController;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookContentProvider

    interface NotebookDocumentBackup {
        /**
         * Unique identifier for the backup.
         *
         * This id is passed back to your extension in `openNotebook` when opening a notebook editor from a backup.
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
        readonly untitledDocumentData?: Uint8Array;
    }

    // todo@API use openNotebookDOCUMENT to align with openCustomDocument etc?
    // todo@API rename to NotebookDocumentContentProvider
    export interface NotebookContentProvider {
        readonly options?: NotebookDocumentContentOptions;
        readonly onDidChangeNotebookContentOptions?: Event<NotebookDocumentContentOptions>;

        /**
         * Content providers should always use [file system providers](#FileSystemProvider) to
         * resolve the raw content for `uri` as the resouce is not necessarily a file on disk.
         */
        openNotebook(
            uri: Uri,
            openContext: NotebookDocumentOpenContext,
            token: CancellationToken,
        ): NotebookData | Thenable<NotebookData>;

        // todo@API use NotebookData instead
        saveNotebook(document: NotebookDocument, token: CancellationToken): Thenable<void>;

        // todo@API use NotebookData instead
        saveNotebookAs(targetResource: Uri, document: NotebookDocument, token: CancellationToken): Thenable<void>;

        // todo@API use NotebookData instead
        backupNotebook(
            document: NotebookDocument,
            context: NotebookDocumentBackupContext,
            token: CancellationToken,
        ): Thenable<NotebookDocumentBackup>;
    }

    export namespace notebook {
        // TODO@api use NotebookDocumentFilter instead of just notebookType:string?
        // TODO@API options duplicates the more powerful variant on NotebookContentProvider
        export function registerNotebookContentProvider(
            notebookType: string,
            provider: NotebookContentProvider,
            options?: NotebookDocumentContentOptions & {
                /**
                 * Not ready for production or development use yet.
                 */
                viewOptions?: {
                    displayName: string;
                    filenamePattern: NotebookFilenamePattern[];
                    exclusive?: boolean;
                };
            },
        ): Disposable;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookKernel

    export interface NotebookKernelPreload {
        provides?: string | string[];
        uri: Uri;
    }

    export interface NotebookKernel {
        // todo@API make this mandatory?
        readonly id?: string;

        label: string;
        description?: string;
        detail?: string;
        isPreferred?: boolean;

        // todo@API do we need an preload change event?
        preloads?: NotebookKernelPreload[];

        /**
         * languages supported by kernel
         * - first is preferred
         * - `undefined` means all languages available in the editor
         */
        supportedLanguages?: string[];

        // todo@API kernel updating itself
        // fired when properties like the supported languages etc change
        // onDidChangeProperties?: Event<void>

        /**
         * A kernel can optionally implement this which will be called when any "cancel" button is clicked in the document.
         */
        interrupt?(document: NotebookDocument): void;

        /**
         * Called when the user triggers execution of a cell by clicking the run button for a cell, multiple cells,
         * or full notebook. The cell will be put into the Pending state when this method is called. If
         * createNotebookCellExecutionTask has not been called by the time the promise returned by this method is
         * resolved, the cell will be put back into the Idle state.
         */
        executeCellsRequest(document: NotebookDocument, ranges: NotebookRange[]): Thenable<void>;
    }

    export interface NotebookCellExecuteStartContext {
        /**
         * The time that execution began, in milliseconds in the Unix epoch. Used to drive the clock
         * that shows for how long a cell has been running. If not given, the clock won't be shown.
         */
        startTime?: number;
    }

    export interface NotebookCellExecuteEndContext {
        /**
         * If true, a green check is shown on the cell status bar.
         * If false, a red X is shown.
         */
        success?: boolean;

        /**
         * The time that execution finished, in milliseconds in the Unix epoch.
         */
        endTime?: number;
    }

    /**
     * A NotebookCellExecutionTask is how the kernel modifies a notebook cell as it is executing. When
     * [`createNotebookCellExecutionTask`](#notebook.createNotebookCellExecutionTask) is called, the cell
     * enters the Pending state. When `start()` is called on the execution task, it enters the Executing state. When
     * `end()` is called, it enters the Idle state. While in the Executing state, cell outputs can be
     * modified with the methods on the run task.
     *
     * All outputs methods operate on this NotebookCellExecutionTask's cell by default. They optionally take
     * a cellIndex parameter that allows them to modify the outputs of other cells. `appendOutputItems` and
     * `replaceOutputItems` operate on the output with the given ID, which can be an output on any cell. They
     * all resolve once the output edit has been applied.
     */
    export interface NotebookCellExecutionTask {
        readonly document: NotebookDocument;
        readonly cell: NotebookCell;

        start(context?: NotebookCellExecuteStartContext): void;
        executionOrder: number | undefined;
        end(result?: NotebookCellExecuteEndContext): void;
        readonly token: CancellationToken;

        clearOutput(cellIndex?: number): Thenable<void>;
        appendOutput(out: NotebookCellOutput | NotebookCellOutput[], cellIndex?: number): Thenable<void>;
        replaceOutput(out: NotebookCellOutput | NotebookCellOutput[], cellIndex?: number): Thenable<void>;
        appendOutputItems(items: NotebookCellOutputItem | NotebookCellOutputItem[], outputId: string): Thenable<void>;
        replaceOutputItems(items: NotebookCellOutputItem | NotebookCellOutputItem[], outputId: string): Thenable<void>;
    }

    //#region https://github.com/microsoft/vscode/issues/129037

    enum LanguageStatusSeverity {
        Information = 0,
        Warning = 1,
        Error = 2,
    }

    interface LanguageStatusItem {
        readonly id: string;
        selector: DocumentSelector;
        // todo@jrieken replace with boolean ala needsAttention
        severity: LanguageStatusSeverity;
        name: string | undefined;
        text: string;
        detail?: string;
        command: Command | undefined;
        accessibilityInformation?: AccessibilityInformation;
        dispose(): void;
    }

    namespace languages {
        export function createLanguageStatusItem(id: string, selector: DocumentSelector): LanguageStatusItem;
    }

    //#endregion

    export interface QuickPick<T extends QuickPickItem> extends QuickInput {
        /**
         * An optional flag to sort the final results by index of first query match in label. Defaults to true.
         */
        sortByLabel: boolean;

        /*
         * An optional flag that can be set to true to maintain the scroll position of the quick pick when the quick pick items are updated. Defaults to false.
         */
        keepScrollPosition?: boolean;
    }

    export enum NotebookCellExecutionState {
        Idle = 1,
        Pending = 2,
        Executing = 3,
    }

    export namespace notebook {
        /**
         * Creates a [`NotebookCellExecutionTask`](#NotebookCellExecutionTask). Should only be called by a kernel. Returns undefined unless requested by the active kernel.
         * @param uri The [uri](#Uri) of the notebook document.
         * @param index The index of the cell.
         * @param kernelId The id of the kernel requesting this run task. If this kernel is not the current active kernel, `undefined` is returned.
         */
        export function createNotebookCellExecutionTask(
            uri: Uri,
            index: number,
            kernelId: string,
        ): NotebookCellExecutionTask | undefined;

        export const onDidChangeCellExecutionState: Event<NotebookCellExecutionStateChangeEvent>;
    }

    export type NotebookFilenamePattern = GlobPattern | { include: GlobPattern; exclude: GlobPattern };

    // todo@API why not for NotebookContentProvider?
    export interface NotebookDocumentFilter {
        viewType?: string | string[];
        filenamePattern?: NotebookFilenamePattern;
    }

    // todo@API very unclear, provider MUST not return alive object but only data object
    // todo@API unclear how the flow goes
    export interface NotebookKernelProvider<T extends NotebookKernel = NotebookKernel> {
        onDidChangeKernels?: Event<NotebookDocument | undefined>;
        provideKernels(document: NotebookDocument, token: CancellationToken): ProviderResult<T[]>;
        resolveKernel?(
            kernel: T,
            document: NotebookDocument,
            webview: NotebookCommunication,
            token: CancellationToken,
        ): ProviderResult<void>;
    }

    export interface NotebookEditor {
        // todo@API unsure about that
        // kernel, kernel selection, kernel provider
        /** @deprecated kernels are private object*/
        readonly kernel?: NotebookKernel;
    }

    export namespace notebook {
        /** @deprecated */
        export const onDidChangeActiveNotebookKernel: Event<{
            document: NotebookDocument;
            kernel: NotebookKernel | undefined;
        }>;
        /** @deprecated use createNotebookKernel */
        export function registerNotebookKernelProvider(
            selector: NotebookDocumentFilter,
            provider: NotebookKernelProvider,
        ): Disposable;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookEditorDecorationType

    export interface NotebookEditor {
        setDecorations(decorationType: NotebookEditorDecorationType, range: NotebookRange): void;
    }

    export interface NotebookDecorationRenderOptions {
        backgroundColor?: string | ThemeColor;
        borderColor?: string | ThemeColor;
        top: ThemableDecorationAttachmentRenderOptions;
    }

    export interface NotebookEditorDecorationType {
        readonly key: string;
        dispose(): void;
    }

    export namespace notebook {
        export function createNotebookEditorDecorationType(
            options: NotebookDecorationRenderOptions,
        ): NotebookEditorDecorationType;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookCellStatusBarItem

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
        Right = 2,
    }

    export class NotebookCellStatusBarItem {
        readonly text: string;
        readonly alignment: NotebookCellStatusBarAlignment;
        readonly command?: string | Command;
        readonly tooltip?: string;
        readonly priority?: number;
        readonly accessibilityInformation?: AccessibilityInformation;

        constructor(
            text: string,
            alignment: NotebookCellStatusBarAlignment,
            command?: string | Command,
            tooltip?: string,
            priority?: number,
            accessibilityInformation?: AccessibilityInformation,
        );
    }

    interface NotebookCellStatusBarItemProvider {
        onDidChangeCellStatusBarItems?: Event<void>;
        provideCellStatusBarItems(
            cell: NotebookCell,
            token: CancellationToken,
        ): ProviderResult<NotebookCellStatusBarItem[]>;
    }

    export namespace notebook {
        export function registerNotebookCellStatusBarItemProvider(
            selector: NotebookDocumentFilter,
            provider: NotebookCellStatusBarItemProvider,
        ): Disposable;
    }

    //#endregion

    //#region https://github.com/microsoft/vscode/issues/106744, NotebookConcatTextDocument

    export namespace notebook {
        /**
         * Create a document that is the concatenation of all  notebook cells. By default all code-cells are included
         * but a selector can be provided to narrow to down the set of cells.
         *
         * @param notebook
         * @param selector
         */
        // @jrieken REMOVE. p_never
        // todo@API really needed? we didn't find a user here
        export function createConcatTextDocument(
            notebook: NotebookDocument,
            selector?: DocumentSelector,
        ): NotebookConcatTextDocument;
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

    //#endregion
    //#region proposed test APIs https://github.com/microsoft/vscode/issues/107467
    export namespace tests {
        /**
         * Returns an observer that watches and can request tests.
         */
        export function createTestObserver(): TestObserver;

        /**
         * Event that fires when the {@link testResults} array is updated.
         */
        export const onDidChangeTestResults: Event<void>;
    }

    export namespace workspace {
        /**
         * When true, the user has explicitly trusted the contents of the workspace.
         */
        export const isTrusted: boolean;

        /**
         * Event that fires when the current workspace has been trusted.
         */
        export const onDidGrantWorkspaceTrust: Event<void>;
    }

    export interface TestObserver {
        /**
         * List of tests returned by test provider for files in the workspace.
         */
        readonly tests: ReadonlyArray<TestItem>;

        /**
         * An event that fires when an existing test in the collection changes, or
         * null if a top-level test was added or removed. When fired, the consumer
         * should check the test item and all its children for changes.
         */
        readonly onDidChangeTest: Event<TestsChangeEvent>;

        /**
         * Dispose of the observer, allowing the editor to eventually tell test
         * providers that they no longer need to update tests.
         */
        dispose(): void;
    }

    export interface TestsChangeEvent {
        /**
         * List of all tests that are newly added.
         */
        readonly added: ReadonlyArray<TestItem>;

        /**
         * List of existing tests that have updated.
         */
        readonly updated: ReadonlyArray<TestItem>;

        /**
         * List of existing tests that have been removed.
         */
        readonly removed: ReadonlyArray<TestItem>;
    }

    /**
     * A test item is an item shown in the "test explorer" view. It encompasses
     * both a suite and a test, since they have almost or identical capabilities.
     */
    export interface TestItem {
        /**
         * Marks the test as outdated. This can happen as a result of file changes,
         * for example. In "auto run" mode, tests that are outdated will be
         * automatically rerun after a short delay. Invoking this on a
         * test with children will mark the entire subtree as outdated.
         *
         * Extensions should generally not override this method.
         */
        // todo@api still unsure about this
        invalidateResults(): void;
    }

    /**
     * Possible states of tests in a test run.
     */
    export enum TestResultState {
        // Test will be run, but is not currently running.
        Queued = 1,
        // Test is currently running
        Running = 2,
        // Test run has passed
        Passed = 3,
        // Test run has failed (on an assertion)
        Failed = 4,
        // Test run has been skipped
        Skipped = 5,
        // Test run failed for some other reason (compilation error, timeout, etc)
        Errored = 6,
    }

    //#endregion

    /**
     * Namespace for testing functionality. Tests are published by registering
     * {@link TestController} instances, then adding {@link TestItem}s.
     * Controllers may also describe how to run tests by creating one or more
     * {@link TestRunProfile} instances.
     */
    export namespace tests {
        /**
         * Creates a new test controller.
         *
         * @param id Identifier for the controller, must be globally unique.
         * @param label A human-readable label for the controller.
         * @returns An instance of the {@link TestController}.
         */
        export function createTestController(id: string, label: string): TestController;

        /**
         * List of test results stored by the editor, sorted in descending
         * order by their `completedAt` time.
         */
        export const testResults: ReadonlyArray<TestRunResult>;
    }

    /**
     * The kind of executions that {@link TestRunProfile TestRunProfiles} control.
     */
    export enum TestRunProfileKind {
        Run = 1,
        Debug = 2,
        Coverage = 3,
    }

    /**
     * A TestRunProfile describes one way to execute tests in a {@link TestController}.
     */
    export interface TestRunProfile {
        /**
         * Label shown to the user in the UI.
         *
         * Note that the label has some significance if the user requests that
         * tests be re-run in a certain way. For example, if tests were run
         * normally and the user requests to re-run them in debug mode, the editor
         * will attempt use a configuration with the same label of the `Debug`
         * kind. If there is no such configuration, the default will be used.
         */
        label: string;

        /**
         * Configures what kind of execution this profile controls. If there
         * are no profiles for a kind, it will not be available in the UI.
         */
        readonly kind: TestRunProfileKind;

        /**
         * Controls whether this profile is the default action that will
         * be taken when its kind is actioned. For example, if the user clicks
         * the generic "run all" button, then the default profile for
         * {@link TestRunProfileKind.Run} will be executed, although the
         * user can configure this.
         */
        isDefault: boolean;
        /**
         * Associated tag for the profile. If this is set, only {@link TestItem}
         * instances with the same tag will be eligible to execute in this profile.
         */
        tag?: TestTag;
        /**
         * If this method is present, a configuration gear will be present in the
         * UI, and this method will be invoked when it's clicked. When called,
         * you can take other editor actions, such as showing a quick pick or
         * opening a configuration file.
         */
        configureHandler?: () => void;

        /**
         * Handler called to start a test run. When invoked, the function should call
         * {@link TestController.createTestRun} at least once, and all test runs
         * associated with the request should be created before the function returns
         * or the returned promise is resolved.
         *
         * @param request Request information for the test run.
         * @param cancellationToken Token that signals the used asked to abort the
         * test run. If cancellation is requested on this token, all {@link TestRun}
         * instances associated with the request will be
         * automatically cancelled as well.
         */
        runHandler: (request: TestRunRequest, token: CancellationToken) => Thenable<void> | void;

        /**
         * Deletes the run profile.
         */
        dispose(): void;
    }

    /**
     * Entry point to discover and execute tests. It contains {@link items} which
     * are used to populate the editor UI, and is associated with
     * {@link createRunProfile | run profiles} to allow
     * for tests to be executed.
     */
    export interface TestController {
        /**
         * The id of the controller passed in {@link vscode.tests.createTestController}.
         * This must be globally unique.
         */
        readonly id: string;

        /**
         * Human-readable label for the test controller.
         */
        label: string;

        /**
         * Available test items. Tests in the workspace should be added in this
         * collection. The extension controls when to add these, although the
         * editor may request children using the {@link resolveHandler},
         * and the extension should add tests for a file when
         * {@link vscode.workspace.onDidOpenTextDocument} fires in order for
         * decorations for tests within a file to be visible.
         *
         * Tests in this collection should be watched and updated by the extension
         * as files change. See {@link resolveHandler} for details around
         * for the lifecycle of watches.
         */
        readonly items: TestItemCollection;

        /**
         * Creates a profile used for running tests. Extensions must create
         * at least one profile in order for tests to be run.
         * @param label A human-readable label for this profile.
         * @param kind Configures what kind of execution this profile manages.
         * @param runHandler Function called to start a test run.
         * @param isDefault Whether this is the default action for its kind.
         * @param tag Profile test tag.
         * @returns An instance of a {@link TestRunProfile}, which is automatically
         * associated with this controller.
         */
        createRunProfile(
            label: string,
            kind: TestRunProfileKind,
            runHandler: (request: TestRunRequest, token: CancellationToken) => Thenable<void> | void,
            isDefault?: boolean,
            tag?: TestTag,
        ): TestRunProfile;

        /**
         * A function provided by the extension that the editor may call to request
         * children of a test item, if the {@link TestItem.canResolveChildren} is
         * `true`. When called, the item should discover children and call
         * {@link vscode.tests.createTestItem} as children are discovered.
         *
         * Generally the extension manages the lifecycle of test items, but under
         * certain conditions the editor may request the children of a specific
         * item to be loaded. For example, if the user requests to re-run tests
         * after reloading the editor, the editor may need to call this method
         * to resolve the previously-run tests.
         *
         * The item in the explorer will automatically be marked as "busy" until
         * the function returns or the returned thenable resolves.
         *
         * @param item An unresolved test item for which children are being
         * requested, or `undefined` to resolve the controller's initial {@link items}.
         */
        resolveHandler?: (item: TestItem | undefined) => Thenable<void> | void;

        /**
         * Creates a {@link TestRun<T>}. This should be called by the
         * {@link TestRunProfile} when a request is made to execute tests, and may
         * also be called if a test run is detected externally. Once created, tests
         * that are included in the request will be moved into the queued state.
         *
         * All runs created using the same `request` instance will be grouped
         * together. This is useful if, for example, a single suite of tests is
         * run on multiple platforms.
         *
         * @param request Test run request. Only tests inside the `include` may be
         * modified, and tests in its `exclude` are ignored.
         * @param name The human-readable name of the run. This can be used to
         * disambiguate multiple sets of results in a test run. It is useful if
         * tests are run across multiple platforms, for example.
         * @param persist Whether the results created by the run should be
         * persisted in the editor. This may be false if the results are coming from
         * a file already saved externally, such as a coverage information file.
         * @returns An instance of the {@link TestRun}. It will be considered "running"
         * from the moment this method is invoked until {@link TestRun.end} is called.
         */
        createTestRun(request: TestRunRequest, name?: string, persist?: boolean): TestRun;

        /**
         * Creates a new managed {@link TestItem} instance. It can be added into
         * the {@link TestItem.children} of an existing item, or into the
         * {@link TestController.items}.
         *
         * @param id Identifier for the TestItem. The test item's ID must be unique
         * in the {@link TestItemCollection} it's added to.
         * @param label Human-readable label of the test item.
         * @param uri URI this TestItem is associated with. May be a file or directory.
         */
        createTestItem(id: string, label: string, uri?: Uri): TestItem;

        /**
         * Unregisters the test controller, disposing of its associated tests
         * and unpersisted results.
         */
        dispose(): void;
    }

    /**
     * Options given to {@link tests.runTests}.
     */
    export class TestRunRequest {
        /**
         * A filter for specific tests to run. If given, the extension should run
         * all of the included tests and all their children, excluding any tests
         * that appear in {@link TestRunRequest.exclude}. If this property is
         * undefined, then the extension should simply run all tests.
         *
         * The process of running tests should resolve the children of any test
         * items who have not yet been resolved.
         */
        include?: TestItem[];

        /**
         * An array of tests the user has marked as excluded from the test included
         * in this run; exclusions should apply after inclusions.
         *
         * May be omitted if no exclusions were requested. Test controllers should
         * not run excluded tests or any children of excluded tests.
         */
        exclude?: TestItem[];

        /**
         * The profile used for this request. This will always be defined
         * for requests issued from the editor UI, though extensions may
         * programmatically create requests not associated with any profile.
         */
        profile?: TestRunProfile;

        /**
         * @param tests Array of specific tests to run, or undefined to run all tests
         * @param exclude An array of tests to exclude from the run.
         * @param profile The run profile used for this request.
         */
        constructor(include?: readonly TestItem[], exclude?: readonly TestItem[], profile?: TestRunProfile);
    }

    /**
     * Options given to {@link TestController.runTests}
     */
    export interface TestRun {
        /**
         * The human-readable name of the run. This can be used to
         * disambiguate multiple sets of results in a test run. It is useful if
         * tests are run across multiple platforms, for example.
         */
        readonly name?: string;

        /**
         * A cancellation token which will be triggered when the test run is
         * canceled from the UI.
         */
        readonly token: CancellationToken;

        /**
         * Whether the test run will be persisted across reloads by the editor.
         */
        readonly isPersisted: boolean;

        /**
         * Indicates a test is queued for later execution.
         * @param test Test item to update.
         */
        enqueued(test: TestItem): void;

        /**
         * Indicates a test has started running.
         * @param test Test item to update.
         */
        started(test: TestItem): void;

        /**
         * Indicates a test has been skipped.
         * @param test Test item to update.
         */
        skipped(test: TestItem): void;

        /**
         * Indicates a test has failed. You should pass one or more
         * {@link TestMessage | TestMessages} to describe the failure.
         * @param test Test item to update.
         * @param messages Messages associated with the test failure.
         * @param duration How long the test took to execute, in milliseconds.
         */
        failed(test: TestItem, message: TestMessage | readonly TestMessage[], duration?: number): void;

        /**
         * Indicates a test has errored. You should pass one or more
         * {@link TestMessage | TestMessages} to describe the failure. This differs
         * from the "failed" state in that it indicates a test that couldn't be
         * executed at all, from a compilation error for example.
         * @param test Test item to update.
         * @param messages Messages associated with the test failure.
         * @param duration How long the test took to execute, in milliseconds.
         */
        errored(test: TestItem, message: TestMessage | readonly TestMessage[], duration?: number): void;

        /**
         * Indicates a test has passed.
         * @param test Test item to update.
         * @param duration How long the test took to execute, in milliseconds.
         */
        passed(test: TestItem, duration?: number): void;

        /**
         * Appends raw output from the test runner. On the user's request, the
         * output will be displayed in a terminal. ANSI escape sequences,
         * such as colors and text styles, are supported.
         *
         * @param output Output text to append.
         */
        appendOutput(output: string): void;

        /**
         * Signals that the end of the test run. Any tests included in the run whose
         * states have not been updated will have their state reset.
         */
        end(): void;
    }

    /**
     * Collection of test items, found in {@link TestItem.children} and
     * {@link TestController.items}.
     */
    export interface TestItemCollection {
        /**
         * Gets the number of items in the collection.
         */
        readonly size: number;

        /**
         * Replaces the items stored by the collection.
         * @param items Items to store.
         */
        replace(items: readonly TestItem[]): void;

        /**
         * Iterate over each entry in this collection.
         *
         * @param callback Function to execute for each entry.
         * @param thisArg The `this` context used when invoking the handler function.
         */
        forEach(callback: (item: TestItem, collection: TestItemCollection) => unknown, thisArg?: unknown): void;

        /**
         * Adds the test item to the children. If an item with the same ID already
         * exists, it'll be replaced.
         * @param items Item to add.
         */
        add(item: TestItem): void;

        /**
         * Removes the a single test item from the collection.
         * @param itemId Item ID to delete.
         */
        delete(itemId: string): void;

        /**
         * Efficiently gets a test item by ID, if it exists, in the children.
         * @param itemId Item ID to get.
         * @returns The found item, or undefined if it does not exist.
         */
        get(itemId: string): TestItem | undefined;
    }

    /**
     * A test item is an item shown in the "test explorer" view. It encompasses
     * both a suite and a test, since they simiular capabilities.
     */
    export interface TestItem {
        /**
         * Identifier for the TestItem. This is used to correlate
         * test results and tests in the document with those in the workspace
         * (test explorer). This cannot change for the lifetime of the TestItem,
         * and must be unique among its parent's direct children.
         */
        readonly id: string;

        /**
         * URI this TestItem is associated with. May be a file or directory.
         */
        readonly uri?: Uri;

        /**
         * The children of this test item. For a test suite, this may contain the
         * individual test cases, or nested suites.
         */
        readonly children: TestItemCollection;

        /**
         * The parent of this item. It's set automatically, and is undefined
         * top-level items in the {@link TestController.items} and for items that
         * aren't yet included in another item's {@link children}.
         */
        readonly parent?: TestItem;

        /**
         * Indicates whether this test item may have children discovered by resolving.
         * If so, it will be shown as expandable in the Test Explorer view, and
         * expanding the item will cause {@link TestController.resolveHandler}
         * to be invoked with the item.
         *
         * Default to `false`.
         */
        canResolveChildren: boolean;

        /**
         * Controls whether the item is shown as "busy" in the Test Explorer view.
         * This is useful for showing status while discovering children. Defaults
         * to false.
         */
        busy: boolean;

        /**
         * Display name describing the test case.
         */
        label: string;

        /**
         * Optional description that appears next to the label.
         */
        description?: string;

        /**
         * Location of the test item in its `uri`. This is only meaningful if the
         * `uri` points to a file.
         */
        range?: Range;

        /**
         * May be set to an error associated with loading the test. Note that this
         * is not a test result and should only be used to represent errors in
         * discovery, such as syntax errors.
         */
        error?: string | MarkdownString;

        /**
         * Tags associated with this test item. May be used in combination with
         * {@link TestRunProfile.tags}, or simply as an organizational feature.
         */
        tags: readonly TestTag[];
    }

    /**
     * Message associated with the test state. Can be linked to a specific
     * source range -- useful for assertion failures, for example.
     */
    export class TestMessage {
        /**
         * Human-readable message text to display.
         */
        message: string | MarkdownString;

        /**
         * Expected test output. If given with `actualOutput`, a diff view will be shown.
         */
        expectedOutput?: string;

        /**
         * Actual test output. If given with `expectedOutput`, a diff view will be shown.
         */
        actualOutput?: string;

        /**
         * Associated file location.
         */
        location?: Location;

        /**
         * Creates a new TestMessage that will present as a diff in the editor.
         * @param message Message to display to the user.
         * @param expected Expected output.
         * @param actual Actual output.
         */
        static diff(message: string | MarkdownString, expected: string, actual: string): TestMessage;

        /**
         * Creates a new TestMessage instance.
         * @param message The message to show to the user.
         */
        constructor(message: string | MarkdownString);
    }
    /**
     * TestResults can be provided to the editor in {@link tests.publishTestResult},
     * or read from it in {@link tests.testResults}.
     *
     * The results contain a 'snapshot' of the tests at the point when the test
     * run is complete. Therefore, information such as its {@link Range} may be
     * out of date. If the test still exists in the workspace, consumers can use
     * its `id` to correlate the result instance with the living test.
     */
    export interface TestRunResult {
        /**
         * Unix milliseconds timestamp at which the test run was completed.
         */
        readonly completedAt: number;

        /**
         * Optional raw output from the test run.
         */
        readonly output?: string;

        /**
         * List of test results. The items in this array are the items that
         * were passed in the {@link tests.runTests} method.
         */
        readonly results: ReadonlyArray<Readonly<TestResultSnapshot>>;
    }

    /**
     * Tags can be associated with {@link TestItem TestItems} and
     * {@link TestRunProfile TestRunProfiles}. A profile with a tag can only
     * execute tests that include that tag in their {@link TestItem.tags} array.
     */
    export class TestTag {
        /**
         * ID of the test tag. `TestTag` instances with the same ID are considered
         * to be identical.
         */
        readonly id: string;

        /**
         * Creates a new TestTag instance.
         * @param id ID of the test tag.
         */
        constructor(id: string);
    }

    /**
     * A {@link TestItem}-like interface with an associated result, which appear
     * or can be provided in {@link TestResult} interfaces.
     */
    export interface TestResultSnapshot {
        /**
         * Unique identifier that matches that of the associated TestItem.
         * This is used to correlate test results and tests in the document with
         * those in the workspace (test explorer).
         */
        readonly id: string;

        /**
         * Parent of this item.
         */
        readonly parent?: TestResultSnapshot;

        /**
         * URI this TestItem is associated with. May be a file or file.
         */
        readonly uri?: Uri;

        /**
         * Display name describing the test case.
         */
        readonly label: string;

        /**
         * Optional description that appears next to the label.
         */
        readonly description?: string;

        /**
         * Location of the test item in its `uri`. This is only meaningful if the
         * `uri` points to a file.
         */
        readonly range?: Range;

        /**
         * State of the test in each task. In the common case, a test will only
         * be executed in a single task and the length of this array will be 1.
         */
        readonly taskStates: ReadonlyArray<TestSnapshotTaskState>;

        /**
         * Optional list of nested tests for this item.
         */
        readonly children: Readonly<TestResultSnapshot>[];
    }

    export interface TestSnapshotTaskState {
        /**
         * Current result of the test.
         */
        readonly state: TestResultState;

        /**
         * The number of milliseconds the test took to run. This is set once the
         * `state` is `Passed`, `Failed`, or `Errored`.
         */
        readonly duration?: number;

        /**
         * Associated test run message. Can, for example, contain assertion
         * failure information if the test fails.
         */
        readonly messages: ReadonlyArray<TestMessage>;
    }
}
//#endregion
