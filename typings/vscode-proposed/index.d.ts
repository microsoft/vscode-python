// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable */

import {
    Event,
    GlobPattern,
    Uri,
    TextDocument,
    ViewColumn,
    CancellationToken,
    Disposable,
    DocumentSelector,
    ProviderResult,
    Range,
    WorkspaceEditEntryMetadata,
    Command,
    AccessibilityInformation,
    Position,
    Location,
    ThemableDecorationAttachmentRenderOptions,
    ThemeColor,
} from 'vscode';
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
    readonly viewType: string;

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
