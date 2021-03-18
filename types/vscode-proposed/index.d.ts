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
    Position,
    ProviderResult,
    Range,
    WorkspaceEditEntryMetadata,
    Command,
    AccessibilityInformation,
    Location,
    ThemeColor,
    ThemableDecorationAttachmentRenderOptions,
} from 'vscode';

//#region https://github.com/microsoft/vscode/issues/106744, Notebooks (misc)

export enum NotebookCellKind {
    Markdown = 1,
    Code = 2,
}

export enum NotebookCellRunState {
    Running = 1,
    Idle = 2,
    Success = 3,
    Error = 4,
}

export enum NotebookRunState {
    Running = 1,
    Idle = 2,
}

export class NotebookCellMetadata {
    /**
     * Controls whether a cell's editor is editable/readonly.
     */
    readonly editable?: boolean;
    /**
     * Controls if the cell has a margin to support the breakpoint UI.
     * This metadata is ignored for markdown cell.
     */
    readonly breakpointMargin?: boolean;
    /**
     * Whether a code cell's editor is collapsed
     */
    readonly outputCollapsed?: boolean;
    /**
     * Whether a code cell's outputs are collapsed
     */
    readonly inputCollapsed?: boolean;
    /**
     * Additional attributes of a cell metadata.
     */
    readonly custom?: Record<string, any>;

    // todo@API duplicates status bar API
    readonly statusMessage?: string;

    // run related API, will be removed
    readonly hasExecutionOrder?: boolean;
    readonly executionOrder?: number;
    readonly runState?: NotebookCellRunState;
    readonly runStartTime?: number;
    readonly lastRunDuration?: number;

    constructor(
        editable?: boolean,
        breakpointMargin?: boolean,
        hasExecutionOrder?: boolean,
        executionOrder?: number,
        runState?: NotebookCellRunState,
        runStartTime?: number,
        statusMessage?: string,
        lastRunDuration?: number,
        inputCollapsed?: boolean,
        outputCollapsed?: boolean,
        custom?: Record<string, any>,
    );

    with(change: {
        editable?: boolean | null;
        breakpointMargin?: boolean | null;
        hasExecutionOrder?: boolean | null;
        executionOrder?: number | null;
        runState?: NotebookCellRunState | null;
        runStartTime?: number | null;
        statusMessage?: string | null;
        lastRunDuration?: number | null;
        inputCollapsed?: boolean | null;
        outputCollapsed?: boolean | null;
        custom?: Record<string, any> | null;
    }): NotebookCellMetadata;
}

// todo@API support ids https://github.com/jupyter/enhancement-proposals/blob/master/62-cell-id/cell-id.md
export interface NotebookCell {
    readonly index: number;
    readonly notebook: NotebookDocument;
    readonly kind: NotebookCellKind;
    readonly document: TextDocument;
    readonly metadata: NotebookCellMetadata;
    readonly outputs: ReadonlyArray<NotebookCellOutput>;
}

export class NotebookDocumentMetadata {
    /**
     * Controls if users can add or delete cells
     * Defaults to true
     */
    readonly editable: boolean;
    /**
     * Default value for [cell editable metadata](#NotebookCellMetadata.editable).
     * Defaults to true.
     */
    readonly cellEditable: boolean;
    /**
     * Additional attributes of the document metadata.
     */
    readonly custom: { [key: string]: any };
    /**
     * Whether the document is trusted, default to true
     * When false, insecure outputs like HTML, JavaScript, SVG will not be rendered.
     */
    readonly trusted: boolean;

    // todo@API is this a kernel property?
    readonly cellHasExecutionOrder: boolean;

    // todo@API remove
    readonly runState: NotebookRunState;

    constructor(
        editable?: boolean,
        cellEditable?: boolean,
        cellHasExecutionOrder?: boolean,
        custom?: { [key: string]: any },
        runState?: NotebookRunState,
        trusted?: boolean,
    );

    with(change: {
        editable?: boolean | null;
        cellEditable?: boolean | null;
        cellHasExecutionOrder?: boolean | null;
        custom?: { [key: string]: any } | null;
        runState?: NotebookRunState | null;
        trusted?: boolean | null;
    }): NotebookDocumentMetadata;
}

