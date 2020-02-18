// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Session } from '@jupyterlab/services';
import { Kernel, KernelMessage } from '@jupyterlab/services/lib/kernel';
import { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import {
    CancellationToken,
    CodeLens,
    CodeLensProvider,
    DebugSession,
    Disposable,
    Event,
    Range,
    TextDocument,
    TextEditor,
    Uri
} from 'vscode';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { ICommandManager } from '../common/application/types';
import { ExecutionResult, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { IAsyncDisposable, IDataScienceSettings, IDisposable, Resource } from '../common/types';
import { StopWatch } from '../common/utils/stopWatch';
import { PythonInterpreter } from '../interpreter/contracts';
import { JupyterCommands } from './constants';
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

// Connection information for talking to a jupyter notebook process
export interface IConnection extends Disposable {
    readonly baseUrl: string;
    readonly token: string;
    readonly hostName: string;
    readonly localLaunch: boolean;
    localProcExitCode: number | undefined;
    disconnected: Event<number>;
    allowUnauthorized?: boolean;
}

export enum InterruptResult {
    Success = 0,
    TimedOut = 1,
    Restarted = 2
}

// Information used to launch a notebook server
export interface INotebookServerLaunchInfo {
    connectionInfo: IConnection;
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
    enableDebugging: boolean | undefined; // If we should enable debugging for this server
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
    getNotebook(identity: Uri): Promise<INotebook | undefined>;
    connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void>;
    getConnectionInfo(): IConnection | undefined;
    waitForConnect(): Promise<INotebookServerLaunchInfo | undefined>;
    shutdown(): Promise<void>;
}

export interface INotebook extends IAsyncDisposable {
    readonly resource: Resource;
    readonly identity: Uri;
    readonly server: INotebookServer;
    readonly status: ServerStatus;
    onSessionStatusChanged: Event<ServerStatus>;
    onKernelChanged: Event<IJupyterKernelSpec | LiveKernelModel>;
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
    addLogger(logger: INotebookExecutionLogger): void;
    getMatchingInterpreter(): PythonInterpreter | undefined;
    getKernelSpec(): IJupyterKernelSpec | LiveKernelModel | undefined;
    setKernelSpec(spec: IJupyterKernelSpec | LiveKernelModel, timeoutMS: number): Promise<void>;
    setInterpreter(interpeter: PythonInterpreter): void;
}

export interface INotebookServerOptions {
    enableDebugging?: boolean;
    uri?: string;
    usingDarkTheme?: boolean;
    useDefaultConfig?: boolean;
    workingDir?: string;
    purpose: string;
    metadata?: nbformat.INotebookMetadata;
    disableUI?: boolean;
}

export const INotebookExecutionLogger = Symbol('INotebookExecutionLogger');
export interface INotebookExecutionLogger {
    preExecute(cell: ICell, silent: boolean): Promise<void>;
    postExecute(cell: ICell, silent: boolean): Promise<void>;
}

export const IGatherExecution = Symbol('IGatherExecution');
export interface IGatherExecution {
    enabled: boolean;
    logExecution(vscCell: ICell): void;
    gatherCode(vscCell: ICell): string;
    resetLog(): void;
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
    changeKernel(kernel: IJupyterKernelSpec | LiveKernelModel, timeoutMS: number): Promise<void>;
}

export const IJupyterSessionManagerFactory = Symbol('IJupyterSessionManagerFactory');
export interface IJupyterSessionManagerFactory {
    create(connInfo: IConnection, failOnPassword?: boolean): Promise<IJupyterSessionManager>;
}

export interface IJupyterSessionManager extends IAsyncDisposable {
    startNew(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        cancelToken?: CancellationToken
    ): Promise<IJupyterSession>;
    getKernelSpecs(): Promise<IJupyterKernelSpec[]>;
    getConnInfo(): IConnection;
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
}

export const IInteractiveWindowProvider = Symbol('IInteractiveWindowProvider');
export interface IInteractiveWindowProvider {
    readonly onDidChangeActiveInteractiveWindow: Event<IInteractiveWindow | undefined>;
    onExecutedCode: Event<string>;
    getActive(): IInteractiveWindow | undefined;
    getOrCreateActive(): Promise<IInteractiveWindow>;
    getNotebookOptions(resource: Resource): Promise<INotebookServerOptions>;
}

export const IDataScienceErrorHandler = Symbol('IDataScienceErrorHandler');
export interface IDataScienceErrorHandler {
    handleError(err: Error): Promise<void>;
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
    open(file: Uri, contents: string): Promise<INotebookEditor>;
    show(file: Uri): Promise<INotebookEditor | undefined>;
    createNew(contents?: string): Promise<INotebookEditor>;
    getNotebookOptions(resource: Resource): Promise<INotebookServerOptions>;
}

// For native editing, the INotebookEditor acts like a TextEditor and a TextDocument together
export const INotebookEditor = Symbol('INotebookEditor');
export interface INotebookEditor extends IInteractiveBase {
    readonly onDidChangeViewState: Event<void>;
    readonly closed: Event<INotebookEditor>;
    readonly executed: Event<INotebookEditor>;
    readonly modified: Event<INotebookEditor>;
    readonly saved: Event<INotebookEditor>;
    readonly metadataUpdated: Event<INotebookEditor>;
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
    load(contents: string, file: Uri): Promise<void>;
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
     * Handles messages that the interactive window receives
     * @param message message type
     * @param payload message payload
     */
    // tslint:disable-next-line: no-any
    onMessage(message: string, payload?: any): void;
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
        };
        fontSize: number;
        fontFamily: string;
        theme: string;
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
    getVariables(notebook: INotebook, request: IJupyterVariablesRequest): Promise<IJupyterVariablesResponse>;
    getDataFrameInfo(targetVariable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariable>;
    getDataFrameRows(
        targetVariable: IJupyterVariable,
        notebook: INotebook,
        start: number,
        end: number
    ): Promise<JSONObject>;
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
    getPandasVersion(notebook: INotebook): Promise<{ major: number; minor: number; build: number } | undefined>;
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

type WebViewViewState = {
    readonly visible: boolean;
    readonly active: boolean;
};
export type WebViewViewChangeEventArgs = { current: WebViewViewState; previous: WebViewViewState };
