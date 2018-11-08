// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import { Kernel, KernelMessage, ServerConnection, Session, SessionManager } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as uuid from 'uuid/v4';
import * as vscode from 'vscode';

import { IWorkspaceService } from '../common/application/types';
import { IFileSystem } from '../common/platform/types';
import { IDisposableRegistry, ILogger } from '../common/types';
import { createDeferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { RegExpValues } from './constants';
import { JupyterInstallError } from './jupyterInstallError';
import { CellState, ICell, IJupyterExecution, INotebookProcess, INotebookServer } from './types';

// This code is based on the examples here:
// https://www.npmjs.com/package/@jupyterlab/services

@injectable()
export class JupyterServer implements INotebookServer {
    public isDisposed: boolean = false;
    private session: Session.ISession | undefined;
    private sessionManager : SessionManager | undefined;
    private sessionStartTime: number | undefined;
    private tempFile: string | undefined;
    private onStatusChangedEvent : vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();

    constructor(
        @inject(ILogger) private logger: ILogger,
        @inject(INotebookProcess) private process: INotebookProcess,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IJupyterExecution) private jupyterExecution : IJupyterExecution,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService) {
    }

    public start = async () : Promise<boolean> => {

        if (await this.jupyterExecution.isNotebookSupported()) {

            // First generate a temporary notebook. We need this as input to the session
            this.tempFile = await this.generateTempFile();

            // start our process in the same directory as our ipynb file.
            await this.process.start(path.dirname(this.tempFile));

            // Wait for connection information. We'll stick that into the options
            const connInfo = await this.process.waitForConnectionInformation();

            // First connect to the sesssion manager and find a kernel that matches our
            // python we're using
            const serverSettings = ServerConnection.makeSettings(
                {
                    baseUrl: connInfo.baseUrl,
                    token: connInfo.token,
                    pageUrl: '',
                    // A web socket is required to allow token authentication
                    wsUrl: connInfo.baseUrl.replace('http', 'ws'),
                    init: { cache: 'no-store', credentials: 'same-origin' }
                });
            this.sessionManager = new SessionManager({ serverSettings: serverSettings });

            // Ask Jupyter for its list of kernel specs.
            const kernelName = await this.findKernelName(this.sessionManager);

            // Create our session options using this temporary notebook and our connection info
            const options: Session.IOptions = {
                path: this.tempFile,
                kernelName: kernelName,
                serverSettings: serverSettings
            };

            // Start a new session
            this.session = await this.sessionManager.startNew(options);

            // Setup our start time. We reject anything that comes in before this time during execute
            this.sessionStartTime = Date.now();

            // Wait for it to be ready
            await this.session.kernel.ready;

            // Check for dark theme, if so set matplot lib to use dark_background settings
            let darkTheme: boolean = false;
            const workbench = this.workspaceService.getConfiguration('workbench');
            if (workbench) {
                const theme = workbench.get<string>('colorTheme');
                if (theme) {
                    darkTheme = /dark/i.test(theme);
                }
            }

            this.executeSilently(
                `import pandas as pd\r\nimport numpy\r\n%matplotlib inline\r\nimport matplotlib.pyplot as plt${darkTheme ? '\r\nfrom matplotlib import style\r\nstyle.use(\'dark_background\')' : ''}`
            ).ignoreErrors();

            return true;
        } else {
            throw new JupyterInstallError(localize.DataScience.jupyterNotSupported(), localize.DataScience.pythonInteractiveHelpLink());
        }

    }

    public shutdown = async () : Promise<void> => {
        if (this.session) {
            await this.sessionManager.shutdownAll();
            this.session.dispose();
            this.sessionManager.dispose();
            this.session = undefined;
            this.sessionManager = undefined;
        }
        if (this.process) {
            this.process.dispose();
        }
    }

    public waitForIdle = async () : Promise<void> => {
        if (this.session && this.session.kernel) {
            await this.session.kernel.ready;

            while (this.session.kernel.status !== 'idle') {
                await this.timeout(10);
            }
        }
    }

    public getCurrentState() : Promise<ICell[]> {
        return Promise.resolve([]);
    }

    public execute(code : string, file: string, line: number) : Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook
        const observable = this.executeObservable(code, file, line);
        let output: ICell[];

        observable.subscribe(
            (cells: ICell[]) => {
                output = cells;
            },
            (error) => {
                deferred.reject(error);
            },
            () => {
                deferred.resolve(output);
            });

        // Wait for the execution to finish
        return deferred.promise;
    }

    public executeObservable = (code: string, file: string, line: number) : Observable<ICell[]> => {
        // If we have a session, execute the code now.
        if (this.session) {

            // Replace windows line endings with unix line endings.
            const copy = code.replace(/\r\n/g, '\n');

            // Determine if we have a markdown cell/ markdown and code cell combined/ or just a code cell
            const split = copy.split('\n');
            const firstLine = split[0];
            if (RegExpValues.PythonMarkdownCellMarker.test(firstLine)) {
                // We have at least one markdown. We might have to split it if there any lines that don't begin
                // with #
                const firstNonMarkdown = split.findIndex((l : string) => l.trim().length > 0 && !l.trim().startsWith('#'));
                if (firstNonMarkdown >= 0) {
                    // We need to combine results
                    return this.combineObservables(
                        this.executeMarkdownObservable(split.slice(0, firstNonMarkdown).join('\n'), file, line),
                        this.executeCodeObservable(split.slice(firstNonMarkdown).join('\n'), file, line + firstNonMarkdown));
                } else {
                    // Just a normal markdown case
                    return this.combineObservables(
                        this.executeMarkdownObservable(copy, file, line));
                }
            } else {
                // Normal code case
                return this.combineObservables(
                    this.executeCodeObservable(copy, file, line));
            }
        }

        // Can't run because no session
        return new Observable<ICell[]>(subscriber => {
            subscriber.error(new Error(localize.DataScience.sessionDisposed()));
            subscriber.complete();
        });
    }

    public executeSilently = (code: string) : Promise<void> => {
        return new Promise((resolve, reject) => {
            // If we have a session, execute the code now.
            if (this.session) {
                // Generate a new request and resolve when it's done.
                const request = this.generateRequest(code, true);

                if (request) {

                    // // For debugging purposes when silently is failing.
                    // request.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                    //     try {
                    //         this.logger.logInformation(`Execute silently message ${msg.header.msg_type} : hasData=${'data' in msg.content}`);
                    //     } catch (err) {
                    //         this.logger.logError(err);
                    //     }
                    // };

                    request.done.then(() => {
                        this.logger.logInformation(`Execute for ${code} silently finished.`);
                        resolve();
                    }).catch(reject);
                } else {
                    reject(new Error(localize.DataScience.sessionDisposed()));
                }
            } else {
                reject(new Error(localize.DataScience.sessionDisposed()));
            }
        });
    }

    public get onStatusChanged() : vscode.Event<boolean> {
        return this.onStatusChangedEvent.event.bind(this.onStatusChangedEvent);
    }

    public dispose = async () => {
        if (!this.isDisposed) {
            this.isDisposed = true;
            this.onStatusChangedEvent.dispose();
            this.shutdown().ignoreErrors();
        }
    }

    public restartKernel = async () : Promise<void> => {
        if (this.session && this.session.kernel) {
            // Update our start time so we don't keep sending responses
            this.sessionStartTime = Date.now();

            // Restart our kernel
            await this.session.kernel.restart();

            // Wait for it to be ready
            await this.session.kernel.ready;

            return;
        }

        throw new Error(localize.DataScience.sessionDisposed());
    }

    public translateToNotebook = async (cells: ICell[]) : Promise<nbformat.INotebookContent | undefined> => {

        if (this.process) {

            // First we need the python version we're running
            const pythonVersion = await this.process.waitForPythonVersionString();

            // Pull off the first number. Should be  3 or a 2
            const first = pythonVersion.substr(0, 1);

            // Use this to build our metadata object
            const metadata : nbformat.INotebookMetadata = {
                kernelspec: {
                    display_name: `Python ${first}`,
                    language: 'python',
                    name: `python${first}`
                },
                language_info: {
                    name: 'python',
                    codemirror_mode: {
                        name: 'ipython',
                        version: parseInt(first, 10)
                    }
                },
                orig_nbformat : 2,
                file_extension: '.py',
                mimetype: 'text/x-python',
                name: 'python',
                npconvert_exporter: 'python',
                pygments_lexer: `ipython${first}`,
                version: pythonVersion
            };

            // Combine this into a JSON object
            return {
                cells: cells.map((cell : ICell) => this.pruneCell(cell)),
                nbformat: 4,
                nbformat_minor: 2,
                metadata: metadata
            };
        }
    }

    public launchNotebook = async (file: string) : Promise<boolean> => {
        if (this.process) {
            await this.process.spawn(file);
            return true;
        }
        return false;
    }

    private generateRequest = (code: string, silent: boolean) : Kernel.IFuture => {
        return this.session.kernel.requestExecute(
            {
                // Replace windows line endings with unix line endings.
                code: code.replace(/\r\n/g, '\n'),
                stop_on_error: false,
                allow_stdin: false,
                silent: silent
            },
            true
        );
    }

    private timeout(ms : number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private findKernelName = async (manager: SessionManager) : Promise<string> => {
        // Ask the session manager to refresh its list of kernel specs. We're going to
        // iterate through them finding the best match
        await manager.refreshSpecs();

        // Extract our current python information that the user has picked.
        // We'll match against this.
        const pythonVersion = await this.process.waitForPythonVersion();
        const pythonPath = await this.process.waitForPythonPath();
        let bestScore = 0;
        let bestSpec;

        // Enumerate all of the kernel specs, scoring each as follows
        // - Path match = 10 Points. Very likely this is the right one
        // - Language match = 1 point. Might be a match
        // - Version match = 4 points for major version match
        const keys = Object.keys(manager.specs.kernelspecs);
        for (let i = 0; i < keys.length; i += 1) {
            const spec = manager.specs.kernelspecs[keys[i]];
            let score = 0;

            if (spec.argv.length > 0 && spec.argv[0] === pythonPath) {
                // Path match
                score += 10;
            }
            if (spec.language.toLocaleLowerCase() === 'python') {
                // Language match
                score += 1;

                // See if the version is the same
                if (pythonVersion) {
                    const digits = spec.name.match(/\d+/g);
                    if (digits.length > 0 && parseInt(digits[0], 10) === pythonVersion[0]) {
                        // Major version match
                        score += 4;
                    }
                }
            }

            // Update high score
            if (score > bestScore) {
                bestScore = score;
                bestSpec = spec.name;
            }
        }

        // If still not set, at least pick the first one
        if (!bestSpec && keys.length > 0) {
            bestSpec = manager.specs.kernelspecs[keys[0]].name;
        }

        return bestSpec;
    }

    private pruneCell(cell : ICell) : nbformat.IBaseCell {
        // Remove the #%% of the top of the source if there is any. We don't need
        // this to end up in the exported ipynb file.
        const copy = {...cell.data};
        copy.source = this.pruneSource(cell.data.source);
        return copy;
    }

    private pruneSource(source : nbformat.MultilineString) : nbformat.MultilineString {

        if (Array.isArray(source) && source.length > 0) {
            if (RegExpValues.PythonCellMarker.test(source[0])) {
                return source.slice(1);
            }
        } else {
            const array = source.toString().split('\n').map(s => `${s}\n`);
            if (array.length > 0 && RegExpValues.PythonCellMarker.test(array[0])) {
                return array.slice(1);
            }
        }

        return source;
    }

    private combineObservables = (...args : Observable<ICell>[]) : Observable<ICell[]> => {
        return new Observable<ICell[]>(subscriber => {
            // When all complete, we have our results
            const results : { [id : string] : ICell } = {};

            args.forEach(o => {
                o.subscribe(c => {
                    results[c.id] = c;

                    // Convert to an array
                    const array = Object.keys(results).map((k : string) => {
                        return results[k];
                    });

                    // Update our subscriber of our total results if we have that many
                    if (array.length === args.length) {
                        subscriber.next(array);

                        // Complete when everybody is finished
                        if (array.every(a => a.state === CellState.finished || a.state === CellState.error)) {
                            subscriber.complete();
                        }
                    }
                },
                e => {
                    subscriber.error(e);
                });
            });
        });
    }

    private appendLineFeed(arr : string[], modifier? : (s : string) => string) {
        return arr.map((s: string, i: number) => {
            const out = modifier ? modifier(s) : s;
            return i === arr.length - 1 ? `${out}` : `${out}\n`;
        });
    }

    private executeMarkdownObservable = (code: string, file: string, line: number) : Observable<ICell> => {

        return new Observable<ICell>(subscriber => {
            // Generate markdown by stripping out the comment and markdown header
            const markdown = this.appendLineFeed(code.split('\n').slice(1), s => s.trim().slice(1).trim());

            const cell: ICell = {
                id: uuid(),
                file: file,
                line: line,
                state: CellState.finished,
                data : {
                    cell_type : 'markdown',
                    source: markdown,
                    metadata: {}
                }
            };

            subscriber.next(cell);
            subscriber.complete();
        });
    }

    private changeDirectoryIfPossible = async (file: string, line: number) : Promise<void> => {
        if (line >= 0 && await fs.pathExists(file)) {
            const dir = path.dirname(file);
            await this.executeSilently(`%cd "${dir}"`);
        }
    }

    private handleCodeRequest = (subscriber: Subscriber<ICell>, startTime: number, cell: ICell, code: string) => {
        // Generate a new request.
        const request = this.generateRequest(code, false);

        // Transition to the busy stage
        cell.state = CellState.executing;

        // Listen to the reponse messages and update state as we go
        if (request) {
            request.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                try {
                    if (KernelMessage.isExecuteResultMsg(msg)) {
                        this.handleExecuteResult(msg as KernelMessage.IExecuteResultMsg, cell);
                    } else if (KernelMessage.isExecuteInputMsg(msg)) {
                        this.handleExecuteInput(msg as KernelMessage.IExecuteInputMsg, cell);
                    } else if (KernelMessage.isStatusMsg(msg)) {
                        this.handleStatusMessage(msg as KernelMessage.IStatusMsg);
                    } else if (KernelMessage.isStreamMsg(msg)) {
                        this.handleStreamMesssage(msg as KernelMessage.IStreamMsg, cell);
                    } else if (KernelMessage.isDisplayDataMsg(msg)) {
                        this.handleDisplayData(msg as KernelMessage.IDisplayDataMsg, cell);
                    } else if (KernelMessage.isErrorMsg(msg)) {
                        this.handleError(msg as KernelMessage.IErrorMsg, cell);
                    } else {
                        this.logger.logWarning(`Unknown message ${msg.header.msg_type} : hasData=${'data' in msg.content}`);
                    }

                    // Set execution count, all messages should have it
                    if (msg.content.execution_count) {
                        cell.data.execution_count = msg.content.execution_count as number;
                    }

                    // Show our update if any new output
                    subscriber.next(cell);
                } catch (err) {
                    // If not a restart error, then tell the subscriber
                    if (startTime > this.sessionStartTime) {
                        this.logger.logError(`Error during message ${msg.header.msg_type}`);
                        subscriber.error(err);
                    }
                }
            };

            // Create completion and error functions so we can bind our cell object
            // tslint:disable-next-line:no-any
            const completion = (error?: any) => {
                cell.state = error ? CellState.error : CellState.finished;
                // Only do this if start time is still valid. Dont log an error to the subscriber. Error
                // state should end up in the cell output.
                if (startTime > this.sessionStartTime) {
                    subscriber.next(cell);
                }
                subscriber.complete();
            };

            // When the request finishes we are done
            request.done.then(completion).catch(completion);
        } else {
            subscriber.error(new Error(localize.DataScience.sessionDisposed()));
        }
    }

    private executeCodeObservable(code: string, file: string, line: number) : Observable<ICell> {
        return new Observable<ICell>(subscriber => {
            // Start out empty;
            const cell: ICell = {
                data: {
                    source: this.appendLineFeed(code.split('\n')),
                    cell_type: 'code',
                    outputs: [],
                    metadata: {},
                    execution_count: 0
                },
                id: uuid(),
                file: file,
                line: line,
                state: CellState.init
            };

            // Keep track of when we started.
            const startTime = Date.now();

            // Tell our listener. NOTE: have to do this asap so that markdown cells don't get
            // run before our cells.
            subscriber.next(cell);

            // Attempt to change to the current directory. When that finishes
            // send our real request
            this.changeDirectoryIfPossible(file, line)
                .then(() => {
                    this.handleCodeRequest(subscriber, startTime, cell, code);
                })
                .catch(() => {
                    // Ignore errors if they occur. Just execute normally
                    this.handleCodeRequest(subscriber, startTime, cell, code);
                });
        });
    }

    private addToCellData = (cell: ICell, output : nbformat.IUnrecognizedOutput | nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IStream | nbformat.IError) => {
        const data : nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
        data.outputs = [...data.outputs, output];
        cell.data = data;
    }

    private handleExecuteResult(msg: KernelMessage.IExecuteResultMsg, cell: ICell) {
        this.addToCellData(cell, { output_type : 'execute_result', data: msg.content.data, metadata : msg.content.metadata, execution_count : msg.content.execution_count });
    }

    private handleExecuteInput(msg: KernelMessage.IExecuteInputMsg, cell: ICell) {
        cell.data.execution_count = msg.content.execution_count;
    }

    private handleStatusMessage(msg: KernelMessage.IStatusMsg) {
        if (msg.content.execution_state === 'busy') {
            this.onStatusChangedEvent.fire(true);
        } else {
            this.onStatusChangedEvent.fire(false);
        }
    }

    private handleStreamMesssage(msg: KernelMessage.IStreamMsg, cell: ICell) {
        const output : nbformat.IStream = {
            output_type : 'stream',
            name : msg.content.name,
            text : msg.content.text
        };
        this.addToCellData(cell, output);
    }

    private handleDisplayData(msg: KernelMessage.IDisplayDataMsg, cell: ICell) {
        const output : nbformat.IDisplayData = {
            output_type : 'display_data',
            data: msg.content.data,
            metadata : msg.content.metadata
        };
        this.addToCellData(cell, output);
    }

    private handleError(msg: KernelMessage.IErrorMsg, cell: ICell) {
        const output : nbformat.IError = {
            output_type : 'error',
            ename : msg.content.ename,
            evalue : msg.content.evalue,
            traceback : msg.content.traceback
        };
        this.addToCellData(cell, output);
    }

    private async generateTempFile() : Promise<string> {
        // Create a temp file on disk
        const file = await this.fileSystem.createTemporaryFile('.ipynb');

        // Save in our list disposable
        this.disposableRegistry.push(file);

        return file.filePath;
    }
}
