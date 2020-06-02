// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
    Breakpoint,
    BreakpointsChangeEvent,
    CancellationToken,
    CompletionItemProvider,
    ConfigurationChangeEvent,
    DebugAdapterDescriptorFactory,
    DebugAdapterTrackerFactory,
    DebugConfiguration,
    DebugConfigurationProvider,
    DebugConsole,
    DebugSession,
    DebugSessionCustomEvent,
    DecorationRenderOptions,
    Disposable,
    DocumentSelector,
    Event,
    FileSystemWatcher,
    GlobPattern,
    InputBox,
    InputBoxOptions,
    MessageItem,
    MessageOptions,
    OpenDialogOptions,
    OutputChannel,
    Progress,
    ProgressOptions,
    QuickPick,
    QuickPickItem,
    QuickPickOptions,
    SaveDialogOptions,
    StatusBarAlignment,
    StatusBarItem,
    Terminal,
    TerminalOptions,
    TextDocument,
    TextDocumentChangeEvent,
    TextDocumentShowOptions,
    TextEditor,
    TextEditorDecorationType,
    TextEditorEdit,
    TextEditorOptionsChangeEvent,
    TextEditorSelectionChangeEvent,
    TextEditorViewColumnChangeEvent,
    TreeView,
    TreeViewOptions,
    Uri,
    ViewColumn,
    WebviewPanel,
    WebviewPanelOptions,
    WindowState,
    WorkspaceConfiguration,
    WorkspaceEdit,
    WorkspaceFolder,
    WorkspaceFolderPickOptions,
    WorkspaceFoldersChangeEvent
} from 'vscode';
import type {
    NotebookCellLanguageChangeEvent as VSCNotebookCellLanguageChangeEvent,
    NotebookCellOutputsChangeEvent as VSCNotebookCellOutputsChangeEvent,
    NotebookCellsChangeEvent as VSCNotebookCellsChangeEvent,
    NotebookContentProvider,
    NotebookDocument,
    NotebookEditor,
    NotebookKernel,
    NotebookOutputRenderer,
    NotebookOutputSelector
} from 'vscode-proposed';
import * as vsls from 'vsls/vscode';

import { IAsyncDisposable, Resource } from '../types';
import { ICommandNameArgumentTypeMapping } from './commands';

// tslint:disable:no-any unified-signatures

export const IApplicationShell = Symbol('IApplicationShell');
export interface IApplicationShell {
    /**
     * An [event](#Event) which fires when the focus state of the current window
     * changes. The value of the event represents whether the window is focused.
     */
    readonly onDidChangeWindowState: Event<WindowState>;

    showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;

    /**
     * Show an information message to users. Optionally provide an array of items which will be presented as
     * clickable buttons.
     *
     * @param message The message to show.
     * @param options Configures the behaviour of the message.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showInformationMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string | undefined>;

    /**
     * Show an information message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showInformationMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;

    /**
     * Show an information message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param options Configures the behaviour of the message.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showInformationMessage<T extends MessageItem>(
        message: string,
        options: MessageOptions,
        ...items: T[]
    ): Thenable<T | undefined>;

    /**
     * Show a warning message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined>;

    /**
     * Show a warning message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param options Configures the behaviour of the message.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showWarningMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string | undefined>;

    /**
     * Show a warning message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;

    /**
     * Show a warning message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param options Configures the behaviour of the message.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showWarningMessage<T extends MessageItem>(
        message: string,
        options: MessageOptions,
        ...items: T[]
    ): Thenable<T | undefined>;

    /**
     * Show an error message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined>;

    /**
     * Show an error message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param options Configures the behaviour of the message.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showErrorMessage(message: string, options: MessageOptions, ...items: string[]): Thenable<string | undefined>;

    /**
     * Show an error message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showErrorMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;

    /**
     * Show an error message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param options Configures the behaviour of the message.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showErrorMessage<T extends MessageItem>(
        message: string,
        options: MessageOptions,
        ...items: T[]
    ): Thenable<T | undefined>;

    /**
     * Shows a selection list.
     *
     * @param items An array of strings, or a promise that resolves to an array of strings.
     * @param options Configures the behavior of the selection list.
     * @param token A token that can be used to signal cancellation.
     * @return A promise that resolves to the selection or `undefined`.
     */
    showQuickPick(
        items: string[] | Thenable<string[]>,
        options?: QuickPickOptions,
        token?: CancellationToken
    ): Thenable<string | undefined>;

    /**
     * Shows a selection list.
     *
     * @param items An array of items, or a promise that resolves to an array of items.
     * @param options Configures the behavior of the selection list.
     * @param token A token that can be used to signal cancellation.
     * @return A promise that resolves to the selected item or `undefined`.
     */
    showQuickPick<T extends QuickPickItem>(
        items: T[] | Thenable<T[]>,
        options?: QuickPickOptions,
        token?: CancellationToken
    ): Thenable<T | undefined>;

    /**
     * Shows a file open dialog to the user which allows to select a file
     * for opening-purposes.
     *
     * @param options Options that control the dialog.
     * @returns A promise that resolves to the selected resources or `undefined`.
     */
    showOpenDialog(options: OpenDialogOptions): Thenable<Uri[] | undefined>;

    /**
     * Shows a file save dialog to the user which allows to select a file
     * for saving-purposes.
     *
     * @param options Options that control the dialog.
     * @returns A promise that resolves to the selected resource or `undefined`.
     */
    showSaveDialog(options: SaveDialogOptions): Thenable<Uri | undefined>;

    /**
     * Opens an input box to ask the user for input.
     *
     * The returned value will be `undefined` if the input box was canceled (e.g. pressing ESC). Otherwise the
     * returned value will be the string typed by the user or an empty string if the user did not type
     * anything but dismissed the input box with OK.
     *
     * @param options Configures the behavior of the input box.
     * @param token A token that can be used to signal cancellation.
     * @return A promise that resolves to a string the user provided or to `undefined` in case of dismissal.
     */
    showInputBox(options?: InputBoxOptions, token?: CancellationToken): Thenable<string | undefined>;