export interface NotebookDocumentContentOptions {
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

export interface NotebookDocument {
    readonly uri: Uri;
    readonly version: number;

    // todo@API don't have this...
    readonly fileName: string;

    readonly isDirty: boolean;
    readonly isUntitled: boolean;
    readonly cells: ReadonlyArray<NotebookCell>;

    readonly metadata: NotebookDocumentMetadata;

    // todo@API should we really expose this?
    readonly viewType: string;

    /**
     * Save the document. The saving will be handled by the corresponding content provider
     *
     * @return A promise that will resolve to true when the document
     * has been saved. If the file was not dirty or the save failed,
     * will return false.
     */
    save(): Thenable<boolean>;
}

// todo@API maybe have a NotebookCellPosition sibling
export class NotebookCellRange {
    readonly start: number;
    /**
     * exclusive
     */
    readonly end: number;

    isEmpty: boolean;

    constructor(start: number, end: number);
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
     * The primary selected cell on this notebook editor.
     */
    // todo@API should not be undefined, rather a default
    readonly selection?: NotebookCell;

    /**
     * todo@API should replace selection
     * The selections on this notebook editor.
     *
     * The primary selection (or focused range) is `selections[0]`. When the document has no cells, the primary selection is empty `{ start: 0, end: 0 }`;
     */
    readonly selections: NotebookCellRange[];

    /**
     * The current visible ranges in the editor (vertically).
     */
    readonly visibleRanges: NotebookCellRange[];

    revealRange(range: NotebookCellRange, revealType?: NotebookEditorRevealType): void;

    /**
     * The column in which this editor shows.
     */
    // @jrieken
    // this is not implemented...
    readonly viewColumn?: ViewColumn;

    /**
     * Fired when the panel is disposed.
     */
    // @rebornix REMOVE/REplace NotebookCommunication
    // todo@API fishy? notebooks are public objects, there should be a "global" events for this
    readonly onDidDispose: Event<void>;
}

export interface NotebookDocumentMetadataChangeEvent {
    readonly document: NotebookDocument;
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
    readonly selections: ReadonlyArray<NotebookCellRange>;
}

export interface NotebookEditorVisibleRangesChangeEvent {
    readonly notebookEditor: NotebookEditor;
    readonly visibleRanges: ReadonlyArray<NotebookCellRange>;
}

// todo@API support ids https://github.com/jupyter/enhancement-proposals/blob/master/62-cell-id/cell-id.md
export class NotebookCellData {
    kind: NotebookCellKind;
    // todo@API better names: value? text?
    source: string;
    // todo@API how does language and MD relate?
    language: string;
    outputs?: NotebookCellOutput[];
    metadata?: NotebookCellMetadata;
    constructor(
        kind: NotebookCellKind,
        source: string,
        language: string,
        outputs?: NotebookCellOutput[],
        metadata?: NotebookCellMetadata,
    );
}

export class NotebookData {
    cells: NotebookCellData[];
    metadata?: NotebookDocumentMetadata;
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
    selection?: NotebookCellRange;
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

    // todo@API remove! against separation of data provider and renderer
    // eslint-disable-next-line vscode-dts-cancellation
    resolveNotebook(document: NotebookDocument, webview: NotebookCommunication): Thenable<void>;

    /**
     * Content providers should always use [file system providers](#FileSystemProvider) to
     * resolve the raw content for `uri` as the resouce is not necessarily a file on disk.
     */
    openNotebook(
        uri: Uri,
        openContext: NotebookDocumentOpenContext,
        token: CancellationToken,
    ): NotebookData | Thenable<NotebookData>;

    saveNotebook(document: NotebookDocument, token: CancellationToken): Thenable<void>;

