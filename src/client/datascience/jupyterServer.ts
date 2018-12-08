// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import {
    Contents,
    ContentsManager,
    Kernel,
    KernelMessage,
    ServerConnection,
    Session,
    SessionManager
} from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as vscode from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { IWorkspaceService } from '../common/application/types';
import { Cancellation, CancellationError } from '../common/cancellation';
import { IAsyncDisposableRegistry, IDisposable, IDisposableRegistry, ILogger } from '../common/types';
import { createDeferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { generateCells } from './cellFactory';
import { concatMultilineString } from './common';
import { CellState, ICell, IConnection, IJupyterKernelSpec, INotebookServer } from './types';

// This code is based on the examples here:
// https://www.npmjs.com/package/@jupyterlab/services

@injectable()
export class JupyterServer implements INotebookServer, IDisposable {
    private connInfo: IConnection | undefined;
    private kernelSpec: IJupyterKernelSpec | undefined;
    private workingDir: string | undefined;
    private session: Session.ISession | undefined;
    private sessionManager : SessionManager | undefined;
    private contentsManager: ContentsManager | undefined;
    private notebookFile: Contents.IModel | undefined;
    private sessionStartTime: number | undefined;
    private onStatusChangedEvent : vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();

    constructor(
        @inject(ILogger) private logger: ILogger,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IAsyncDisposableRegistry) private asyncRegistry: IAsyncDisposableRegistry) {
        this.disposableRegistry.push(this);
        this.asyncRegistry.push(this);
    }

    public connect = async (connInfo: IConnection, kernelSpec: IJupyterKernelSpec, cancelToken?: CancellationToken, workingDir?: string) : Promise<void> => {
        // Save connection information so we can use it later during shutdown
        this.connInfo = connInfo;
        this.kernelSpec = kernelSpec;
        this.workingDir = workingDir;

        // First connect to the sesssion manager
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

        // Create a temporary .ipynb file to use
        this.contentsManager = new ContentsManager({ serverSettings: serverSettings });
        this.notebookFile = await this.contentsManager.newUntitled({type: 'notebook'});

        // Create our session options using this temporary notebook and our connection info
        const options: Session.IOptions = {
            path: this.notebookFile.path,
            kernelName: kernelSpec ? kernelSpec.name : '',
            serverSettings: serverSettings
        };

        // Start a new session
        this.session = await Cancellation.race(() => this.sessionManager!.startNew(options), cancelToken);

        // Setup our start time. We reject anything that comes in before this time during execute
        this.sessionStartTime = Date.now();

        // Wait for it to be ready
        await this.session.kernel.ready;

        // Run our initial setup and plot magics
        await this.initialNotebookSetup(cancelToken);
    }

    public shutdown = () => {
        this.destroyKernelSpec();

        if (this.notebookFile && this.contentsManager) {
            this.contentsManager.delete(this.notebookFile.path).then(() => {
                this.shutdownSessionAndConnection();
            }).catch(() => {
                this.shutdownSessionAndConnection();
            }); // Sadly looks like node.js version doesn't have .finally yet
        } else {
            this.shutdownSessionAndConnection();
        }
    }

    public dispose = () : Promise<void> => {
        // This could be changed to actually wait for shutdown, but do this
        // for now so we finish quickly.
        return Promise.resolve(this.shutdown());
    }

    public waitForIdle = async () : Promise<void> => {
        if (this.session && this.session.kernel) {
            await this.session.kernel.ready;

            while (this.session.kernel.status !== 'idle') {
                await this.timeout(0);
            }
        }
    }

    public getCurrentState() : Promise<ICell[]> {
        return Promise.resolve([]);
    }

    public execute(code : string, file: string, line: number, cancelToken?: CancellationToken) : Promise<ICell[]> {
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

        if (cancelToken) {
            this.disposableRegistry.push(cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError())));
        }

        // Wait for the execution to finish
        return deferred.promise;
    }

    public setInitialDirectory = async (directory: string): Promise<void> => {
        // If we launched local and have no working directory call this on add code to change directory
        if (!this.workingDir && this.connInfo && this.connInfo.localLaunch) {
            await this.changeDirectoryIfPossible(directory);
            this.workingDir = directory;
        }
    }

    public executeObservable = (code: string, file: string, line: number) : Observable<ICell[]> => {
        // If we have a session, execute the code now.
        if (this.session) {
            // Generate our cells ahead of time
            const cells = generateCells(code, file, line);

            // Might have more than one (markdown might be split)
            if (cells.length > 1) {
                // We need to combine results
                return this.combineObservables(
                    this.executeMarkdownObservable(cells[0]),
                    this.executeCodeObservable(cells[1]));
            } else if (cells.length > 0) {
                // Either markdown or or code
                return this.combineObservables(
                    cells[0].data.cell_type === 'code' ? this.executeCodeObservable(cells[0]) : this.executeMarkdownObservable(cells[0]));
            }
        }

        // Can't run because no session
        return new Observable<ICell[]>(subscriber => {
            subscriber.error(new Error(localize.DataScience.sessionDisposed()));
            subscriber.complete();
        });
    }

    public executeSilently = (code: string, cancelToken?: CancellationToken) : Promise<void> => {
        return new Promise((resolve, reject) => {

            // If we cancel, reject our promise
            if (cancelToken) {
                this.disposableRegistry.push(cancelToken.onCancellationRequested(() => reject(new CancellationError())));
            }

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

    public restartKernel = async () : Promise<void> => {
        if (this.session && this.session.kernel) {
            // Update our start time so we don't keep sending responses
            this.sessionStartTime = Date.now();

            // Restart our kernel
            await this.session.kernel.restart();

            // Rerun our initial setup for the notebook
            await this.initialNotebookSetup();

            return;
        }

        throw new Error(localize.DataScience.sessionDisposed());
    }

    public interruptKernel = () : Promise<void> => {
        if (this.session && this.session.kernel) {
            // Interrupt whatever is happening
            return this.session.kernel.interrupt();
        }

        return Promise.reject(new Error(localize.DataScience.sessionDisposed()));
    }

    private shutdownSessionAndConnection = () => {
        if (this.contentsManager) {
            this.contentsManager.dispose();
            this.contentsManager = undefined;
        }
        if (this.session && this.sessionManager) {
            try {
                this.session.shutdown().ignoreErrors();
                this.session.dispose();
                this.sessionManager.dispose();
            } catch {
                noop();
            }
            this.session = undefined;
            this.sessionManager = undefined;
        }
        this.onStatusChangedEvent.dispose();
        if (this.connInfo) {
            this.connInfo.dispose(); // This should kill the process that's running
            this.connInfo = undefined;
        }
    }

    private destroyKernelSpec = () => {
        if (this.kernelSpec) {
            this.kernelSpec.dispose(); // This should delete any old kernel specs
            this.kernelSpec = undefined;
        }
    }

    private generateRequest = (code: string, silent: boolean) : Kernel.IFuture | undefined => {
        //this.logger.logInformation(`Executing code in jupyter : ${code}`)
        return this.session ? this.session.kernel.requestExecute(
            {
                // Replace windows line endings with unix line endings.
                code: code.replace(/\r\n/g, '\n'),
                stop_on_error: false,
                allow_stdin: false,
                silent: silent
            },
            true
        ) : undefined;
    }

    // Set up our initial plotting and imports
    private initialNotebookSetup = async (cancelToken?: CancellationToken) => {
        // When we start our notebook initial, change to our workspace or user specified root directory
        if (this.connInfo && this.connInfo.localLaunch && this.workingDir) {
            await this.changeDirectoryIfPossible(this.workingDir);
        }

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
            `%matplotlib inline${os.EOL}import matplotlib.pyplot as plt${darkTheme ? `${os.EOL}from matplotlib import style${os.EOL}style.use(\'dark_background\')` : ''}`,
            cancelToken
        ).ignoreErrors();
    }

    private timeout(ms : number) : Promise<number> {
        return new Promise(resolve => setTimeout(resolve, ms, ms));
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

    private executeMarkdownObservable = (cell: ICell) : Observable<ICell> => {
        // Markdown doesn't need any execution
        return new Observable<ICell>(subscriber => {
            subscriber.next(cell);
            subscriber.complete();
        });
    }

    private changeDirectoryIfPossible = async (directory: string) : Promise<void> => {
        if (this.connInfo && this.connInfo.localLaunch && await fs.pathExists(directory)) {
            await this.executeSilently(`%cd "${directory}"`);
        }
    }

    private handleCodeRequest = (subscriber: Subscriber<ICell>, startTime: number, cell: ICell) => {
        // Generate a new request if we still can
        if (this.sessionStartTime && startTime > this.sessionStartTime) {

            const request = this.generateRequest(concatMultilineString(cell.data.source), false);

            // tslint:disable-next-line:no-require-imports
            const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

            // Transition to the busy stage
            cell.state = CellState.executing;

            // Listen to the reponse messages and update state as we go
            if (request) {
                request.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                    try {
                        if (jupyterLab.KernelMessage.isExecuteResultMsg(msg)) {
                            this.handleExecuteResult(msg as KernelMessage.IExecuteResultMsg, cell);
                        } else if (jupyterLab.KernelMessage.isExecuteInputMsg(msg)) {
                            this.handleExecuteInput(msg as KernelMessage.IExecuteInputMsg, cell);
                        } else if (jupyterLab.KernelMessage.isStatusMsg(msg)) {
                            this.handleStatusMessage(msg as KernelMessage.IStatusMsg, cell);
                        } else if (jupyterLab.KernelMessage.isStreamMsg(msg)) {
                            this.handleStreamMesssage(msg as KernelMessage.IStreamMsg, cell);
                        } else if (jupyterLab.KernelMessage.isDisplayDataMsg(msg)) {
                            this.handleDisplayData(msg as KernelMessage.IDisplayDataMsg, cell);
                        } else if (jupyterLab.KernelMessage.isErrorMsg(msg)) {
                            this.handleError(msg as KernelMessage.IErrorMsg, cell);
                        } else {
                            this.logger.logWarning(`Unknown message ${msg.header.msg_type} : hasData=${'data' in msg.content}`);
                        }

                        // Set execution count, all messages should have it
                        if (msg.content.execution_count) {
                            cell.data.execution_count = msg.content.execution_count as number;
                        }

                        // Show our update if any new output
                        if (this.sessionStartTime && startTime > this.sessionStartTime) {
                            subscriber.next(cell);
                        }
                    } catch (err) {
                        // If not a restart error, then tell the subscriber
                        if (this.sessionStartTime && startTime > this.sessionStartTime) {
                            this.logger.logError(`Error during message ${msg.header.msg_type}`);
                            subscriber.error(err);
                        }
                    }
                };

                // Create completion and error functions so we can bind our cell object
                // tslint:disable-next-line:no-any
                const completion = (error?: any) => {
                    cell.state = error as Error ? CellState.error : CellState.finished;
                    // Only do this if start time is still valid. Dont log an error to the subscriber. Error
                    // state should end up in the cell output.
                    if (this.sessionStartTime && startTime > this.sessionStartTime) {
                        subscriber.next(cell);
                    }
                    subscriber.complete();
                };

                // When the request finishes we are done
                request.done.then(completion).catch(completion);
            } else {
                subscriber.error(new Error(localize.DataScience.sessionDisposed()));
            }
        } else {
            // Otherwise just set to an error
            this.handleInterrupted(cell);
            cell.state = CellState.error;
            subscriber.next(cell);
            subscriber.complete();
        }

    }

    private executeCodeObservable(cell: ICell) : Observable<ICell> {
        return new Observable<ICell>(subscriber => {
            // Keep track of when we started.
            const startTime = Date.now();

            // Tell our listener. NOTE: have to do this asap so that markdown cells don't get
            // run before our cells.
            subscriber.next(cell);

            // Attempt to change to the current directory. When that finishes
            // send our real request
            this.handleCodeRequest(subscriber, startTime, cell);
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

    private handleStatusMessage(msg: KernelMessage.IStatusMsg, cell: ICell) {
        if (msg.content.execution_state === 'busy') {
            this.onStatusChangedEvent.fire(true);
        } else {
            this.onStatusChangedEvent.fire(false);
        }

        // Status change to idle generally means we finished. Not sure how to
        // make sure of this. Maybe only bother if an in
        if (msg.content.execution_state === 'idle' && cell.state !== CellState.error) {
            cell.state = CellState.finished;
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

    private handleInterrupted(cell : ICell) {
        this.handleError({
            channel: 'iopub',
            parent_header: {},
            metadata: {},
            header: { username: '', version: '', session: '', msg_id: '', msg_type: 'error' },
            content: {
                ename: 'KeyboardInterrupt',
                evalue: '',
                // Does this need to be translated? All depends upon if jupyter does or not
                traceback: [
                    '[1;31m---------------------------------------------------------------------------[0m',
                    '[1;31mKeyboardInterrupt[0m: '
                ]
            }
        }, cell);
    }

    private handleError(msg: KernelMessage.IErrorMsg, cell: ICell) {
        const output : nbformat.IError = {
            output_type : 'error',
            ename : msg.content.ename,
            evalue : msg.content.evalue,
            traceback : msg.content.traceback
        };
        this.addToCellData(cell, output);
        cell.state = CellState.error;
    }
}