    /**
     * Creates a [QuickPick](#QuickPick) to let the user pick an item from a list
     * of items of type T.
     *
     * Note that in many cases the more convenient [window.showQuickPick](#window.showQuickPick)
     * is easier to use. [window.createQuickPick](#window.createQuickPick) should be used
     * when [window.showQuickPick](#window.showQuickPick) does not offer the required flexibility.
     *
     * @return A new [QuickPick](#QuickPick).
     */
    createQuickPick<T extends QuickPickItem>(): QuickPick<T>;

    /**
     * Creates a [InputBox](#InputBox) to let the user enter some text input.
     *
     * Note that in many cases the more convenient [window.showInputBox](#window.showInputBox)
     * is easier to use. [window.createInputBox](#window.createInputBox) should be used
     * when [window.showInputBox](#window.showInputBox) does not offer the required flexibility.
     *
     * @return A new [InputBox](#InputBox).
     */
    createInputBox(): InputBox;
    /**
     * Opens URL in a default browser.
     *
     * @param url Url to open.
     */
    openUrl(url: string): void;

    /**
     * Set a message to the status bar. This is a short hand for the more powerful
     * status bar [items](#window.createStatusBarItem).
     *
     * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
     * @param hideAfterTimeout Timeout in milliseconds after which the message will be disposed.
     * @return A disposable which hides the status bar message.
     */
    setStatusBarMessage(text: string, hideAfterTimeout: number): Disposable;

    /**
     * Set a message to the status bar. This is a short hand for the more powerful
     * status bar [items](#window.createStatusBarItem).
     *
     * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
     * @param hideWhenDone Thenable on which completion (resolve or reject) the message will be disposed.
     * @return A disposable which hides the status bar message.
     */
    setStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable;

    /**
     * Set a message to the status bar. This is a short hand for the more powerful
     * status bar [items](#window.createStatusBarItem).
     *
     * *Note* that status bar messages stack and that they must be disposed when no
     * longer used.
     *
     * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
     * @return A disposable which hides the status bar message.
     */
    setStatusBarMessage(text: string): Disposable;

    /**
     * Creates a status bar [item](#StatusBarItem).
     *
     * @param alignment The alignment of the item.
     * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
     * @return A new status bar item.
     */
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
    /**
     * Shows a selection list of [workspace folders](#workspace.workspaceFolders) to pick from.
     * Returns `undefined` if no folder is open.
     *
     * @param options Configures the behavior of the workspace folder list.
     * @return A promise that resolves to the workspace folder or `undefined`.
     */
    showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions): Thenable<WorkspaceFolder | undefined>;

    /**
     * Show progress in the editor. Progress is shown while running the given callback
     * and while the promise it returned isn't resolved nor rejected. The location at which
     * progress should show (and other details) is defined via the passed [`ProgressOptions`](#ProgressOptions).
     *
     * @param task A callback returning a promise. Progress state can be reported with
     * the provided [progress](#Progress)-object.
     *
     * To report discrete progress, use `increment` to indicate how much work has been completed. Each call with
     * a `increment` value will be summed up and reflected as overall progress until 100% is reached (a value of
     * e.g. `10` accounts for `10%` of work done).
     * Note that currently only `ProgressLocation.Notification` is capable of showing discrete progress.
     *
     * To monitor if the operation has been cancelled by the user, use the provided [`CancellationToken`](#CancellationToken).
     * Note that currently only `ProgressLocation.Notification` is supporting to show a cancel button to cancel the
     * long running operation.
     *
     * @return The thenable the task-callback returned.
     */
    withProgress<R>(
        options: ProgressOptions,
        task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => Thenable<R>
    ): Thenable<R>;

    /**
     * Show progress in the status bar with a custom icon instead of the default spinner.
     * Progress is shown while running the given callback and while the promise it returned isn't resolved nor rejected.
     * At the moment, progress can only be displayed in the status bar when using this method. If you want to
     * display it elsewhere, use `withProgress`.
     *
     * @param icon A valid Octicon.
     *
     * @param task A callback returning a promise. Progress state can be reported with
     * the provided [progress](#Progress)-object.
     *
     * To report discrete progress, use `increment` to indicate how much work has been completed. Each call with
     * a `increment` value will be summed up and reflected as overall progress until 100% is reached (a value of
     * e.g. `10` accounts for `10%` of work done).
     * Note that currently only `ProgressLocation.Notification` is capable of showing discrete progress.
     *
     * To monitor if the operation has been cancelled by the user, use the provided [`CancellationToken`](#CancellationToken).
     * Note that currently only `ProgressLocation.Notification` is supporting to show a cancel button to cancel the
     * long running operation.
     *
     * @return The thenable the task-callback returned.
     */
    withProgressCustomIcon<R>(
        icon: string,
        task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => Thenable<R>
    ): Thenable<R>;

    /**
     * Create a [TreeView](#TreeView) for the view contributed using the extension point `views`.
     * @param viewId Id of the view contributed using the extension point `views`.
     * @param options Options for creating the [TreeView](#TreeView)
     * @returns a [TreeView](#TreeView).
     */
    createTreeView<T>(viewId: string, options: TreeViewOptions<T>): TreeView<T>;

    /**
     * Creates a new [output channel](#OutputChannel) with the given name.
     *
     * @param name Human-readable string which will be used to represent the channel in the UI.
     */
    createOutputChannel(name: string): OutputChannel;
}

export const ICommandManager = Symbol('ICommandManager');

