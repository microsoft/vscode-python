// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import type { Session } from '@jupyterlab/services';
import type { Kernel, KernelMessage } from '@jupyterlab/services/lib/kernel';
import type { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import {
    CancellationToken,
    CodeLens,
    CodeLensProvider,
    DebugConfiguration,
    DebugSession,
    Disposable,
    Event,
    Range,
    TextDocument,
    TextEditor,
    Uri,
    WebviewPanel
} from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import type { Data as WebSocketData } from 'ws';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { ICommandManager, IDebugService } from '../common/application/types';
import { ExecutionResult, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { IAsyncDisposable, IDataScienceSettings, IDisposable, Resource } from '../common/types';
import { StopWatch } from '../common/utils/stopWatch';
import { PythonInterpreter } from '../interpreter/contracts';
import { JupyterCommands } from './constants';
import { NotebookModelChange } from './interactive-common/interactiveWindowTypes';
import { JupyterServerInfo } from './jupyter/jupyterConnection';
import { JupyterInstallError } from './jupyter/jupyterInstallError';
import { JupyterKernelSpec } from './jupyter/kernels/jupyterKernelSpec';
import { LiveKernelModel } from './jupyter/kernels/types';

// tslint:disable-next-line:no-any
export type PromiseFunction = (...any: any[]) => Promise<any>;

// Main interface
export const IDataScience = Symbol('IDataScience');
export interface IDataScience extends Disposable {
    activationStartTime: number;
    activate(): Promise<void>;
}

export const IDataScienceCommandListener = Symbol('IDataScienceCommandListener');
export interface IDataScienceCommandListener {
    register(commandManager: ICommandManager): void;
}

export interface IRawConnection extends Disposable {
    readonly type: 'raw';
    readonly localLaunch: true;
    readonly valid: boolean;
    readonly displayName: string;
    disconnected: Event<number>;
}

export interface IJupyterConnection extends Disposable {
    readonly type: 'jupyter';
    readonly localLaunch: boolean;
    readonly valid: boolean;
    readonly displayName: string;
    disconnected: Event<number>;

    // Jupyter specific members
    readonly baseUrl: string;
    readonly token: string;
    readonly hostName: string;
    localProcExitCode: number | undefined;
    allowUnauthorized?: boolean;
}

export type INotebookProviderConnection = IRawConnection | IJupyterConnection;

export enum InterruptResult {
    Success = 0,
    TimedOut = 1,
    Restarted = 2
}

// Information used to execute a notebook
export interface INotebookExecutionInfo {
    // Connection to what has provided our notebook, such as a jupyter
    // server or a raw ZMQ kernel
    connectionInfo: INotebookProviderConnection;
    /**
     * The python interpreter associated with the kernel.
     */
    interpreter: PythonInterpreter | undefined;
    uri: string | undefined; // Different from the connectionInfo as this is the setting used, not the result
    kernelSpec: IJupyterKernelSpec | undefined | LiveKernelModel;
    workingDir: string | undefined;
    purpose: string | undefined; // Purpose this server is for
}

// Information used to launch a jupyter notebook server

// Information used to launch a notebook server
export interface INotebookServerLaunchInfo {
    connectionInfo: IJupyterConnection;
    /**
     * The python interpreter associated with the kernel.
     *
     * @type {(PythonInterpreter | undefined)}
     * @memberof INotebookServerLaunchInfo
     */
    interpreter: PythonInterpreter | undefined;
    uri: string | undefined; // Different from the connectionInfo as this is the setting used, not the result
    kernelSpec: IJupyterKernelSpec | undefined | LiveKernelModel;
    workingDir: string | undefined;
    purpose: string | undefined; // Purpose this server is for
}

export interface INotebookCompletion {
    matches: ReadonlyArray<string>;
    cursor: {
        start: number;
        end: number;
    };
    metadata: {};
}

// Talks to a jupyter ipython kernel to retrieve data for cells
export const INotebookServer = Symbol('INotebookServer');
export interface INotebookServer extends IAsyncDisposable {
    readonly id: string;
    createNotebook(
        resource: Resource,
        identity: Uri,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<INotebook>;
    getNotebook(identity: Uri, cancelToken?: CancellationToken): Promise<INotebook | undefined>;
    connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void>;
    getConnectionInfo(): IJupyterConnection | undefined;
    waitForConnect(): Promise<INotebookServerLaunchInfo | undefined>;
    shutdown(): Promise<void>;
}

// Provides notebooks that talk directly to kernels as opposed to a jupyter server
export const IRawNotebookProvider = Symbol('IRawNotebookProvider');
export interface IRawNotebookProvider extends IAsyncDisposable {
    supported(): Promise<boolean>;
    connect(token?: CancellationToken): Promise<IRawConnection>;
    createNotebook(
        identity: Uri,
        resource: Resource,
        disableUI?: boolean,
        notebookMetadata?: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<INotebook>;
    getNotebook(identity: Uri, token?: CancellationToken): Promise<INotebook | undefined>;
}

// Provides notebooks that talk to jupyter servers
export const IJupyterNotebookProvider = Symbol('IJupyterNotebookProvider');
export interface IJupyterNotebookProvider {
    connect(options: ConnectNotebookProviderOptions): Promise<IJupyterConnection | undefined>;
    createNotebook(options: GetNotebookOptions): Promise<INotebook>;
    getNotebook(options: GetNotebookOptions): Promise<INotebook | undefined>;
    disconnect(options: ConnectNotebookProviderOptions): Promise<void>;
}

export interface INotebook extends IAsyncDisposable {
    readonly resource: Resource;
    readonly connection: INotebookProviderConnection | undefined;
    kernelSocket: Observable<KernelSocketInformation | undefined>;
    readonly identity: Uri;
    readonly status: ServerStatus;
    onSessionStatusChanged: Event<ServerStatus>;
    onDisposed: Event<void>;
    onKernelChanged: Event<IJupyterKernelSpec | LiveKernelModel>;
    onKernelRestarted: Event<void>;
    clear(id: string): void;
    executeObservable(code: string, file: string, line: number, id: string, silent: boolean): Observable<ICell[]>;
    execute(
        code: string,
        file: string,
        line: number,
        id: string,
        cancelToken?: CancellationToken,
        silent?: boolean
    ): Promise<ICell[]>;
    inspect(code: string, cancelToken?: CancellationToken): Promise<JSONObject>;
    getCompletion(
        cellCode: string,
        offsetInCode: number,
        cancelToken?: CancellationToken
    ): Promise<INotebookCompletion>;
    restartKernel(timeoutInMs: number): Promise<void>;
    waitForIdle(timeoutInMs: number): Promise<void>;
    interruptKernel(timeoutInMs: number): Promise<InterruptResult>;
    setLaunchingFile(file: string): Promise<void>;
    getSysInfo(): Promise<ICell | undefined>;
    setMatplotLibStyle(useDark: boolean): Promise<void>;
    getMatchingInterpreter(): PythonInterpreter | undefined;
    getKernelSpec(): IJupyterKernelSpec | LiveKernelModel | undefined;
    setKernelSpec(
        spec: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number,
        interpreter: PythonInterpreter | undefined
    ): Promise<void>;
    getLoggers(): INotebookExecutionLogger[];
    registerIOPubListener(listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => Promise<void>): void;
    registerCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void;
    sendCommMessage(
        buffers: (ArrayBuffer | ArrayBufferView)[],
        content: { comm_id: string; data: JSONObject; target_name: string | undefined },
        // tslint:disable-next-line: no-any
        metadata: any,
        // tslint:disable-next-line: no-any
        msgId: any
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<'comm_msg'>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    >;
    requestCommInfo(content: KernelMessage.ICommInfoRequestMsg['content']): Promise<KernelMessage.ICommInfoReplyMsg>;
    registerMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void;
    removeMessageHook(msgId: string, hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void;
}

// Options for connecting to a notebook provider
export type ConnectNotebookProviderOptions = {
    getOnly?: boolean;
    disableUI?: boolean;
    localOnly?: boolean;
    token?: CancellationToken;
};

export interface INotebookServerOptions {
    uri?: string;
    usingDarkTheme?: boolean;
    skipUsingDefaultConfig?: boolean;
    workingDir?: string;
    purpose: string;
    metadata?: nbformat.INotebookMetadata;
    disableUI?: boolean;
    skipSearchingForKernel?: boolean;
    allowUI(): boolean;
}

export const INotebookExecutionLogger = Symbol('INotebookExecutionLogger');
export interface INotebookExecutionLogger extends IDisposable {
    preExecute(cell: ICell, silent: boolean): Promise<void>;
    postExecute(cell: ICell, silent: boolean): Promise<void>;
    onKernelRestarted(): void;
    preHandleIOPub?(msg: KernelMessage.IIOPubMessage): KernelMessage.IIOPubMessage;
}

export const IGatherProvider = Symbol('IGatherProvider');
export interface IGatherProvider {
    enabled: boolean;
    logExecution(vscCell: ICell): void;
    gatherCode(vscCell: ICell): string;
    resetLog(): void;
}

export const IGatherLogger = Symbol('IGatherLogger');
export interface IGatherLogger extends INotebookExecutionLogger {
    getGatherProvider(): IGatherProvider;
}

export const IJupyterExecution = Symbol('IJupyterExecution');
export interface IJupyterExecution extends IAsyncDisposable {
    sessionChanged: Event<void>;
    serverStarted: Event<INotebookServerOptions>;
    isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean>;
    isImportSupported(cancelToken?: CancellationToken): Promise<boolean>;
    isSpawnSupported(cancelToken?: CancellationToken): Promise<boolean>;
    connectToNotebookServer(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined>;
    spawnNotebook(file: string): Promise<void>;
    importNotebook(file: string, template: string | undefined): Promise<string>;
    getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined>;
    getServer(options?: INotebookServerOptions): Promise<INotebookServer | undefined>;
    getNotebookError(): Promise<string>;
    refreshCommands(): Promise<void>;
}

export const IJupyterDebugger = Symbol('IJupyterDebugger');
export interface IJupyterDebugger {
    startRunByLine(notebook: INotebook, cellHashFileName: string): Promise<void>;
    startDebugging(notebook: INotebook): Promise<void>;
    stopDebugging(notebook: INotebook): Promise<void>;
    onRestart(notebook: INotebook): void;
}

export interface IJupyterPasswordConnectInfo {
    emptyPassword: boolean;
    xsrfCookie: string;
    sessionCookieName: string;
    sessionCookieValue: string;
}

export const IJupyterPasswordConnect = Symbol('IJupyterPasswordConnect');
export interface IJupyterPasswordConnect {
    getPasswordConnectionInfo(
        url: string,
        allowUnauthorized: boolean
    ): Promise<IJupyterPasswordConnectInfo | undefined>;
}

export const IJupyterSession = Symbol('IJupyterSession');
export interface IJupyterSession extends IAsyncDisposable {
    onSessionStatusChanged: Event<ServerStatus>;
    readonly status: ServerStatus;
    readonly kernelSocket: Observable<KernelSocketInformation | undefined>;
    restart(timeout: number): Promise<void>;
    interrupt(timeout: number): Promise<void>;
    waitForIdle(timeout: number): Promise<void>;
    requestExecute(
        content: KernelMessage.IExecuteRequestMsg['content'],
        disposeOnDone?: boolean,
        metadata?: JSONObject
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined;
    requestComplete(
        content: KernelMessage.ICompleteRequestMsg['content']
    ): Promise<KernelMessage.ICompleteReplyMsg | undefined>;
    requestInspect(
        content: KernelMessage.IInspectRequestMsg['content']
    ): Promise<KernelMessage.IInspectReplyMsg | undefined>;
    sendInputReply(content: string): void;
    changeKernel(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number,
        interpreter?: PythonInterpreter
    ): Promise<void>;
    registerCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void;
    sendCommMessage(
        buffers: (ArrayBuffer | ArrayBufferView)[],
        content: { comm_id: string; data: JSONObject; target_name: string | undefined },
        // tslint:disable-next-line: no-any
        metadata: any,
        // tslint:disable-next-line: no-any
        msgId: any
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<'comm_msg'>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    >;
    requestCommInfo(content: KernelMessage.ICommInfoRequestMsg['content']): Promise<KernelMessage.ICommInfoReplyMsg>;
    registerMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void;
    removeMessageHook(msgId: string, hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void;
}

export type ISessionWithSocket = Session.ISession & {
    // Whether this is a remote session that we attached to.
    isRemoteSession?: boolean;
    // Socket information used for hooking messages to the kernel
    kernelSocketInformation?: KernelSocketInformation;
};

export const IJupyterSessionManagerFactory = Symbol('IJupyterSessionManagerFactory');
export interface IJupyterSessionManagerFactory {
    create(connInfo: IJupyterConnection, failOnPassword?: boolean): Promise<IJupyterSessionManager>;
}

export interface IJupyterSessionManager extends IAsyncDisposable {
    startNew(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        cancelToken?: CancellationToken
    ): Promise<IJupyterSession>;
    getKernelSpecs(): Promise<IJupyterKernelSpec[]>;
    getConnInfo(): IJupyterConnection;
    getRunningKernels(): Promise<IJupyterKernel[]>;
    getRunningSessions(): Promise<Session.IModel[]>;
}

export interface IJupyterKernel {
    /**
     * Id of an existing (active) Kernel from an active session.
     *
     * @type {string}
     * @memberof IJupyterKernel
     */
    id?: string;
    name: string;
    lastActivityTime: Date;
    numberOfConnections: number;
}

export interface IJupyterKernelSpec {
    /**
     * Id of an existing (active) Kernel from an active session.
     *
     * @type {string}
     * @memberof IJupyterKernel
     */
    id?: string;
    name: string;
    language: string;
    path: string;
    env: NodeJS.ProcessEnv | undefined;
    /**
     * Kernel display name.
     *
     * @type {string}
     * @memberof IJupyterKernelSpec
     */
    readonly display_name: string;
    /**
     * A dictionary of additional attributes about this kernel; used by clients to aid in kernel selection.
     * Optionally storing the interpreter information in the metadata (helping extension search for kernels that match an interpereter).
     */
    // tslint:disable-next-line: no-any
    readonly metadata?: Record<string, any> & { interpreter?: Partial<PythonInterpreter> };
    readonly argv: string[];
}

export const INotebookImporter = Symbol('INotebookImporter');
export interface INotebookImporter extends Disposable {
    importFromFile(contentsFile: string, originalFile?: string): Promise<string>; // originalFile is the base file if file is a temp file / location
    importCellsFromFile(file: string): Promise<ICell[]>;
    importCells(json: string): Promise<ICell[]>;
}

export const INotebookExporter = Symbol('INotebookExporter');
export interface INotebookExporter extends Disposable {
    translateToNotebook(cells: ICell[], directoryChange?: string): Promise<nbformat.INotebookContent | undefined>;
    exportToFile(cells: ICell[], file: string): Promise<void>;
}

export const IInteractiveWindowProvider = Symbol('IInteractiveWindowProvider');
export interface IInteractiveWindowProvider {
    readonly onDidChangeActiveInteractiveWindow: Event<IInteractiveWindow | undefined>;
    onExecutedCode: Event<string>;
    getActive(): IInteractiveWindow | undefined;
    getOrCreateActive(): Promise<IInteractiveWindow>;
}

export const IDataScienceErrorHandler = Symbol('IDataScienceErrorHandler');
export interface IDataScienceErrorHandler {
    handleError(err: Error): Promise<void>;
}

/**
 * Given a local resource this will convert the Uri into a form such that it can be used in a WebView.
 */
export interface ILocalResourceUriConverter {
    /**
     * Root folder that scripts should be copied to.
     */
    readonly rootScriptFolder: Uri;
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
    asWebviewUri(localResource: Uri): Promise<Uri>;
}

export interface IInteractiveBase extends Disposable {
    onExecutedCode: Event<string>;
    notebook?: INotebook;
    show(): Promise<void>;
    startProgress(): void;
    stopProgress(): void;
    undoCells(): void;
    redoCells(): void;
    removeAllCells(): void;
    interruptKernel(): Promise<void>;
    restartKernel(): Promise<void>;
}

export const IInteractiveWindow = Symbol('IInteractiveWindow');
export interface IInteractiveWindow extends IInteractiveBase {
    readonly onDidChangeViewState: Event<void>;
    readonly visible: boolean;
    readonly active: boolean;
    closed: Event<IInteractiveWindow>;
    addCode(
        code: string,
        file: string,
        line: number,
        editor?: TextEditor,
        runningStopWatch?: StopWatch
    ): Promise<boolean>;
    addMessage(message: string): Promise<void>;
    debugCode(
        code: string,
        file: string,
        line: number,
        editor?: TextEditor,
        runningStopWatch?: StopWatch
    ): Promise<boolean>;
    expandAllCells(): void;
    collapseAllCells(): void;
    exportCells(): void;
    scrollToCell(id: string): void;
}

// For native editing, the provider acts like the IDocumentManager for normal docs
export const INotebookEditorProvider = Symbol('INotebookEditorProvider');
export interface INotebookEditorProvider {
    readonly activeEditor: INotebookEditor | undefined;
    readonly editors: INotebookEditor[];
    readonly onDidOpenNotebookEditor: Event<INotebookEditor>;
    readonly onDidChangeActiveNotebookEditor: Event<INotebookEditor | undefined>;
    readonly onDidCloseNotebookEditor: Event<INotebookEditor>;
    open(file: Uri): Promise<INotebookEditor>;
    show(file: Uri): Promise<INotebookEditor | undefined>;
    createNew(contents?: string): Promise<INotebookEditor>;
}

// For native editing, the INotebookEditor acts like a TextEditor and a TextDocument together
export const INotebookEditor = Symbol('INotebookEditor');
export interface INotebookEditor extends IInteractiveBase {
    readonly onDidChangeViewState: Event<void>;
    readonly closed: Event<INotebookEditor>;
    readonly executed: Event<INotebookEditor>;
    readonly modified: Event<INotebookEditor>;
    readonly saved: Event<INotebookEditor>;
    /**
     * Is this notebook representing an untitled file which has never been saved yet.
     */
    readonly isUntitled: boolean;
    /**
     * `true` if there are unpersisted changes.
     */
    readonly isDirty: boolean;
    readonly file: Uri;
    readonly visible: boolean;
    readonly active: boolean;
    readonly model: INotebookModel | undefined;
    load(storage: INotebookModel, webViewPanel?: WebviewPanel): Promise<void>;
    runAllCells(): void;
    runSelectedCell(): void;
    addCellBelow(): void;
}

export const IInteractiveWindowListener = Symbol('IInteractiveWindowListener');

/**
 * Listens to history messages to provide extra functionality
 */
export interface IInteractiveWindowListener extends IDisposable {
    /**
     * Fires this event when posting a response message
     */
    // tslint:disable-next-line: no-any
    postMessage: Event<{ message: string; payload: any }>;
    /**
     * Fires this event when posting a message to the interactive base.
     */
    // tslint:disable-next-line: no-any
    postInternalMessage?: Event<{ message: string; payload: any }>;
    /**
     * Handles messages that the interactive window receives
     * @param message message type
     * @param payload message payload
     */
    // tslint:disable-next-line: no-any
    onMessage(message: string, payload?: any): void;
    /**
     * Fired when the view state of the interactive window changes
     * @param args
     */
    onViewStateChanged?(args: WebViewViewChangeEventArgs): void;
}

// Wraps the vscode API in order to send messages back and forth from a webview
export const IPostOffice = Symbol('IPostOffice');
export interface IPostOffice {
    // tslint:disable-next-line:no-any
    post(message: string, params: any[] | undefined): void;
    // tslint:disable-next-line:no-any
    listen(message: string, listener: (args: any[] | undefined) => void): void;
}

// Wraps the vscode CodeLensProvider base class
export const IDataScienceCodeLensProvider = Symbol('IDataScienceCodeLensProvider');
export interface IDataScienceCodeLensProvider extends CodeLensProvider {
    getCodeWatcher(document: TextDocument): ICodeWatcher | undefined;
}

// Wraps the Code Watcher API
export const ICodeWatcher = Symbol('ICodeWatcher');
export interface ICodeWatcher {
    codeLensUpdated: Event<void>;
    setDocument(document: TextDocument): void;
    getFileName(): string;
    getVersion(): number;
    getCodeLenses(): CodeLens[];
    getCachedSettings(): IDataScienceSettings | undefined;
    runAllCells(): Promise<void>;
    runCell(range: Range): Promise<void>;
    debugCell(range: Range): Promise<void>;
    runCurrentCell(): Promise<void>;
    runCurrentCellAndAdvance(): Promise<void>;
    runSelectionOrLine(activeEditor: TextEditor | undefined): Promise<void>;
    runToLine(targetLine: number): Promise<void>;
    runFromLine(targetLine: number): Promise<void>;
    runAllCellsAbove(stopLine: number, stopCharacter: number): Promise<void>;
    runCellAndAllBelow(startLine: number, startCharacter: number): Promise<void>;
    runFileInteractive(): Promise<void>;
    debugFileInteractive(): Promise<void>;
    addEmptyCellToBottom(): Promise<void>;
    runCurrentCellAndAddBelow(): Promise<void>;
    debugCurrentCell(): Promise<void>;
}

export const ICodeLensFactory = Symbol('ICodeLensFactory');
export interface ICodeLensFactory {
    updateRequired: Event<void>;
    createCodeLenses(document: TextDocument): CodeLens[];
}

export enum CellState {
    editing = -1,
    init = 0,
    executing = 1,
    finished = 2,
    error = 3
}

// Basic structure for a cell from a notebook
export interface ICell {
    id: string; // This value isn't unique. File and line are needed too.
    file: string;
    line: number;
    state: CellState;
    data: nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell | IMessageCell;
    extraLines?: number[];
}

export interface IInteractiveWindowInfo {
    cellCount: number;
    undoCount: number;
    redoCount: number;
    selectedCell: string | undefined;
}

export interface IMessageCell extends nbformat.IBaseCell {
    cell_type: 'messages';
    messages: string[];
}

export const ICodeCssGenerator = Symbol('ICodeCssGenerator');
export interface ICodeCssGenerator {
    generateThemeCss(resource: Resource, isDark: boolean, theme: string): Promise<string>;
    generateMonacoTheme(resource: Resource, isDark: boolean, theme: string): Promise<JSONObject>;
}

export const IThemeFinder = Symbol('IThemeFinder');
export interface IThemeFinder {
    findThemeRootJson(themeName: string): Promise<string | undefined>;
    findTmLanguage(language: string): Promise<string | undefined>;
    isThemeDark(themeName: string): Promise<boolean | undefined>;
}

export const IStatusProvider = Symbol('IStatusProvider');
export interface IStatusProvider {
    // call this function to set the new status on the active
    // interactive window. Dispose of the returned object when done.
    set(
        message: string,
        showInWebView: boolean,
        timeout?: number,
        canceled?: () => void,
        interactivePanel?: IInteractiveBase
    ): Disposable;

    // call this function to wait for a promise while displaying status
    waitWithStatus<T>(
        promise: () => Promise<T>,
        message: string,
        showInWebView: boolean,
        timeout?: number,
        canceled?: () => void,
        interactivePanel?: IInteractiveBase
    ): Promise<T>;
}

export interface IJupyterCommand {
    interpreter(): Promise<PythonInterpreter | undefined>;
    execObservable(args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>>;
    exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
}

export const IJupyterCommandFactory = Symbol('IJupyterCommandFactory');
export interface IJupyterCommandFactory {
    createInterpreterCommand(
        command: JupyterCommands,
        moduleName: string,
        args: string[],
        interpreter: PythonInterpreter,
        isActiveInterpreter: boolean
    ): IJupyterCommand;
    createProcessCommand(exe: string, args: string[]): IJupyterCommand;
}

// Config settings we pass to our react code
export type FileSettings = {
    autoSaveDelay: number;
    autoSave: 'afterDelay' | 'off' | 'onFocusChange' | 'onWindowChange';
};

export interface IDataScienceExtraSettings extends IDataScienceSettings {
    extraSettings: {
        editor: {
            cursor: string;
            cursorBlink: string;
            fontLigatures: boolean;
            autoClosingBrackets: string;
            autoClosingQuotes: string;
            autoSurround: string;
            autoIndent: boolean;
            scrollBeyondLastLine: boolean;
            horizontalScrollbarSize: number;
            verticalScrollbarSize: number;
            fontSize: number;
            fontFamily: string;
        };
        theme: string;
        useCustomEditorApi: boolean;
    };
    intellisenseOptions: {
        quickSuggestions: {
            other: boolean;
            comments: boolean;
            strings: boolean;
        };
        acceptSuggestionOnEnter: boolean | 'on' | 'smart' | 'off';
        quickSuggestionsDelay: number;
        suggestOnTriggerCharacters: boolean;
        tabCompletion: boolean | 'on' | 'off' | 'onlySnippets';
        suggestLocalityBonus: boolean;
        suggestSelection: 'first' | 'recentlyUsed' | 'recentlyUsedByPrefix';
        wordBasedSuggestions: boolean;
        parameterHintsEnabled: boolean;
    };
    variableOptions: {
        enableDuringDebugger: boolean;
    };
}

// Get variables from the currently running active Jupyter server
// Note: This definition is used implicitly by getJupyterVariableValue.py file
// Changes here may need to be reflected there as well
export interface IJupyterVariable {
    name: string;
    value: string | undefined;
    executionCount?: number;
    supportsDataExplorer: boolean;
    type: string;
    size: number;
    shape: string;
    count: number;
    truncated: boolean;
    columns?: { key: string; type: string }[];
    rowCount?: number;
    indexColumn?: string;
}

export const IJupyterVariables = Symbol('IJupyterVariables');
export interface IJupyterVariables {
    readonly refreshRequired: Event<void>;
    getVariables(notebook: INotebook, request: IJupyterVariablesRequest): Promise<IJupyterVariablesResponse>;
    getDataFrameInfo(targetVariable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable>;
    getDataFrameRows(
        targetVariable: IJupyterVariable,
        notebook: INotebook,
        start: number,
        end: number
    ): Promise<JSONObject>;
    getMatchingVariable(
        notebook: INotebook,
        name: string,
        cancelToken?: CancellationToken
    ): Promise<IJupyterVariable | undefined>;
}

export interface IConditionalJupyterVariables extends IJupyterVariables {
    readonly active: boolean;
}

// Request for variables
export interface IJupyterVariablesRequest {
    executionCount: number;
    sortColumn: string;
    sortAscending: boolean;
    startIndex: number;
    pageSize: number;
}

// Response to a request
export interface IJupyterVariablesResponse {
    executionCount: number;
    totalCount: number;
    pageStartIndex: number;
    pageResponse: IJupyterVariable[];
}

export const IDataViewerProvider = Symbol('IDataViewerProvider');
export interface IDataViewerProvider {
    create(variable: IJupyterVariable, notebook: INotebook): Promise<IDataViewer>;
}
export const IDataViewer = Symbol('IDataViewer');

export interface IDataViewer extends IDisposable {
    showVariable(variable: IJupyterVariable, notebook: INotebook): Promise<void>;
}

export const IPlotViewerProvider = Symbol('IPlotViewerProvider');
export interface IPlotViewerProvider {
    showPlot(imageHtml: string): Promise<void>;
}
export const IPlotViewer = Symbol('IPlotViewer');

export interface IPlotViewer extends IDisposable {
    closed: Event<IPlotViewer>;
    removed: Event<number>;
    addPlot(imageHtml: string): Promise<void>;
    show(): Promise<void>;
}

export interface ISourceMapMapping {
    line: number;
    endLine: number;
    runtimeSource: { path: string };
    runtimeLine: number;
}

export interface ISourceMapRequest {
    source: { path: string };
    pydevdSourceMaps: ISourceMapMapping[];
}

export interface ICellHash {
    line: number; // 1 based
    endLine: number; // 1 based and inclusive
    runtimeLine: number; // Line in the jupyter source to start at
    hash: string;
    executionCount: number;
    id: string; // Cell id as sent to jupyter
}

export interface IFileHashes {
    file: string;
    hashes: ICellHash[];
}

export const ICellHashListener = Symbol('ICellHashListener');
export interface ICellHashListener {
    hashesUpdated(hashes: IFileHashes[]): Promise<void>;
}

export const ICellHashProvider = Symbol('ICellHashProvider');
export interface ICellHashProvider {
    updated: Event<void>;
    getHashes(): IFileHashes[];
    getExecutionCount(): number;
    incExecutionCount(): void;
    generateHashFileName(cell: ICell, executionCount: number): string;
}

export interface IDebugLocation {
    fileName: string;
    lineNumber: number;
    column: number;
}

export const IDebugLocationTracker = Symbol('IDebugLocationTracker');
export interface IDebugLocationTracker {
    updated: Event<void>;
    getLocation(debugSession: DebugSession): IDebugLocation | undefined;
}

export const IJupyterSubCommandExecutionService = Symbol('IJupyterSubCommandExecutionService');
/**
 * Responsible for execution of jupyter subcommands such as `notebook`, `nbconvert`, etc.
 * The executed code is as follows `python -m jupyter <subcommand>`.
 *
 * @export
 * @interface IJupyterSubCommandExecutionService
 */
export interface IJupyterSubCommandExecutionService {
    /**
     * Checks whether notebook is supported.
     *
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<boolean>}
     * @memberof IJupyterSubCommandExecutionService
     */
    isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean>;
    /**
     * Checks whether exporting of ipynb is supported.
     *
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<boolean>}
     * @memberof IJupyterSubCommandExecutionService
     */
    isExportSupported(cancelToken?: CancellationToken): Promise<boolean>;
    /**
     * Error message indicating why jupyter notebook isn't supported.
     *
     * @returns {Promise<string>}
     * @memberof IJupyterSubCommandExecutionService
     */
    getReasonForJupyterNotebookNotBeingSupported(): Promise<string>;
    /**
     * Used to refresh the command finder.
     *
     * @returns {Promise<void>}
     * @memberof IJupyterSubCommandExecutionService
     */
    refreshCommands(): Promise<void>;
    /**
     * Gets the interpreter to be used for starting of jupyter server.
     *
     * @param {CancellationToken} [token]
     * @returns {(Promise<PythonInterpreter | undefined>)}
     * @memberof IJupyterInterpreterService
     */
    getSelectedInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined>;
    /**
     * Starts the jupyter notebook server
     *
     * @param {string[]} notebookArgs
     * @param {SpawnOptions} options
     * @returns {Promise<ObservableExecutionResult<string>>}
     * @memberof IJupyterSubCommandExecutionService
     */
    startNotebook(notebookArgs: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>>;
    /**
     * Gets a list of all locally running jupyter notebook servers.
     *
     * @param {CancellationToken} [token]
     * @returns {(Promise<JupyterServerInfo[] | undefined>)}
     * @memberof IJupyterSubCommandExecutionService
     */
    getRunningJupyterServers(token?: CancellationToken): Promise<JupyterServerInfo[] | undefined>;
    /**
     * Exports a given notebook into a python file.
     *
     * @param {string} file
     * @param {string} [template]
     * @param {CancellationToken} [token]
     * @returns {Promise<string>}
     * @memberof IJupyterSubCommandExecutionService
     */
    exportNotebookToPython(file: string, template?: string, token?: CancellationToken): Promise<string>;
    /**
     * Opens an ipynb file in a new instance of a jupyter notebook server.
     *
     * @param {string} notebookFile
     * @returns {Promise<void>}
     * @memberof IJupyterSubCommandExecutionService
     */
    openNotebook(notebookFile: string): Promise<void>;
    /**
     * Gets the kernelspecs.
     *
     * @param {CancellationToken} [token]
     * @returns {Promise<JupyterKernelSpec[]>}
     * @memberof IJupyterSubCommandExecutionService
     */
    getKernelSpecs(token?: CancellationToken): Promise<JupyterKernelSpec[]>;
}

export const IJupyterInterpreterDependencyManager = Symbol('IJupyterInterpreterDependencyManager');
export interface IJupyterInterpreterDependencyManager {
    /**
     * Installs the dependencies required to launch jupyter.
     *
     * @param {JupyterInstallError} [err]
     * @returns {Promise<void>}
     * @memberof IJupyterInterpreterDependencyManager
     */
    installMissingDependencies(err?: JupyterInstallError): Promise<void>;
}

export interface INotebookModel {
    readonly indentAmount: string;
    readonly onDidDispose: Event<void>;
    readonly file: Uri;
    readonly isDirty: boolean;
    readonly isUntitled: boolean;
    readonly changed: Event<NotebookModelChange>;
    readonly cells: Readonly<ICell>[];
    readonly onDidEdit: Event<NotebookModelChange>;
    readonly isDisposed: boolean;
    readonly metadata: nbformat.INotebookMetadata | undefined;
    getContent(): string;
    applyEdits(edits: readonly NotebookModelChange[]): Thenable<void>;
    undoEdits(edits: readonly NotebookModelChange[]): Thenable<void>;
    update(change: NotebookModelChange): void;
    clone(file: Uri): INotebookModel;
    /**
     * Dispose of the Notebook model.
     *
     * This is invoked when there are no more references to a given `NotebookModel` (for example when
     * all editors associated with the document have been closed.)
     */
    dispose(): void;
}

export const INotebookStorage = Symbol('INotebookStorage');

export interface INotebookStorage {
    readonly onSavedAs: Event<{ new: Uri; old: Uri }>;
    save(model: INotebookModel, cancellation: CancellationToken): Promise<void>;
    saveAs(model: INotebookModel, targetResource: Uri): Promise<void>;
    backup(model: INotebookModel, cancellation: CancellationToken): Promise<void>;
    load(file: Uri, contents?: string, skipDirtyContents?: boolean): Promise<INotebookModel>;
}
type WebViewViewState = {
    readonly visible: boolean;
    readonly active: boolean;
};
export type WebViewViewChangeEventArgs = { current: WebViewViewState; previous: WebViewViewState };

export const INotebookProvider = Symbol('INotebookProvider');

export type GetServerOptions = {
    getOnly?: boolean;
    disableUI?: boolean;
    localOnly?: boolean;
    token?: CancellationToken;
};

/**
 * Options for getting a notebook
 */
export type GetNotebookOptions = {
    resource?: Uri;
    identity: Uri;
    getOnly?: boolean;
    disableUI?: boolean;
    metadata?: nbformat.INotebookMetadata;
    token?: CancellationToken;
};

export interface INotebookProvider {
    /**
     * Fired when a notebook has been created for a given Uri/Identity
     */
    onNotebookCreated: Event<{ identity: Uri; notebook: INotebook }>;

    /**
     * List of all notebooks (active and ones that are being constructed).
     */
    activeNotebooks: Promise<INotebook>[];
    /**
     * Gets or creates a notebook, and manages the lifetime of notebooks.
     */
    getOrCreateNotebook(options: GetNotebookOptions): Promise<INotebook | undefined>;
    /**
     * Connect to a notebook provider to prepare its connection and to get connection information
     */
    connect(options: ConnectNotebookProviderOptions): Promise<INotebookProviderConnection | undefined>;

    /**
     * Disconnect from a notebook provider connection
     */
    disconnect(options: ConnectNotebookProviderOptions, cancelToken?: CancellationToken): Promise<void>;
}

export const IJupyterServerProvider = Symbol('IJupyterServerProvider');
export interface IJupyterServerProvider {
    /**
     * Gets the server used for starting notebooks
     */
    getOrCreateServer(options: GetServerOptions): Promise<INotebookServer | undefined>;
}

export interface IKernelSocket {
    // tslint:disable-next-line: no-any
    sendToRealKernel(data: any, cb?: (err?: Error) => void): void;
    /**
     * Adds a listener to a socket that will be called before the socket's onMessage is called. This
     * allows waiting for a callback before processing messages
     * @param listener
     */
    addReceiveHook(hook: (data: WebSocketData) => Promise<void>): void;
    /**
     * Removes a listener for the socket. When no listeners are present, the socket no longer blocks
     * @param listener
     */
    removeReceiveHook(hook: (data: WebSocketData) => Promise<void>): void;
    /**
     * Adds a hook to the sending of data from a websocket. Hooks can block sending so be careful.
     * @param patch
     */
    // tslint:disable-next-line: no-any
    addSendHook(hook: (data: any, cb?: (err?: Error) => void) => Promise<void>): void;
    /**
     * Removes a send hook from the socket.
     * @param hook
     */
    // tslint:disable-next-line: no-any
    removeSendHook(hook: (data: any, cb?: (err?: Error) => void) => Promise<void>): void;
}

export type KernelSocketOptions = {
    /**
     * Kernel Id.
     */
    readonly id: string;
    /**
     * Kernel ClientId.
     */
    readonly clientId: string;
    /**
     * Kernel UserName.
     */
    readonly userName: string;
    /**
     * Kernel model.
     */
    readonly model: {
        /**
         * Unique identifier of the kernel server session.
         */
        readonly id: string;
        /**
         * The name of the kernel.
         */
        readonly name: string;
    };
};
export type KernelSocketInformation = {
    /**
     * Underlying socket used by jupyterlab/services to communicate with kernel.
     * See jupyterlab/services/kernel/default.ts
     */
    readonly socket?: IKernelSocket;
    /**
     * Options used to clone a kernel.
     */
    readonly options: KernelSocketOptions;
};

export enum KernelInterpreterDependencyResponse {
    ok,
    cancel
}

export const IKernelDependencyService = Symbol('IKernelDependencyService');
export interface IKernelDependencyService {
    installMissingDependencies(
        interpreter: PythonInterpreter,
        token?: CancellationToken
    ): Promise<KernelInterpreterDependencyResponse>;
    areDependenciesInstalled(interpreter: PythonInterpreter, _token?: CancellationToken): Promise<boolean>;
}

export const INotebookAndInteractiveWindowUsageTracker = Symbol('INotebookAndInteractiveWindowUsageTracker');
export interface INotebookAndInteractiveWindowUsageTracker {
    readonly lastNotebookOpened?: Date;
    readonly lastInteractiveWindowOpened?: Date;
    startTracking(): void;
}

export const IJupyterDebugService = Symbol('IJupyterDebugService');
export interface IJupyterDebugService extends IDebugService {
    /**
     * Event fired when a breakpoint is hit (debugger has stopped)
     */
    readonly onBreakpointHit: Event<void>;
    /**
     * Start debugging a notebook cell.
     * @param nameOrConfiguration Either the name of a debug or compound configuration or a [DebugConfiguration](#DebugConfiguration) object.
     * @return A thenable that resolves when debugging could be successfully started.
     */
    startRunByLine(config: DebugConfiguration): Thenable<boolean>;
    /**
     * Gets the current stack frame for the current thread
     */
    getStack(): Promise<DebugProtocol.StackFrame[]>;
    /**
     * Steps the current thread. Returns after the request is sent. Wait for onBreakpointHit or onDidTerminateDebugSession to determine when done.
     */
    step(): Promise<void>;
    /**
     * Runs the current thread. Will keep running until a breakpoint or end of session.
     */
    continue(): Promise<void>;
    /**
     * Force a request for variables. DebugAdapterTrackers can listen for the results.
     */
    requestVariables(): Promise<void>;
    /**
     * Stop debugging
     */
    stop(): void;
}
