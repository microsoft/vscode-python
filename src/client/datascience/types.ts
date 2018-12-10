// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import { CancellationToken, CodeLens, CodeLensProvider, Disposable, Event, Range, TextDocument, TextEditor } from 'vscode';

import { ICommandManager } from '../common/application/types';
import { PythonInterpreter } from '../interpreter/contracts';

// Main interface
export const IDataScience = Symbol('IDataScience');
export interface IDataScience extends Disposable {
    activate(): Promise<void>;
}

export const IDataScienceCommandListener = Symbol('IDataScienceCommandListener');
export interface IDataScienceCommandListener {
    register(commandManager: ICommandManager);
}

// Connection information for talking to a jupyter notebook process
export interface IConnection extends Disposable {
    baseUrl: string;
    token: string;
    localLaunch: boolean;
}

// Talks to a jupyter ipython kernel to retrieve data for cells
export const INotebookServer = Symbol('INotebookServer');
export interface INotebookServer extends Disposable {
    onStatusChanged: Event<boolean>;
    connect(conninfo: IConnection, kernelSpec: IJupyterKernelSpec, cancelToken?: CancellationToken, workingDir?: string) : Promise<void>;
    getCurrentState() : Promise<ICell[]>;
    executeObservable(code: string, file: string, line: number) : Observable<ICell[]>;
    execute(code: string, file: string, line: number, cancelToken?: CancellationToken) : Promise<ICell[]>;
    restartKernel() : Promise<void>;
    waitForIdle() : Promise<void>;
    shutdown();
    interruptKernel() : Promise<void>;
    setInitialDirectory(directory: string): Promise<void>;
}

export const IJupyterExecution = Symbol('IJupyterExecution');
export interface IJupyterExecution {
    isNotebookSupported(cancelToken?: CancellationToken) : Promise<boolean>;
    isImportSupported(cancelToken?: CancellationToken) : Promise<boolean>;
    isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean>;
    connectToNotebookServer(uri: string | undefined, useDefaultConfig: boolean, cancelToken?: CancellationToken, workingDir?: string) : Promise<INotebookServer | undefined>;
    spawnNotebook(file: string) : Promise<void>;
    importNotebook(file: string, template: string) : Promise<string>;
    getUsableJupyterPython(cancelToken?: CancellationToken) : Promise<PythonInterpreter | undefined>;
}

export interface IJupyterKernelSpec extends Disposable {
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
    addCode(code: string, file: string, line: number, editor?: TextEditor) : Promise<void>;
    // tslint:disable-next-line:no-any
    postMessage(type: string, payload?: any);
    undoCells();
    redoCells();
    removeAllCells();
    interruptKernel();
    restartKernel();
    expandAllCells();
    collapseAllCells();
    exportCells();
}

// Wraps the vscode API in order to send messages back and forth from a webview
export const IPostOffice = Symbol('IPostOffice');
export interface IPostOffice {
    // tslint:disable-next-line:no-any
    post(message: string, params: any[] | undefined);
    // tslint:disable-next-line:no-any
    listen(message: string, listener: (args: any[] | undefined) => void);
}

// Wraps the vscode CodeLensProvider base class
export const IDataScienceCodeLensProvider = Symbol('IDataScienceCodeLensProvider');
export interface IDataScienceCodeLensProvider extends CodeLensProvider {
    getCodeWatcher(document: TextDocument) : ICodeWatcher | undefined;
}

// Wraps the Code Watcher API
export const ICodeWatcher = Symbol('ICodeWatcher');
export interface ICodeWatcher {
    addFile(document: TextDocument);
    getFileName() : string;
    getVersion() : number;
    getCodeLenses() : CodeLens[];
    runAllCells();
    runCell(range: Range);
    runCurrentCell();
    runCurrentCellAndAdvance();
}

export enum CellState {
    init = 0,
    executing = 1,
    finished = 2,
    error = 3
}

// Basic structure for a cell from a notebook
export interface ICell {
    id: string;
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
}

export const ICodeCssGenerator = Symbol('ICodeCssGenerator');
export interface ICodeCssGenerator {
    generateThemeCss() : Promise<string>;
}

export const IStatusProvider = Symbol('IStatusProvider');
export interface IStatusProvider {
    // call this function to set the new status on the active
    // history window. Dispose of the returned object when done.
    set(message: string, history?: IHistory, timeout?: number) : Disposable;

    // call this function to wait for a promise while displaying status
    waitWithStatus<T>(promise: () => Promise<T>, message: string, history?: IHistory, timeout?: number, canceled?: () => void) : Promise<T>;
}