export interface ICommandManager {
    /**
     * Registers a command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Registering a command with an existing command identifier twice
     * will cause an error.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function.
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    registerCommand<E extends keyof ICommandNameArgumentTypeMapping, U extends ICommandNameArgumentTypeMapping[E]>(
        command: E,
        callback: (...args: U) => any,
        thisArg?: any
    ): Disposable;

    /**
     * Registers a text editor command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Text editor commands are different from ordinary [commands](#commands.registerCommand) as
     * they only execute when there is an active editor when the command is called. Also, the
     * command handler of an editor command has access to the active editor and to an
     * [edit](#TextEditorEdit)-builder.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function with access to an [editor](#TextEditor) and an [edit](#TextEditorEdit).
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    registerTextEditorCommand(
        command: string,
        callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void,
        thisArg?: any
    ): Disposable;

    /**
     * Executes the command denoted by the given command identifier.
     *
     * * *Note 1:* When executing an editor command not all types are allowed to
     * be passed as arguments. Allowed are the primitive types `string`, `boolean`,
     * `number`, `undefined`, and `null`, as well as [`Position`](#Position), [`Range`](#Range), [`Uri`](#Uri) and [`Location`](#Location).
     * * *Note 2:* There are no restrictions when executing commands that have been contributed
     * by extensions.
     *
     * @param command Identifier of the command to execute.
     * @param rest Parameters passed to the command function.
     * @return A thenable that resolves to the returned value of the given command. `undefined` when
     * the command handler function doesn't return anything.
     */
    executeCommand<T, E extends keyof ICommandNameArgumentTypeMapping, U extends ICommandNameArgumentTypeMapping[E]>(
        command: E,
        ...rest: U
    ): Thenable<T | undefined>;

    /**
     * Retrieve the list of all available commands. Commands starting an underscore are
     * treated as internal commands.
     *
     * @param filterInternal Set `true` to not see internal commands (starting with an underscore)
     * @return Thenable that resolves to a list of command ids.
     */
    getCommands(filterInternal?: boolean): Thenable<string[]>;
}

export const IDocumentManager = Symbol('IDocumentManager');

export interface IDocumentManager {
    /**
     * All text documents currently known to the system.
     *
     * @readonly
     */
    readonly textDocuments: readonly TextDocument[];
    /**
     * The currently active editor or `undefined`. The active editor is the one
     * that currently has focus or, when none has focus, the one that has changed
     * input most recently.
     */
    readonly activeTextEditor: TextEditor | undefined;

    /**
     * The currently visible editors or an empty array.
     */
    readonly visibleTextEditors: TextEditor[];

    /**
     * An [event](#Event) which fires when the [active editor](#window.activeTextEditor)
     * has changed. *Note* that the event also fires when the active editor changes
     * to `undefined`.
     */
    readonly onDidChangeActiveTextEditor: Event<TextEditor | undefined>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is changed. This usually happens
     * when the [contents](#TextDocument.getText) changes but also when other things like the
     * [dirty](#TextDocument.isDirty)-state changes.
     */
    readonly onDidChangeTextDocument: Event<TextDocumentChangeEvent>;

    /**
     * An [event](#Event) which fires when the array of [visible editors](#window.visibleTextEditors)
     * has changed.
     */
    readonly onDidChangeVisibleTextEditors: Event<TextEditor[]>;

    /**
     * An [event](#Event) which fires when the selection in an editor has changed.
     */
    readonly onDidChangeTextEditorSelection: Event<TextEditorSelectionChangeEvent>;

    /**
     * An [event](#Event) which fires when the options of an editor have changed.
     */
    readonly onDidChangeTextEditorOptions: Event<TextEditorOptionsChangeEvent>;

    /**
     * An [event](#Event) which fires when the view column of an editor has changed.
     */
    readonly onDidChangeTextEditorViewColumn: Event<TextEditorViewColumnChangeEvent>;

    /**
     * An event that is emitted when a [text document](#TextDocument) is opened.
     */
    readonly onDidOpenTextDocument: Event<TextDocument>;
    /**
     * An event that is emitted when a [text document](#TextDocument) is disposed.
     */
    readonly onDidCloseTextDocument: Event<TextDocument>;
    /**
     * An event that is emitted when a [text document](#TextDocument) is saved to disk.
     */
    readonly onDidSaveTextDocument: Event<TextDocument>;

    /**
     * Show the given document in a text editor. A [column](#ViewColumn) can be provided
     * to control where the editor is being shown. Might change the [active editor](#window.activeTextEditor).
     *
     * @param document A text document to be shown.
     * @param column A view column in which the [editor](#TextEditor) should be shown. The default is the [one](#ViewColumn.One), other values
     * are adjusted to be `Min(column, columnCount + 1)`, the [active](#ViewColumn.Active)-column is
     * not adjusted.
     * @param preserveFocus When `true` the editor will not take focus.
     * @return A promise that resolves to an [editor](#TextEditor).
     */
    showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): Thenable<TextEditor>;

    /**
     * Show the given document in a text editor. [Options](#TextDocumentShowOptions) can be provided
     * to control options of the editor is being shown. Might change the [active editor](#window.activeTextEditor).
     *
     * @param document A text document to be shown.
     * @param options [Editor options](#TextDocumentShowOptions) to configure the behavior of showing the [editor](#TextEditor).
     * @return A promise that resolves to an [editor](#TextEditor).
     */
    showTextDocument(document: TextDocument, options?: TextDocumentShowOptions): Thenable<TextEditor>;

    /**
     * A short-hand for `openTextDocument(uri).then(document => showTextDocument(document, options))`.
     *
     * @see [openTextDocument](#openTextDocument)
     *
     * @param uri A resource identifier.
     * @param options [Editor options](#TextDocumentShowOptions) to configure the behavior of showing the [editor](#TextEditor).
     * @return A promise that resolves to an [editor](#TextEditor).
     */
    showTextDocument(uri: Uri, options?: TextDocumentShowOptions): Thenable<TextEditor>;
    /**
     * Opens a document. Will return early if this document is already open. Otherwise
     * the document is loaded and the [didOpen](#workspace.onDidOpenTextDocument)-event fires.
     *
     * The document is denoted by an [uri](#Uri). Depending on the [scheme](#Uri.scheme) the
     * following rules apply:
     * * `file`-scheme: Open a file on disk, will be rejected if the file does not exist or cannot be loaded.
     * * `untitled`-scheme: A new file that should be saved on disk, e.g. `untitled:c:\frodo\new.js`. The language
     * will be derived from the file name.
     * * For all other schemes the registered text document content [providers](#TextDocumentContentProvider) are consulted.
     *
     * *Note* that the lifecycle of the returned document is owned by the editor and not by the extension. That means an
     * [`onDidClose`](#workspace.onDidCloseTextDocument)-event can occur at any time after opening it.
     *
     * @param uri Identifies the resource to open.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    openTextDocument(uri: Uri): Thenable<TextDocument>;

    /**
     * A short-hand for `openTextDocument(Uri.file(fileName))`.
     *
     * @see [openTextDocument](#openTextDocument)
     * @param fileName A name of a file on disk.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    openTextDocument(fileName: string): Thenable<TextDocument>;

    /**
     * Opens an untitled text document. The editor will prompt the user for a file
     * path when the document is to be saved. The `options` parameter allows to
     * specify the *language* and/or the *content* of the document.
     *
     * @param options Options to control how the document will be created.
     * @return A promise that resolves to a [document](#TextDocument).
     */
    openTextDocument(options?: { language?: string; content?: string }): Thenable<TextDocument>;
    /**
     * Make changes to one or many resources as defined by the given
     * [workspace edit](#WorkspaceEdit).
     *
     * When applying a workspace edit, the editor implements an 'all-or-nothing'-strategy,
     * that means failure to load one document or make changes to one document will cause
     * the edit to be rejected.
     *
     * @param edit A workspace edit.
     * @return A thenable that resolves when the edit could be applied.
     */
    applyEdit(edit: WorkspaceEdit): Thenable<boolean>;

    /**
     * Create a TextEditorDecorationType that can be used to add decorations to text editors.
     *
     * @param options Rendering options for the decoration type.
     * @return A new decoration type instance.
     */
    createTextEditorDecorationType(options: DecorationRenderOptions): TextEditorDecorationType;
}

export const IWorkspaceService = Symbol('IWorkspaceService');

export interface IWorkspaceService {
    /**
     * ~~The folder that is open in the editor. `undefined` when no folder
     * has been opened.~~
     *
     * @readonly
     */
    readonly rootPath: string | undefined;

