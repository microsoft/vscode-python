// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Kernel, KernelMessage } from '@jupyterlab/services/lib/kernel';
import { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import { CancellationToken, CodeLens, CodeLensProvider, Disposable, Event, Range, TextDocument, TextEditor } from 'vscode';

import { ICommandManager } from '../common/application/types';
import { ExecutionResult, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { IAsyncDisposable, IDataScienceSettings } from '../common/types';
import { PythonInterpreter } from '../interpreter/contracts';

// Main interface
export const IDataScience = Symbol('IDataScience');
export interface IDataScience extends Disposable {
    activationStartTime: number;
    activate(): Promise<void>;
}

export const IDataScienceCommandListener = Symbol('IDataScienceCommandListener');
export interface IDataScienceCommandListener {
    register(commandManager: ICommandBroker): void;
}

// Connection information for talking to a jupyter notebook process
export interface IConnection extends Disposable {
    baseUrl: string;
    token: string;
    localLaunch: boolean;
}

export enum InterruptResult {
    Success = 0,
    TimedOut = 1,
    Restarted = 2
}

// Information used to launch a notebook server
export interface INotebookServerLaunchInfo
{
    connectionInfo: IConnection;
    currentInterpreter: PythonInterpreter | undefined;
    uri: string | undefined; // Different from the connectionInfo as this is the setting used, not the result
    kernelSpec: IJupyterKernelSpec | undefined;
    usingDarkTheme: boolean;
    workingDir: string | undefined;
}

// Manage our running notebook server instances
export const INotebookServerManager = Symbol('INotebookServerManager');
export interface INotebookServerManager {
    getOrCreateServer(): Promise<INotebookServer | undefined>;
    getServer() : Promise<INotebookServer | undefined>;
}

// Talks to a jupyter ipython kernel to retrieve data for cells
export const INotebookServer = Symbol('INotebookServer');
export interface INotebookServer extends IAsyncDisposable {
    connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken) : Promise<void>;
    executeObservable(code: string, file: string, line: number, id: string) : Observable<ICell[]>;
    execute(code: string, file: string, line: number, id: string, cancelToken?: CancellationToken) : Promise<ICell[]>;
    restartKernel() : Promise<void>;
    waitForIdle() : Promise<void>;
    shutdown() : Promise<void>;
    interruptKernel(timeoutInMs: number) : Promise<InterruptResult>;
    setInitialDirectory(directory: string): Promise<void>;
    getLaunchInfo(): INotebookServerLaunchInfo | undefined;
    getConnectionInfo(): IConnection | undefined;
    getSysInfo() : Promise<ICell | undefined>;
}

export const IJupyterExecution = Symbol('IJupyterExecution');
export interface IJupyterExecution extends IAsyncDisposable {
    isNotebookSupported(cancelToken?: CancellationToken) : Promise<boolean>;
    isImportSupported(cancelToken?: CancellationToken) : Promise<boolean>;
    isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean>;
    isKernelSpecSupported(cancelToken?: CancellationToken): Promise<boolean>;
    connectToNotebookServer(uri: string | undefined, usingDarkTheme: boolean, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string) : Promise<INotebookServer | undefined>;
    spawnNotebook(file: string) : Promise<void>;
    importNotebook(file: string, template: string) : Promise<string>;
    getUsableJupyterPython(cancelToken?: CancellationToken) : Promise<PythonInterpreter | undefined>;
}

export const IJupyterSession = Symbol('IJupyterSession');
export interface IJupyterSession extends IAsyncDisposable {
    onRestarted: Event<void>;
    restart() : Promise<void>;
    interrupt() : Promise<void>;
    waitForIdle() : Promise<void>;
    requestExecute(content: KernelMessage.IExecuteRequest, disposeOnDone?: boolean, metadata?: JSONObject) : Kernel.IFuture | undefined;
}
export const IJupyterSessionManager = Symbol('IJupyterSessionManager');
export interface IJupyterSessionManager {
    startNew(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, cancelToken?: CancellationToken) : Promise<IJupyterSession>;
    getActiveKernelSpecs(connInfo: IConnection) : Promise<IJupyterKernelSpec[]>;
}

export interface IJupyterKernelSpec extends IAsyncDisposable {
    name: string | undefined;
    language: string | undefined;
    path: string | undefined;
}

export const INotebookImporter = Symbol('INotebookImporter');
export interface INotebookImporter extends Disposable {
    importFromFile(file: string) : Promise<string>;
}

export const INotebookExporter = Symbol('INotebookExporter');
export interface INotebookExporter extends Disposable {
    translateToNotebook(cells: ICell[], directoryChange?: string) : Promise<JSONObject | undefined>;
}

export const IHistoryProvider = Symbol('IHistoryProvider');
export interface IHistoryProvider {
    getActive() : IHistory | undefined;

    getOrCreateActive(): IHistory;
}

export const IHistory = Symbol('IHistory');
export interface IHistory extends Disposable {
    closed: Event<IHistory>;
    show() : Promise<void>;
    addCode(code: string, file: string, line: number, id: string, editor?: TextEditor) : Promise<void>;
    // tslint:disable-next-line:no-any
    postMessage(type: string, payload?: any): void;
    undoCells(): void;
    redoCells(): void;
    removeAllCells(): void;
    interruptKernel(): void;
    restartKernel(): void;
    expandAllCells(): void;
    collapseAllCells(): void;
    exportCells(): void;
}

// Wraps the vscode API in order to send messages back and forth from a webview
export const IPostOffice = Symbol('IPostOffice');
export interface IPostOffice {
    // tslint:disable-next-line:no-any
    post(message: string, params: any[] | undefined): void;
    // tslint:disable-next-line:no-any
    listen(message: string, listener: (args: any[] | undefined) => void) : void;
}

// Wraps the vscode CodeLensProvider base class
export const IDataScienceCodeLensProvider = Symbol('IDataScienceCodeLensProvider');
export interface IDataScienceCodeLensProvider extends CodeLensProvider {
    getCodeWatcher(document: TextDocument) : ICodeWatcher | undefined;
}

// Wraps the Code Watcher API
export const ICodeWatcher = Symbol('ICodeWatcher');
export interface ICodeWatcher {
    setDocument(document: TextDocument): void;
    getFileName() : string;
    getVersion() : number;
    getCodeLenses() : CodeLens[];
    getCachedSettings() : IDataScienceSettings | undefined;
    runAllCells(id: string): void;
    runCell(range: Range, id: string): void;
    runCurrentCell(id: string): void;
    runCurrentCellAndAdvance(id: string): void;
    runSelectionOrLine(activeEditor: TextEditor | undefined, id: string): void;
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
    id: string; // This value isn't unique. File and line are needed to.
    file: string;
    line: number;
    state: CellState;
    data: nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell | ISysInfo;
}

export interface IHistoryInfo {
    cellCount: number;
    undoCount: number;
    redoCount: number;
}

export interface ISysInfo extends nbformat.IBaseCell {
    cell_type: 'sys_info';
    version: string;
    notebook_version: string;
    path: string;
    message: string;
    connection: string;
}

export const ICodeCssGenerator = Symbol('ICodeCssGenerator');
export interface ICodeCssGenerator {
    generateThemeCss() : Promise<string>;
}

export const IStatusProvider = Symbol('IStatusProvider');
export interface IStatusProvider {
    // call this function to set the new status on the active
    // history window. Dispose of the returned object when done.
    set(message: string, timeout?: number) : Disposable;

    // call this function to wait for a promise while displaying status
    waitWithStatus<T>(promise: () => Promise<T>, message: string, timeout?: number, canceled?: () => void, skipHistory?: boolean) : Promise<T>;
}

export interface IJupyterCommand {
    interpreter() : Promise<PythonInterpreter | undefined>;
    execObservable(args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>>;
    exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
}

export const IJupyterCommandFactory = Symbol('IJupyterCommandFactory');
export interface IJupyterCommandFactory {
    createInterpreterCommand(args: string[], interpreter: PythonInterpreter) : IJupyterCommand;
    createProcessCommand(exe: string, args: string[]) : IJupyterCommand;
}

// Config settings we pass to our react code
export interface IDataScienceExtraSettings extends IDataScienceSettings {
    extraSettings: {
        terminalCursor: string;
    };
}

export const ICommandBroker = Symbol('ICommandBroker');

export interface ICommandBroker extends ICommandManager {
}
