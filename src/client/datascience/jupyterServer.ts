// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import { Kernel, KernelMessage, ServerConnection, Session } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as uuid from 'uuid/v4';
import * as vscode from 'vscode';

import { IFileSystem } from '../common/platform/types';
import { IDisposableRegistry, ILogger } from '../common/types';
import { createDeferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { RegExpValues } from './constants';
import { CellState, ICell, IJupyterAvailability, INotebookProcess, INotebookServer } from './types';

// This code is based on the examples here:
// https://www.npmjs.com/package/@jupyterlab/services

@injectable()
export class JupyterServer implements INotebookServer {
    public isDisposed: boolean = false;
    private session: Session.ISession | undefined;
    private tempFile: string | undefined;
    private onStatusChangedEvent : vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();

    constructor(
        @inject(ILogger) private logger: ILogger,
        @inject(INotebookProcess) private process: INotebookProcess,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IJupyterAvailability) private availability : IJupyterAvailability) {
    }

    public start = async () : Promise<boolean> => {

        if (await this.availability.isNotebookSupported()) {

            // First generate a temporary notebook. We need this as input to the session
            this.tempFile = await this.generateTempFile();

            // start our process in the same directory as our ipynb file.
            await this.process.start(path.dirname(this.tempFile));

            // Wait for connection information. We'll stick that into the options
            const connInfo = await this.process.waitForConnectionInformation();

            // Create our session options using this temporary notebook and our connection info
            const options: Session.IOptions = {
                path: this.tempFile,
                kernelName: 'python',
                serverSettings: ServerConnection.makeSettings(
                    {
                        baseUrl: connInfo.baseUrl,
                        token: connInfo.token,
                        pageUrl: '',
                        // A web socket is required to allow token authentication
                        wsUrl: connInfo.baseUrl.replace('http', 'ws'),
                        init: { cache: 'no-store', credentials: 'same-origin' }
                    })
            };

            // Start a new session
            this.session = await Session.startNew(options);

            // Setup the default imports (this should be configurable in the future)
            this.executeSilently(
                'import pandas as pd\r\nimport numpy\r\n%matplotlib inline\r\nimport matplotlib.pyplot as plt'
            ).ignoreErrors();

            return true;
        } else {
            throw localize.DataScience.jupyterNotSupported();
        }

    }

    public shutdown = async () : Promise<void> => {
        if (this.session) {
            await this.session.shutdown();
            this.session.dispose();
            this.session = undefined;
        }
        if (this.process) {
            this.process.dispose();
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
                deferred.resolve(output);
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
            subscriber.error(localize.DataScience.sessionDisposed());
            subscriber.complete();
        });
    }

    public executeSilently = (code: string) : Promise<void> => {
        // If we have a session, execute the code now.
        if (this.session) {
            const request = this.session.kernel.requestExecute(
                {
                    // Replace windows line endings with unix line endings.
                    code: code.replace('\r\n', '\n'),
                    stop_on_error: false,
                    allow_stdin: false,
                    silent: true
                },
                true
            );

            return new Promise((resolve, reject) => {
                // Just wait for our observable to finish
                const observable = this.generateExecuteObservable(code, 'file', -1, '0', request);
                // tslint:disable-next-line:no-empty
                observable.subscribe(() => {
                },
                    reject,
                    resolve);
            });
        }

        return Promise.reject(new Error(localize.DataScience.sessionDisposed()));
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

    public restartKernel = () : Promise<void> => {
        if (this.session && this.session.kernel) {
            return this.session.kernel.restart();
        }

        return Promise.reject(new Error(localize.DataScience.sessionDisposed()));
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

    private changeDirectoryObservable = (file: string) : Observable<boolean> => {
        return new Observable<boolean>(subscriber => {
            // Execute some code and when its done, finish our subscriber
            const dir = path.dirname(file);
            this.executeSilently(`%cd "${dir}"`)
                .then(() => {
                    subscriber.next(true);
                    subscriber.complete();
                })
                .catch(err => subscriber.error(err));
        });
    }

    private chainObservables<T>(first : Observable<T>, second : () => Observable<ICell>) : Observable<ICell> {
        return new Observable<ICell>(subscriber => {
            first.subscribe(
                () => { return; },
                (err) => subscriber.error(err),
                () => {
                    // When the first completes, tell the second to go
                    second().subscribe((cell : ICell) => {
                        subscriber.next(cell);
                    },
                    (err) => {
                        subscriber.error(err);
                    },
                    () => {
                        subscriber.complete();
                    });
                }
            );
        });
    }

    private executeCodeObservable = (code: string, file: string, line: number) : Observable<ICell> => {

        if (this.session) {
            // Send a magic that changes the current directory if we aren't already sending a magic
            if (line >= 0 && fs.existsSync(file)) {
                return this.chainObservables(
                    this.changeDirectoryObservable(file),
                    () => this.executeCodeObservableInternal(code, file, line));
            } else {
                // We're inside of an execute silently already, don't recurse
                return this.executeCodeObservableInternal(code, file, line);
            }
        }

        return new Observable<ICell>(subscriber => {
            subscriber.error(localize.DataScience.sessionDisposed());
            subscriber.complete();
        });
    }

    private executeCodeObservableInternal = (code: string, file: string, line: number) : Observable<ICell> => {
        // Send an execute request with this code
        const id = uuid();
        const request = this.session ? this.session.kernel.requestExecute(
            {
                code: code,
                stop_on_error: false,
                allow_stdin: false
            },
            true
        ) : undefined;

        return this.generateExecuteObservable(code, file, line, id, request);
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

    private generateExecuteObservable(code: string, file: string, line: number, id: string, request: Kernel.IFuture | undefined) : Observable<ICell> {
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
                id: id,
                file: file,
                line: line,
                state: CellState.init
            };

            // Tell our listener.
            subscriber.next(cell);

            // Transition to the busy stage
            cell.state = CellState.executing;
            subscriber.next(cell);

            // Listen to the reponse messages and update state as we go
            if (request) {
                request.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
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
                };

                // Create completion and error functions so we can bind our cell object
                const completion = () => {
                    cell.state = CellState.finished;
                    subscriber.next(cell);
                    subscriber.complete();
                };
                const error = () => {
                    cell.state = CellState.error;
                    subscriber.next(cell);
                    subscriber.complete();
                };

                // When the request finishes we are done
                request.done.then(completion, error);
            } else {
                subscriber.error(localize.DataScience.sessionDisposed());
            }

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