    /**
     * List of workspace folders or `undefined` when no folder is open.
     * *Note* that the first entry corresponds to the value of `rootPath`.
     *
     * @readonly
     */
    readonly workspaceFolders: readonly WorkspaceFolder[] | undefined;

    /**
     * The location of the workspace file, for example:
     *
     * `file:///Users/name/Development/myProject.code-workspace`
     *
     * or
     *
     * `untitled:1555503116870`
     *
     * for a workspace that is untitled and not yet saved.
     *
     * Depending on the workspace that is opened, the value will be:
     *  * `undefined` when no workspace or  a single folder is opened
     *  * the path of the workspace file as `Uri` otherwise. if the workspace
     * is untitled, the returned URI will use the `untitled:` scheme
     *
     * The location can e.g. be used with the `vscode.openFolder` command to
     * open the workspace again after it has been closed.
     *
     * **Example:**
     * ```typescript
     * vscode.commands.executeCommand('vscode.openFolder', uriOfWorkspace);
     * ```
     *
     * **Note:** it is not advised to use `workspace.workspaceFile` to write
     * configuration data into the file. You can use `workspace.getConfiguration().update()`
     * for that purpose which will work both when a single folder is opened as
     * well as an untitled or saved workspace.
     */
    readonly workspaceFile: Resource;

    /**
     * An event that is emitted when a workspace folder is added or removed.
     */
    readonly onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;

    /**
     * An event that is emitted when the [configuration](#WorkspaceConfiguration) changed.
     */
    readonly onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
    /**
     * Whether a workspace folder exists
     * @type {boolean}
     * @memberof IWorkspaceService
     */
    readonly hasWorkspaceFolders: boolean;

    /**
     * Returns the [workspace folder](#WorkspaceFolder) that contains a given uri.
     * * returns `undefined` when the given uri doesn't match any workspace folder
     * * returns the *input* when the given uri is a workspace folder itself
     *
     * @param uri An uri.
     * @return A workspace folder or `undefined`
     */
    getWorkspaceFolder(uri: Resource): WorkspaceFolder | undefined;

    /**
     * Generate a key that's unique to the workspace folder (could be fsPath).
     * @param {(Uri | undefined)} resource
     * @returns {string}
     * @memberof IWorkspaceService
     */
    getWorkspaceFolderIdentifier(resource: Uri | undefined, defaultValue?: string): string;
    /**
     * Returns a path that is relative to the workspace folder or folders.
     *
     * When there are no [workspace folders](#workspace.workspaceFolders) or when the path
     * is not contained in them, the input is returned.
     *
     * @param pathOrUri A path or uri. When a uri is given its [fsPath](#Uri.fsPath) is used.
     * @param includeWorkspaceFolder When `true` and when the given path is contained inside a
     * workspace folder the name of the workspace is prepended. Defaults to `true` when there are
     * multiple workspace folders and `false` otherwise.
     * @return A path relative to the root or the input.
     */
    asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string;

    /**
     * Creates a file system watcher.
     *
     * A glob pattern that filters the file events on their absolute path must be provided. Optionally,
     * flags to ignore certain kinds of events can be provided. To stop listening to events the watcher must be disposed.
     *
     * *Note* that only files within the current [workspace folders](#workspace.workspaceFolders) can be watched.
     *
     * @param globPattern A [glob pattern](#GlobPattern) that is applied to the absolute paths of created, changed,
     * and deleted files. Use a [relative pattern](#RelativePattern) to limit events to a certain [workspace folder](#WorkspaceFolder).
     * @param ignoreCreateEvents Ignore when files have been created.
     * @param ignoreChangeEvents Ignore when files have been changed.
     * @param ignoreDeleteEvents Ignore when files have been deleted.
     * @return A new file system watcher instance.
     */
    createFileSystemWatcher(
        globPattern: GlobPattern,
        ignoreCreateEvents?: boolean,
        ignoreChangeEvents?: boolean,
        ignoreDeleteEvents?: boolean
    ): FileSystemWatcher;

