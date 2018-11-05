// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import { CodeLens, CodeLensProvider, Disposable, Event, Range, TextDocument, TextEditor } from 'vscode';

import { ICommandManager } from '../common/application/types';
import { ExecutionResult, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { IConnectionInfo } from './jupyterProcess';

// Main interface
export const IDataScience = Symbol('IDataScience');
export interface IDataScience extends Disposable {
    activate(): Promise<void>;
}

export const IDataScienceCommandListener = Symbol('IDataScienceCommandListener');
export interface IDataScienceCommandListener {
    register(commandManager: ICommandManager);
}

// Talks to a jupyter ipython kernel to retrieve data for cells
export const INotebookServer = Symbol('INotebookServer');
export interface INotebookServer extends Disposable {
    onStatusChanged: Event<boolean>;
    start(notebookFile? : string) : Promise<boolean>;
    shutdown() : Promise<void>;
    getCurrentState() : Promise<ICell[]>;
    executeObservable(code: string, file: string, line: number) : Observable<ICell[]>;
    execute(code: string, file: string, line: number) : Promise<ICell[]>;
    restartKernel() : Promise<void>;
    translateToNotebook(cells: ICell[]) : Promise<JSONObject | undefined>;
    launchNotebook(file: string) : Promise<boolean>;
}

export const INotebookProcess = Symbol('INotebookProcess');
export interface INotebookProcess extends Disposable {
    start(notebookFile: string) : Promise<void>;
    shutdown() : Promise<void>;
    waitForConnectionInformation() : Promise<IConnectionInfo>;
    waitForPythonVersionString() : Promise<string>;
    spawn(notebookFile: string) : Promise<ExecutionResult<string>>;
}
export const IJupyterExecution = Symbol('IJupyterAvailablity');
export interface IJupyterExecution {
    isNotebookSupported() : Promise<boolean>;
    isImportSupported() : Promise<boolean>;
    execModuleObservable(args: string[], options: SpawnOptions) : Promise<ObservableExecutionResult<string>>;
    execModule(args: string[], options: SpawnOptions) : Promise<ExecutionResult<string>>;
}

export const INotebookImporter = Symbol('INotebookImporter');
export interface INotebookImporter extends Disposable {
    importFromFile(file: string) : Promise<string>;
}

export const IHistoryProvider = Symbol('IHistoryProvider');
export interface IHistoryProvider {
    active : IHistory;
    create() : IHistory;
}

export const IHistory = Symbol('IHistory');
export interface IHistory extends Disposable {
    closed: Event<IHistory>;
    show() : Promise<void>;
    addCode(code: string, file: string, line: number, editor?: TextEditor) : Promise<void>;
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
    data: nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell;
}

export const ICodeCssGenerator = Symbol('ICodeCssGenerator');
export interface ICodeCssGenerator {
    generateThemeCss() : Promise<string>;
}