    saveNotebookAs(targetResource: Uri, document: NotebookDocument, token: CancellationToken): Thenable<void>;

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

// todo@API use the NotebookCellExecution-object as a container to model and enforce
// the flow of a cell execution

// kernel -> execute_info
// ext -> createNotebookCellExecution(cell)
// kernel -> done
// exec.dispose();

// export interface NotebookCellExecution {
// 	dispose(): void;
// 	clearOutput(): void;
// 	appendOutput(out: NotebookCellOutput): void;
// 	replaceOutput(out: NotebookCellOutput): void;
//  appendOutputItems(output:string, items: NotebookCellOutputItem[]):void;
//  replaceOutputItems(output:string, items: NotebookCellOutputItem[]):void;
// }

// export function createNotebookCellExecution(cell: NotebookCell, startTime?: number): NotebookCellExecution;
// export const onDidStartNotebookCellExecution: Event<any>;
// export const onDidStopNotebookCellExecution: Event<any>;

export interface NotebookKernel {
    // todo@API make this mandatory?
    readonly id?: string;

    label: string;
    description?: string;
    detail?: string;
    isPreferred?: boolean;

    // todo@API is this maybe an output property?
    preloads?: Uri[];

    /**
     * languages supported by kernel
     * - first is preferred
     * - `undefined` means all languages available in the editor
     */
    supportedLanguages?: string[];

    // todo@API kernel updating itself
    // fired when properties like the supported languages etc change
    // onDidChangeProperties?: Event<void>

    // @roblourens
    // todo@API change to `executeCells(document: NotebookDocument, cells: NotebookCellRange[], context:{isWholeNotebooke: boolean}, token: CancelationToken): void;`
    // todo@API interrupt vs cancellation, https://github.com/microsoft/vscode/issues/106741
    // interrupt?():void;
    executeCell(document: NotebookDocument, cell: NotebookCell): void;
    cancelCellExecution(document: NotebookDocument, cell: NotebookCell): void;
    executeAllCells(document: NotebookDocument): void;
    cancelAllCellsExecution(document: NotebookDocument): void;
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
    /**
     * Active kernel used in the editor
     */
    // todo@API unsure about that
    // kernel, kernel selection, kernel provider
    readonly kernel?: NotebookKernel;
}

export namespace notebook {
    export const onDidChangeActiveNotebookKernel: Event<{
        document: NotebookDocument;
        kernel: NotebookKernel | undefined;
    }>;

    export function registerNotebookKernelProvider(
        selector: NotebookDocumentFilter,
        provider: NotebookKernelProvider,
    ): Disposable;
}

//#endregion

//#region https://github.com/microsoft/vscode/issues/106744, NotebookEditorDecorationType

export interface NotebookEditor {
    setDecorations(decorationType: NotebookEditorDecorationType, range: NotebookCellRange): void;
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
    /**
     * Creates a notebook cell status bar [item](#NotebookCellStatusBarItem).
     * It will be disposed automatically when the notebook document is closed or the cell is deleted.
     *
     * @param cell The cell on which this item should be shown.
     * @param alignment The alignment of the item.
     * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
     * @return A new status bar item.
     */
    // @roblourens
    // todo@API this should be a provider, https://github.com/microsoft/vscode/issues/105809
    export function createCellStatusBarItem(
        cell: NotebookCell,
        alignment?: NotebookCellStatusBarAlignment,
        priority?: number,
    ): NotebookCellStatusBarItem;
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

/**
 * A DebugProtocolVariableContainer is an opaque stand-in type for the intersection of the Scope and Variable types defined in the Debug Adapter Protocol.
 * See https://microsoft.github.io/debug-adapter-protocol/specification#Types_Scope and https://microsoft.github.io/debug-adapter-protocol/specification#Types_Variable.
 */
export interface DebugProtocolVariableContainer {
    // Properties: the intersection of DAP's Scope and Variable types.
}

/**
 * A DebugProtocolVariable is an opaque stand-in type for the Variable type defined in the Debug Adapter Protocol.
 * See https://microsoft.github.io/debug-adapter-protocol/specification#Types_Variable.
 */
export interface DebugProtocolVariable {
    // Properties: see details [here](https://microsoft.github.io/debug-adapter-protocol/specification#Base_Protocol_Variable).
}
// #endregion