    /**
     * Find files across all [workspace folders](#workspace.workspaceFolders) in the workspace.
     *
     * @sample `findFiles('**∕*.js', '**∕node_modules∕**', 10)`
     * @param include A [glob pattern](#GlobPattern) that defines the files to search for. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace. Use a [relative pattern](#RelativePattern)
     * to restrict the search results to a [workspace folder](#WorkspaceFolder).
     * @param exclude  A [glob pattern](#GlobPattern) that defines files and folders to exclude. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace.
     * @param maxResults An upper-bound for the result.
     * @param token A token that can be used to signal cancellation to the underlying search engine.
     * @return A thenable that resolves to an array of resource identifiers. Will return no results if no
     * [workspace folders](#workspace.workspaceFolders) are opened.
     */
    findFiles(
        include: GlobPattern,
        exclude?: GlobPattern,
        maxResults?: number,
        token?: CancellationToken
    ): Thenable<Uri[]>;

    /**
     * Get a workspace configuration object.
     *
     * When a section-identifier is provided only that part of the configuration
     * is returned. Dots in the section-identifier are interpreted as child-access,
     * like `{ myExt: { setting: { doIt: true }}}` and `getConfiguration('myExt.setting').get('doIt') === true`.
     *
     * When a resource is provided, configuration scoped to that resource is returned.
     *
     * @param section A dot-separated identifier.
     * @param resource A resource for which the configuration is asked for
     * @return The full configuration or a subset.
     */
    getConfiguration(section?: string, resource?: Uri): WorkspaceConfiguration;
}

export const ITerminalManager = Symbol('ITerminalManager');

export interface ITerminalManager {
    /**
     * An [event](#Event) which fires when a terminal is disposed.
     */
    readonly onDidCloseTerminal: Event<Terminal>;
    /**
     * An [event](#Event) which fires when a terminal has been created, either through the
     * [createTerminal](#window.createTerminal) API or commands.
     */
    readonly onDidOpenTerminal: Event<Terminal>;
    /**
     * Creates a [Terminal](#Terminal). The cwd of the terminal will be the workspace directory
     * if it exists, regardless of whether an explicit customStartPath setting exists.
     *
     * @param options A TerminalOptions object describing the characteristics of the new terminal.
     * @return A new Terminal.
     */
    createTerminal(options: TerminalOptions): Terminal;
}

export const IDebugService = Symbol('IDebugManager');

export interface IDebugService {
    /**
     * The currently active [debug session](#DebugSession) or `undefined`. The active debug session is the one
     * represented by the debug action floating window or the one currently shown in the drop down menu of the debug action floating window.
     * If no debug session is active, the value is `undefined`.
     */
    readonly activeDebugSession: DebugSession | undefined;

    /**
     * The currently active [debug console](#DebugConsole).
     */
    readonly activeDebugConsole: DebugConsole;

    /**
     * List of breakpoints.
     */
    readonly breakpoints: Breakpoint[];

    /**
     * An [event](#Event) which fires when the [active debug session](#debug.activeDebugSession)
     * has changed. *Note* that the event also fires when the active debug session changes
     * to `undefined`.
     */
    readonly onDidChangeActiveDebugSession: Event<DebugSession | undefined>;

    /**
     * An [event](#Event) which fires when a new [debug session](#DebugSession) has been started.
     */
    readonly onDidStartDebugSession: Event<DebugSession>;

    /**
     * An [event](#Event) which fires when a custom DAP event is received from the [debug session](#DebugSession).
     */
    readonly onDidReceiveDebugSessionCustomEvent: Event<DebugSessionCustomEvent>;

    /**
     * An [event](#Event) which fires when a [debug session](#DebugSession) has terminated.
     */
    readonly onDidTerminateDebugSession: Event<DebugSession>;

    /**
     * An [event](#Event) that is emitted when the set of breakpoints is added, removed, or changed.
     */
    readonly onDidChangeBreakpoints: Event<BreakpointsChangeEvent>;

    /**
     * Register a [debug configuration provider](#DebugConfigurationProvider) for a specific debug type.
     * More than one provider can be registered for the same type.
     *
     * @param type The debug type for which the provider is registered.
     * @param provider The [debug configuration provider](#DebugConfigurationProvider) to register.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    registerDebugConfigurationProvider(debugType: string, provider: DebugConfigurationProvider): Disposable;

    /**
     * Register a [debug adapter descriptor factory](#DebugAdapterDescriptorFactory) for a specific debug type.
     * An extension is only allowed to register a DebugAdapterDescriptorFactory for the debug type(s) defined by the extension. Otherwise an error is thrown.
     * Registering more than one DebugAdapterDescriptorFactory for a debug type results in an error.
     *
     * @param debugType The debug type for which the factory is registered.
     * @param factory The [debug adapter descriptor factory](#DebugAdapterDescriptorFactory) to register.
     * @return A [disposable](#Disposable) that unregisters this factory when being disposed.
     */
    registerDebugAdapterDescriptorFactory(debugType: string, factory: DebugAdapterDescriptorFactory): Disposable;

    /**
     * Register a debug adapter tracker factory for the given debug type.
     *
     * @param debugType The debug type for which the factory is registered or '*' for matching all debug types.
     * @param factory The [debug adapter tracker factory](#DebugAdapterTrackerFactory) to register.
     * @return A [disposable](#Disposable) that unregisters this factory when being disposed.
     */
    registerDebugAdapterTrackerFactory(debugType: string, factory: DebugAdapterTrackerFactory): Disposable;

    /**
     * Start debugging by using either a named launch or named compound configuration,
     * or by directly passing a [DebugConfiguration](#DebugConfiguration).
     * The named configurations are looked up in '.vscode/launch.json' found in the given folder.
     * Before debugging starts, all unsaved files are saved and the launch configurations are brought up-to-date.
     * Folder specific variables used in the configuration (e.g. '${workspaceFolder}') are resolved against the given folder.
     * @param folder The [workspace folder](#WorkspaceFolder) for looking up named configurations and resolving variables or `undefined` for a non-folder setup.
     * @param nameOrConfiguration Either the name of a debug or compound configuration or a [DebugConfiguration](#DebugConfiguration) object.
     * @return A thenable that resolves when debugging could be successfully started.
     */
    startDebugging(
        folder: WorkspaceFolder | undefined,
        nameOrConfiguration: string | DebugConfiguration,
        parentSession?: DebugSession
    ): Thenable<boolean>;

    /**
     * Add breakpoints.
     * @param breakpoints The breakpoints to add.
     */
    addBreakpoints(breakpoints: Breakpoint[]): void;

    /**
     * Remove breakpoints.
     * @param breakpoints The breakpoints to remove.
     */
    removeBreakpoints(breakpoints: Breakpoint[]): void;
}

export const IApplicationEnvironment = Symbol('IApplicationEnvironment');
export interface IApplicationEnvironment {
    /**
     * The application name of the editor, like 'VS Code'.
     *
     * @readonly
     */
    readonly appName: string;

    /**
     * The extension name.
     *
     * @readonly
     */
    readonly extensionName: string;

    /**
     * The application root folder from which the editor is running.
     *
     * @readonly
     */
    readonly appRoot: string;

    /**
     * Represents the preferred user-language, like `de-CH`, `fr`, or `en-US`.
     *
     * @readonly
     */
    readonly language: string;

    /**
     * A unique identifier for the computer.
     *
     * @readonly
     */
    readonly machineId: string;

    /**
     * A unique identifier for the current session.
     * Changes each time the editor is started.
     *
     * @readonly
     */
    readonly sessionId: string;
    /**
     * Contents of `package.json` as a JSON object.
     *
     * @type {any}
     * @memberof IApplicationEnvironment
     */
    readonly packageJson: any;
    /**
     * Gets the full path to the user settings file. (may or may not exist).
     *
     * @type {string}
     * @memberof IApplicationShell
     */
    readonly userSettingsFile: string | undefined;
    /**
     * The detected default shell for the extension host, this is overridden by the
     * `terminal.integrated.shell` setting for the extension host's platform.
     *
     * @type {string}
     * @memberof IApplicationShell
     */
    readonly shell: string;
    /**
     * Gets the vscode channel (whether 'insiders' or 'stable').
     */
    readonly channel: Channel;
    /**
     * Gets the extension channel (whether 'insiders' or 'stable').
     *
     * @type {string}
     * @memberof IApplicationShell
     */
    readonly extensionChannel: Channel;
    /**
     * The version of the editor.
     */
    readonly vscodeVersion: string;
}

export const IWebPanelMessageListener = Symbol('IWebPanelMessageListener');
export interface IWebPanelMessageListener extends IAsyncDisposable {
    /**
     * Listens to web panel messages
     * @param message: the message being sent
     * @param payload: extra data that came with the message
     * @return A IWebPanel that can be used to show html pages.
     */
    onMessage(message: string, payload: any): void;
    /**
     * Listens to web panel state changes
     */
    onChangeViewState(panel: IWebPanel): void;
}

export type WebPanelMessage = {
    /**
     * Message type
     */
    type: string;

    /**
     * Payload
     */
    payload?: any;
};

// Wraps the VS Code webview panel
export const IWebPanel = Symbol('IWebPanel');
export interface IWebPanel {
    /**
     * Convert a uri for the local file system to one that can be used inside webviews.
     *
     * Webviews cannot directly load resources from the workspace or local file system using `file:` uris. The
     * `asWebviewUri` function takes a local `file:` uri and converts it into a uri that can be used inside of
     * a webview to load the same resource:
     *
     * ```ts
     * webview.html = `<img src="${webview.asWebviewUri(vscode.Uri.file('/Users/codey/workspace/cat.gif'))}">`
     * ```
     */
    asWebviewUri(localResource: Uri): Uri;
    setTitle(val: string): void;
    /**
     * Makes the webpanel show up.
     * @return A Promise that can be waited on
     */
    show(preserveFocus: boolean): Promise<void>;

    /**
     * Indicates if this web panel is visible or not.
     */
    isVisible(): boolean;

    /**
     * Sends a message to the hosted html page
     */
    postMessage(message: WebPanelMessage): void;

    /**
     * Attempts to close the panel if it's visible
     */
    close(): void;
    /**
     * Indicates if the webview has the focus or not.
     */
    isActive(): boolean;
    /**
     * Updates the current working directory for serving up files.
     * @param cwd
     */
    updateCwd(cwd: string): void;
}

export interface IWebPanelOptions {
    viewColumn: ViewColumn;
    listener: IWebPanelMessageListener;
    title: string;
    rootPath: string;
    /**
     * Additional paths apart from cwd and rootPath, that webview would allow loading resources/files from.
     * E.g. required for webview to serve images from worksapces when nb is in a nested folder.
     */
    additionalPaths?: string[];
    scripts: string[];
    startHttpServer: boolean;
    cwd: string;
    // tslint:disable-next-line: no-any
    settings?: any;
    // Web panel to use if supplied by VS code instead
    webViewPanel?: WebviewPanel;
}

// Wraps the VS Code api for creating a web panel
export const IWebPanelProvider = Symbol('IWebPanelProvider');
export interface IWebPanelProvider {
    /**
     * Creates a new webpanel
     *
     * @param {IWebPanelOptions} options - params for creating an IWebPanel
     * @returns {IWebPanel}
     * @memberof IWebPanelProvider
     */
    create(options: IWebPanelOptions): Promise<IWebPanel>;
}

// Wraps the vsls liveshare API
export const ILiveShareApi = Symbol('ILiveShareApi');
export interface ILiveShareApi {
    getApi(): Promise<vsls.LiveShare | null>;
}

// Wraps the liveshare api for testing
export const ILiveShareTestingApi = Symbol('ILiveShareTestingApi');
export interface ILiveShareTestingApi extends ILiveShareApi {
    isSessionStarted: boolean;
    forceRole(role: vsls.Role): void;
    startSession(): Promise<void>;
    stopSession(): Promise<void>;
    disableGuestChecker(): void;
}

export const ILanguageService = Symbol('ILanguageService');
export interface ILanguageService {
    /**
     * Register a completion provider.
     *
     * Multiple providers can be registered for a language. In that case providers are sorted
     * by their [score](#languages.match) and groups of equal score are sequentially asked for
     * completion items. The process stops when one or many providers of a group return a
     * result. A failing provider (rejected promise or exception) will not fail the whole
     * operation.
     *
     * @param selector A selector that defines the documents this provider is applicable to.
     * @param provider A completion provider.
     * @param triggerCharacters Trigger completion when the user types one of the characters, like `.` or `:`.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    registerCompletionItemProvider(
        selector: DocumentSelector,
        provider: CompletionItemProvider,
        ...triggerCharacters: string[]
    ): Disposable;
}

export type Channel = 'stable' | 'insiders';

/**
 * Wraps the `ActiveResourceService` API class. Created for injecting and mocking class methods in testing
 */
export const IActiveResourceService = Symbol('IActiveResourceService');
export interface IActiveResourceService {
    getActiveResource(): Resource;
}

// Temporary hack to get the nyc compiler to find these types. vscode.proposed.d.ts doesn't work for some reason.
//#region Custom editors: https://github.com/microsoft/vscode/issues/77131

// tslint:disable: interface-name
/**
 * Defines the editing capability of a custom webview editor. This allows the webview editor to hook into standard
 * editor events such as `undo` or `save`.
 *
 * @param EditType Type of edits.
 */
export interface CustomEditorEditingDelegate<EditType = unknown> {
    /**
     * Event triggered by extensions to signal to VS Code that an edit has occurred.
     */
    readonly onDidEdit: Event<CustomDocumentEditEvent<EditType>>;
    /**
     * Save the resource.
     *
     * @param document Document to save.
     * @param cancellation Token that signals the save is no longer required (for example, if another save was triggered).
     *
     * @return Thenable signaling that the save has completed.
     */
    save(document: CustomDocument, cancellation: CancellationToken): Thenable<void>;

    /**
     * Save the existing resource at a new path.
     *
     * @param document Document to save.
     * @param targetResource Location to save to.
     *
     * @return Thenable signaling that the save has completed.
     */
    saveAs(document: CustomDocument, targetResource: Uri): Thenable<void>;

    /**
     * Apply a set of edits.
     *
     * Note that is not invoked when `onDidEdit` is called because `onDidEdit` implies also updating the view to reflect the edit.
     *
     * @param document Document to apply edits to.
     * @param edit Array of edits. Sorted from oldest to most recent.
     *
     * @return Thenable signaling that the change has completed.
     */
    applyEdits(document: CustomDocument, edits: readonly EditType[]): Thenable<void>;

    /**
     * Undo a set of edits.
     *
     * This is triggered when a user undoes an edit.
     *
     * @param document Document to undo edits from.
     * @param edit Array of edits. Sorted from most recent to oldest.
     *
     * @return Thenable signaling that the change has completed.
     */
    undoEdits(document: CustomDocument, edits: readonly EditType[]): Thenable<void>;

    /**
     * Revert the file to its last saved state.
     *
     * @param document Document to revert.
     * @param edits Added or applied edits.
     *
     * @return Thenable signaling that the change has completed.
     */
    revert(document: CustomDocument, edits: CustomDocumentRevert<EditType>): Thenable<void>;

    /**
     * Back up the resource in its current state.
     *
     * Backups are used for hot exit and to prevent data loss. Your `backup` method should persist the resource in
     * its current state, i.e. with the edits applied. Most commonly this means saving the resource to disk in
     * the `ExtensionContext.storagePath`. When VS Code reloads and your custom editor is opened for a resource,
     * your extension should first check to see if any backups exist for the resource. If there is a backup, your
     * extension should load the file contents from there instead of from the resource in the workspace.
     *
     * `backup` is triggered whenever an edit it made. Calls to `backup` are debounced so that if multiple edits are
     * made in quick succession, `backup` is only triggered after the last one. `backup` is not invoked when
     * `auto save` is enabled (since auto save already persists resource ).
     *
     * @param document Document to revert.
     * @param cancellation Token that signals the current backup since a new backup is coming in. It is up to your
     * extension to decided how to respond to cancellation. If for example your extension is backing up a large file
     * in an operation that takes time to complete, your extension may decide to finish the ongoing backup rather
     * than cancelling it to ensure that VS Code has some valid backup.
     */
    backup(document: CustomDocument, cancellation: CancellationToken): Thenable<void>;
}

/**
 * Event triggered by extensions to signal to VS Code that an edit has occurred on a CustomDocument``.
 */
export interface CustomDocumentEditEvent<EditType = unknown> {
    /**
     * Document the edit is for.
     */
    readonly document: CustomDocument;

    /**
     * Object that describes the edit.
     *
     * Edit objects are passed back to your extension in `undoEdits`, `applyEdits`, and `revert`.
     */
    readonly edit: EditType;

    /**
     * Display name describing the edit.
     */
    readonly label?: string;
}

/**
 * Data about a revert for a `CustomDocument`.
 */
export interface CustomDocumentRevert<EditType = unknown> {
    /**
     * List of edits that were undone to get the document back to its on disk state.
     */
    readonly undoneEdits: readonly EditType[];

    /**
     * List of edits that were reapplied to get the document back to its on disk state.
     */
    readonly appliedEdits: readonly EditType[];
}

/**
 * Represents a custom document used by a `CustomEditorProvider`.
 *
 * Custom documents are only used within a given `CustomEditorProvider`. The lifecycle of a
 * `CustomDocument` is managed by VS Code. When no more references remain to a given `CustomDocument`,
 * then it is disposed of.
 *
 * @param UserDataType Type of custom object that extensions can store on the document.
 */
export interface CustomDocument<UserDataType = unknown> {
    /**
     * The associated viewType for this document.
     */
    readonly viewType: string;

    /**
     * The associated uri for this document.
     */
    readonly uri: Uri;

    /**
     * Event fired when there are no more references to the `CustomDocument`.
     */
    readonly onDidDispose: Event<void>;

    /**
     * Custom data that an extension can store on the document.
     */
    userData?: UserDataType;
}

/**
 * Provider for webview editors that use a custom data model.
 *
 * Custom webview editors use [`CustomDocument`](#CustomDocument) as their data model.
 * This gives extensions full control over actions such as edit, save, and backup.
 *
 * You should use custom text based editors when dealing with binary files or more complex scenarios. For simple text
 * based documents, use [`WebviewTextEditorProvider`](#WebviewTextEditorProvider) instead.
 */
export interface CustomEditorProvider {
    /**
     * Defines the editing capability of a custom webview document.
     *
     * When not provided, the document is considered readonly.
     */
    readonly editingDelegate?: CustomEditorEditingDelegate;
    /**
     * Resolve the model for a given resource.
     *
     * `resolveCustomDocument` is called when the first editor for a given resource is opened, and the resolve document
     * is passed to `resolveCustomEditor`. The resolved `CustomDocument` is re-used for subsequent editor opens.
     * If all editors for a given resource are closed, the `CustomDocument` is disposed of. Opening an editor at
     * this point will trigger another call to `resolveCustomDocument`.
     *
     * @param document Document to resolve.
     *
     * @return The capabilities of the resolved document.
     */
    resolveCustomDocument(document: CustomDocument): Thenable<void>;

    /**
     * Resolve a webview editor for a given resource.
     *
     * This is called when a user first opens a resource for a `CustomTextEditorProvider`, or if they reopen an
     * existing editor using this `CustomTextEditorProvider`.
     *
     * To resolve a webview editor, the provider must fill in its initial html content and hook up all
     * the event listeners it is interested it. The provider can also hold onto the `WebviewPanel` to use later,
     * for example in a command. See [`WebviewPanel`](#WebviewPanel) for additional details
     *
     * @param document Document for the resource being resolved.
     * @param webviewPanel Webview to resolve.
     *
     * @return Thenable indicating that the webview editor has been resolved.
     */
    resolveCustomEditor(document: CustomDocument, webviewPanel: WebviewPanel): Thenable<void>;
}

/**
 * Provider for text based webview editors.
 *
 * Text based webview editors use a [`TextDocument`](#TextDocument) as their data model. This considerably simplifies
 * implementing a webview editor as it allows VS Code to handle many common operations such as
 * undo and backup. The provider is responsible for synchronizing text changes between the webview and the `TextDocument`.
 *
 * You should use text based webview editors when dealing with text based file formats, such as `xml` or `json`.
 * For binary files or more specialized use cases, see [CustomEditorProvider](#CustomEditorProvider).
 */
export interface CustomTextEditorProvider {
    /**
     * Resolve a webview editor for a given text resource.
     *
     * This is called when a user first opens a resource for a `CustomTextEditorProvider`, or if they reopen an
     * existing editor using this `CustomTextEditorProvider`.
     *
     * To resolve a webview editor, the provider must fill in its initial html content and hook up all
     * the event listeners it is interested it. The provider can also hold onto the `WebviewPanel` to use later,
     * for example in a command. See [`WebviewPanel`](#WebviewPanel) for additional details.
     *
     * @param document Document for the resource to resolve.
     * @param webviewPanel Webview to resolve.
     *
     * @return Thenable indicating that the webview editor has been resolved.
     */
    resolveCustomTextEditor(document: TextDocument, webviewPanel: WebviewPanel): Thenable<void>;
}

//#endregion

export const ICustomEditorService = Symbol('ICustomEditorService');
export interface ICustomEditorService {
    /**
     * Register a new provider for webview editors of a given type.
     *
     * @param viewType  Type of the webview editor provider.
     * @param provider Resolves webview editors.
     * @param options Content settings for a webview panels the provider is given.
     *
     * @return Disposable that unregisters the `WebviewCustomEditorProvider`.
     */
    registerCustomEditorProvider(
        viewType: string,
        provider: CustomEditorProvider,
        options?: WebviewPanelOptions
    ): Disposable;
    /**
     * Opens a file with a custom editor
     */
    openEditor(file: Uri, viewType: string): Promise<void>;
}

export const IClipboard = Symbol('IClipboard');
export interface IClipboard {
    /**
     * Read the current clipboard contents as text.
     */
    readText(): Promise<string>;

    /**
     * Writes text into the clipboard.
     */
    writeText(value: string): Promise<void>;
}

export type NotebookCellsChangeEvent = { type: 'changeCells' } & VSCNotebookCellsChangeEvent;
export type NotebookCellOutputsChangeEvent = { type: 'changeCellOutputs' } & VSCNotebookCellOutputsChangeEvent;
export type NotebookCellLanguageChangeEvent = { type: 'changeCellLanguage' } & VSCNotebookCellLanguageChangeEvent;

export const IVSCodeNotebook = Symbol('IVSCodeNotebook');
export interface IVSCodeNotebook {
    readonly onDidOpenNotebookDocument: Event<NotebookDocument>;
    readonly onDidCloseNotebookDocument: Event<NotebookDocument>;
    readonly onDidChangeActiveNotebookEditor: Event<NotebookEditor | undefined>;
    readonly onDidChangeNotebookDocument: Event<
        NotebookCellsChangeEvent | NotebookCellOutputsChangeEvent | NotebookCellLanguageChangeEvent
    >;
    readonly notebookEditors: Readonly<NotebookEditor[]>;
    readonly activeNotebookEditor: NotebookEditor | undefined;
    registerNotebookContentProvider(notebookType: string, provider: NotebookContentProvider): Disposable;

    registerNotebookKernel(id: string, selectors: GlobPattern[], kernel: NotebookKernel): Disposable;

    registerNotebookOutputRenderer(
        id: string,
        outputSelector: NotebookOutputSelector,
        renderer: NotebookOutputRenderer
    ): Disposable;
}
