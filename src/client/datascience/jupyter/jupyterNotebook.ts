// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { nbformat } from '@jupyterlab/coreutils';
import type { Kernel, KernelMessage } from '@jupyterlab/services';
import type { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as uuid from 'uuid/v4';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ServerStatus } from '../../../datascience-ui/interactive-common/mainState';
import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import '../../common/extensions';
import { traceError, traceInfo, traceWarning } from '../../common/logger';

import { IConfigurationService, IDisposableRegistry, Resource } from '../../common/types';
import { createDeferred, Deferred, waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { generateCells } from '../cellFactory';
import { CellMatcher } from '../cellMatcher';
import { CodeSnippets, Identifiers, Telemetry } from '../constants';
import {
    CellState,
    ICell,
    IDataScienceFileSystem,
    IJupyterSession,
    INotebook,
    INotebookCompletion,
    INotebookExecutionInfo,
    INotebookExecutionLogger,
    InterruptResult,
    KernelSocketInformation
} from '../types';
import { expandWorkingDir } from './jupyterUtils';
import { KernelConnectionMetadata } from './kernels/types';

// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import { concatMultilineString, formatStreamText, splitMultilineString } from '../../../datascience-ui/common';
import { RefBool } from '../../common/refBool';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { getInterpreterFromKernelConnectionMetadata, isPythonKernelConnection } from './kernels/helpers';

class CellSubscriber {
    public get startTime(): number {
        return this._startTime;
    }

    public get onCanceled(): Event<void> {
        return this.canceledEvent.event;
    }

    public get promise(): Promise<CellState> {
        return this.deferred.promise;
    }

    public get cell(): ICell {
        return this.cellRef;
    }
    public executionState?: Kernel.Status;
    private deferred: Deferred<CellState> = createDeferred<CellState>();
    private cellRef: ICell;
    private subscriber: Subscriber<ICell>;
    private promiseComplete: (self: CellSubscriber) => void;
    private canceledEvent: EventEmitter<void> = new EventEmitter<void>();
    private _startTime: number;

    constructor(cell: ICell, subscriber: Subscriber<ICell>, promiseComplete: (self: CellSubscriber) => void) {
        this.cellRef = cell;
        this.subscriber = subscriber;
        this.promiseComplete = promiseComplete;
        this._startTime = Date.now();
    }

    public isValid(sessionStartTime: number | undefined) {
        return sessionStartTime && this.startTime >= sessionStartTime;
    }

    public next(sessionStartTime: number | undefined) {
        // Tell the subscriber first
        if (this.isValid(sessionStartTime)) {
            this.subscriber.next(this.cellRef);
        }
    }

    // tslint:disable-next-line:no-any
    public error(sessionStartTime: number | undefined, err: any) {
        if (this.isValid(sessionStartTime)) {
            this.subscriber.error(err);
        }
    }

    public complete(sessionStartTime: number | undefined) {
        if (this.isValid(sessionStartTime)) {
            if (this.cellRef.state !== CellState.error) {
                this.cellRef.state = CellState.finished;
            }
            this.subscriber.next(this.cellRef);
        }
        this.subscriber.complete();

        // Then see if we're finished or not.
        this.attemptToFinish();
    }

    // tslint:disable-next-line:no-any
    public reject(e: any) {
        if (!this.deferred.completed) {
            this.cellRef.state = CellState.error;
            this.subscriber.next(this.cellRef);
            this.subscriber.complete();
            this.deferred.reject(e);
            this.promiseComplete(this);
        }
    }

    public cancel() {
        this.canceledEvent.fire();
        if (!this.deferred.completed) {
            this.cellRef.state = CellState.error;
            this.subscriber.next(this.cellRef);
            this.subscriber.complete();
            this.deferred.resolve();
            this.promiseComplete(this);
        }
    }

    private attemptToFinish() {
        if (
            !this.deferred.completed &&
            (this.cell.state === CellState.finished || this.cell.state === CellState.error)
        ) {
            this.deferred.resolve(this.cell.state);
            this.promiseComplete(this);
        }
    }
}

// This code is based on the examples here:
// https://www.npmjs.com/package/@jupyterlab/services

export class JupyterNotebookBase implements INotebook {
    private sessionStartTime: number;
    private pendingCellSubscriptions: CellSubscriber[] = [];
    private ranInitialSetup = false;
    private _resource: Resource;
    private _identity: Uri;
    private _disposed: boolean = false;
    private _workingDirectory: string | undefined;
    private _executionInfo: INotebookExecutionInfo;
    private onStatusChangedEvent: EventEmitter<ServerStatus> | undefined;
    public get onDisposed(): Event<void> {
        return this.disposedEvent.event;
    }
    public get onKernelChanged(): Event<KernelConnectionMetadata> {
        return this.kernelChanged.event;
    }
    public get disposed() {
        return this._disposed;
    }
    private kernelChanged = new EventEmitter<KernelConnectionMetadata>();
    public get onKernelRestarted(): Event<void> {
        return this.kernelRestarted.event;
    }
    public get onKernelInterrupted(): Event<void> {
        return this.kernelInterrupted.event;
    }
    private readonly kernelRestarted = new EventEmitter<void>();
    private readonly kernelInterrupted = new EventEmitter<void>();
    private disposedEvent = new EventEmitter<void>();
    private sessionStatusChanged: Disposable | undefined;
    private initializedMatplotlib = false;
    private ioPubListeners = new Set<(msg: KernelMessage.IIOPubMessage, requestId: string) => void>();
    public get kernelSocket(): Observable<KernelSocketInformation | undefined> {
        return this.session.kernelSocket;
    }
    public get session(): IJupyterSession {
        return this._session;
    }

    constructor(
        _liveShare: ILiveShareApi, // This is so the liveshare mixin works
        private readonly _session: IJupyterSession,
        private configService: IConfigurationService,
        private disposableRegistry: IDisposableRegistry,
        executionInfo: INotebookExecutionInfo,
        private loggers: INotebookExecutionLogger[],
        resource: Resource,
        identity: Uri,
        private getDisposedError: () => Error,
        private workspace: IWorkspaceService,
        private applicationService: IApplicationShell,
        private fs: IDataScienceFileSystem
    ) {
        this.sessionStartTime = Date.now();

        const statusChangeHandler = (status: ServerStatus) => {
            if (this.onStatusChangedEvent) {
                this.onStatusChangedEvent.fire(status);
            }
        };
        this.sessionStatusChanged = this.session.onSessionStatusChanged(statusChangeHandler);
        this._identity = identity;
        this._resource = resource;

        // Make a copy of the launch info so we can update it in this class
        this._executionInfo = cloneDeep(executionInfo);
    }

    public get connection() {
        return this._executionInfo.connectionInfo;
    }

    public async dispose(): Promise<void> {
        if (!this._disposed) {
            this._disposed = true;
            if (this.onStatusChangedEvent) {
                this.onStatusChangedEvent.dispose();
                this.onStatusChangedEvent = undefined;
            }
            if (this.sessionStatusChanged) {
                this.sessionStatusChanged.dispose();
                this.onStatusChangedEvent = undefined;
            }
            this.loggers.forEach((d) => d.dispose());
            this.disposedEvent.fire();

            try {
                traceInfo(`Shutting down session ${this.identity.toString()}`);
                if (this.session) {
                    await this.session
                        .dispose()
                        .catch(traceError.bind('Failed to dispose session from JupyterNotebook'));
                }
            } catch (exc) {
                traceError(`Exception shutting down session `, exc);
            }
        }
    }

    public get onSessionStatusChanged(): Event<ServerStatus> {
        if (!this.onStatusChangedEvent) {
            this.onStatusChangedEvent = new EventEmitter<ServerStatus>();
        }
        return this.onStatusChangedEvent.event;
    }

    public get status(): ServerStatus {
        if (this.session) {
            return this.session.status;
        }
        return ServerStatus.NotStarted;
    }

    public get resource(): Resource {
        return this._resource;
    }
    public get identity(): Uri {
        return this._identity;
    }

    public waitForIdle(timeoutMs: number): Promise<void> {
        return this.session ? this.session.waitForIdle(timeoutMs) : Promise.resolve();
    }

    // Set up our initial plotting and imports
    public async initialize(cancelToken?: CancellationToken): Promise<void> {
        if (this.ranInitialSetup) {
            return;
        }
        this.ranInitialSetup = true;
        this._workingDirectory = undefined;

        try {
            // When we start our notebook initial, change to our workspace or user specified root directory
            await this.updateWorkingDirectoryAndPath();

            const settings = this.configService.getSettings(this.resource).datascience;
            if (settings && settings.themeMatplotlibPlots) {
                // We're theming matplotlibs, so we have to setup our default state.
                await this.initializeMatplotlib(cancelToken);
            } else {
                this.initializedMatplotlib = false;
                const configInit =
                    !settings || settings.enablePlotViewer ? CodeSnippets.ConfigSvg : CodeSnippets.ConfigPng;
                traceInfo(`Initialize config for plots for ${this.identity.toString()}`);
                await this.executeSilently(configInit, cancelToken);
            }

            // Run any startup commands that we specified. Support the old form too
            let setting = settings.runStartupCommands || settings.runMagicCommands;

            // Convert to string in case we get an array of startup commands.
            if (Array.isArray(setting)) {
                setting = setting.join(`\n`);
            }

            if (setting) {
                // Cleanup the line feeds. User may have typed them into the settings UI so they will have an extra \\ on the front.
                const cleanedUp = setting.replace(/\\n/g, '\n');
                const cells = await this.executeSilently(cleanedUp, cancelToken);
                traceInfo(`Run startup code for notebook: ${cleanedUp} - results: ${cells.length}`);
            }

            traceInfo(`Initial setup complete for ${this.identity.toString()}`);
        } catch (e) {
            traceWarning(e);
        }
    }

    public clear(_id: string): void {
        // We don't do anything as we don't cache results in this class.
        noop();
    }

    public execute(
        code: string,
        file: string,
        line: number,
        id: string,
        cancelToken?: CancellationToken,
        silent?: boolean
    ): Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook.
        const observable = this.executeObservable(code, file, line, id, silent);
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
            }
        );

        if (cancelToken && cancelToken.onCancellationRequested) {
            this.disposableRegistry.push(
                cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError()))
            );
        }

        // Wait for the execution to finish
        return deferred.promise;
    }

    public inspect(code: string, offsetInCode = 0, cancelToken?: CancellationToken): Promise<JSONObject> {
        // Create a deferred that will fire when the request completes
        const deferred = createDeferred<JSONObject>();

        // First make sure still valid.
        const exitError = this.checkForExit();
        if (exitError) {
            // Not running, just exit
            deferred.reject(exitError);
        } else {
            // Ask session for inspect result
            this.session
                .requestInspect({ code, cursor_pos: offsetInCode, detail_level: 0 })
                .then((r) => {
                    if (r && r.content.status === 'ok') {
                        deferred.resolve(r.content.data);
                    } else {
                        deferred.resolve(undefined);
                    }
                })
                .catch((ex) => {
                    deferred.reject(ex);
                });
        }

        if (cancelToken) {
            this.disposableRegistry.push(
                cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError()))
            );
        }

        return deferred.promise;
    }

    public setLaunchingFile(file: string): Promise<void> {
        // Update our working directory if we don't have one set already
        return this.updateWorkingDirectoryAndPath(file);
    }

    public executeObservable(
        code: string,
        file: string,
        line: number,
        id: string,
        silent: boolean = false
    ): Observable<ICell[]> {
        // Create an observable and wrap the result so we can time it.
        const stopWatch = new StopWatch();
        const result = this.executeObservableImpl(code, file, line, id, silent);
        return new Observable<ICell[]>((subscriber) => {
            result.subscribe(
                (cells) => {
                    subscriber.next(cells);
                },
                (error) => {
                    subscriber.error(error);
                },
                () => {
                    subscriber.complete();
                    sendTelemetryEvent(Telemetry.ExecuteCell, stopWatch.elapsedTime);
                }
            );
        });
    }

    public async getSysInfo(): Promise<ICell> {
        // tslint:disable-next-line:no-multiline-string
        const versionCells = await this.executeSilently(`import sys\r\nsys.version`);
        // tslint:disable-next-line:no-multiline-string
        const pathCells = await this.executeSilently(`import sys\r\nsys.executable`);
        // tslint:disable-next-line:no-multiline-string
        const notebookVersionCells = await this.executeSilently(`import notebook\r\nnotebook.version_info`);

        // Both should have streamed output
        const version = versionCells.length > 0 ? this.extractStreamOutput(versionCells[0]).trimQuotes() : '';
        const notebookVersion =
            notebookVersionCells.length > 0 ? this.extractStreamOutput(notebookVersionCells[0]).trimQuotes() : '';
        const pythonPath = versionCells.length > 0 ? this.extractStreamOutput(pathCells[0]).trimQuotes() : '';

        // Combine this data together to make our sys info
        return {
            data: {
                cell_type: 'messages',
                messages: [version, notebookVersion, pythonPath],
                metadata: {},
                source: []
            },
            id: uuid(),
            file: '',
            line: 0,
            state: CellState.finished
        };
    }

    @captureTelemetry(Telemetry.RestartJupyterTime)
    public async restartKernel(timeoutMs: number): Promise<void> {
        if (this.session) {
            // Update our start time so we don't keep sending responses
            this.sessionStartTime = Date.now();

            traceInfo('restartKernel - finishing cells that are outstanding');
            // Complete all pending as an error. We're restarting
            this.finishUncompletedCells();
            traceInfo('restartKernel - restarting kernel');

            // Restart our kernel
            await this.session.restart(timeoutMs);

            // Rerun our initial setup for the notebook
            this.ranInitialSetup = false;
            traceInfo('restartKernel - initialSetup');
            await this.initialize();
            traceInfo('restartKernel - initialSetup completed');

            // Tell our loggers
            this.loggers.forEach((l) => l.onKernelRestarted());

            this.kernelRestarted.fire();
            return;
        }

        throw this.getDisposedError();
    }

    @captureTelemetry(Telemetry.InterruptJupyterTime)
    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        if (this.session) {
            // Keep track of our current time. If our start time gets reset, we
            // restarted the kernel.
            const interruptBeginTime = Date.now();

            // Get just the first pending cell (it should be the oldest). If it doesn't finish
            // by our timeout, then our interrupt didn't work.
            const firstPending =
                this.pendingCellSubscriptions.length > 0 ? this.pendingCellSubscriptions[0] : undefined;

            // Create a promise that resolves when the first pending cell finishes
            const finished = firstPending ? firstPending.promise : Promise.resolve(CellState.finished);

            // Create a deferred promise that resolves if we have a failure
            const restarted = createDeferred<CellState[]>();

            // Listen to status change events so we can tell if we're restarting
            const restartHandler = (e: ServerStatus) => {
                if (e === ServerStatus.Restarting) {
                    // We restarted the kernel.
                    this.sessionStartTime = Date.now();
                    traceWarning('Kernel restarting during interrupt');

                    // Indicate we have to redo initial setup. We can't wait for starting though
                    // because sometimes it doesn't happen
                    this.ranInitialSetup = false;

                    // Indicate we restarted the race below
                    restarted.resolve([]);

                    // Fail all of the active (might be new ones) pending cell executes. We restarted.
                    this.finishUncompletedCells();
                }
            };
            const restartHandlerToken = this.session.onSessionStatusChanged(restartHandler);

            // Start our interrupt. If it fails, indicate a restart
            this.session.interrupt(timeoutMs).catch((exc) => {
                traceWarning(`Error during interrupt: ${exc}`);
                restarted.resolve([]);
            });

            try {
                // Wait for all of the pending cells to finish or the timeout to fire
                const result = await waitForPromise(Promise.race([finished, restarted.promise]), timeoutMs);

                // See if we restarted or not
                if (restarted.completed) {
                    return InterruptResult.Restarted;
                }

                if (result === null) {
                    // We timed out. You might think we should stop our pending list, but that's not
                    // up to us. The cells are still executing. The user has to request a restart or try again
                    return InterruptResult.TimedOut;
                }

                // Cancel all other pending cells as we interrupted.
                this.finishUncompletedCells();

                // Fire event that we interrupted.
                this.kernelInterrupted.fire();

                // Indicate the interrupt worked.
                return InterruptResult.Success;
            } catch (exc) {
                // Something failed. See if we restarted or not.
                if (this.sessionStartTime && interruptBeginTime < this.sessionStartTime) {
                    return InterruptResult.Restarted;
                }

                // Otherwise a real error occurred.
                throw exc;
            } finally {
                restartHandlerToken.dispose();
            }
        }

        throw this.getDisposedError();
    }

    public async setMatplotLibStyle(useDark: boolean): Promise<void> {
        // Make sure matplotlib is initialized
        if (!this.initializedMatplotlib) {
            await this.initializeMatplotlib();
        }

        const settings = this.configService.getSettings(this.resource).datascience;
        if (settings.themeMatplotlibPlots && !settings.ignoreVscodeTheme) {
            // Reset the matplotlib style based on if dark or not.
            await this.executeSilently(
                useDark
                    ? "matplotlib.style.use('dark_background')"
                    : `matplotlib.rcParams.update(${Identifiers.MatplotLibDefaultParams})`
            );
        }
    }

    public async getCompletion(
        cellCode: string,
        offsetInCode: number,
        cancelToken?: CancellationToken
    ): Promise<INotebookCompletion> {
        if (this.session) {
            // If server is busy, then don't delay code completion.
            if (this.session.status === ServerStatus.Busy) {
                return {
                    matches: [],
                    cursor: { start: 0, end: 0 },
                    metadata: []
                };
            }
            const result = await Promise.race([
                this.session!.requestComplete({
                    code: cellCode,
                    cursor_pos: offsetInCode
                }),
                createPromiseFromCancellation({ defaultValue: undefined, cancelAction: 'resolve', token: cancelToken })
            ]);
            if (result && result.content) {
                if ('matches' in result.content) {
                    return {
                        matches: result.content.matches,
                        cursor: {
                            start: result.content.cursor_start,
                            end: result.content.cursor_end
                        },
                        metadata: result.content.metadata
                    };
                }
            }
            return {
                matches: [],
                cursor: { start: 0, end: 0 },
                metadata: []
            };
        }

        // Default is just say session was disposed
        throw new Error(localize.DataScience.sessionDisposed());
    }

    public getMatchingInterpreter(): PythonEnvironment | undefined {
        return getInterpreterFromKernelConnectionMetadata(this.getKernelConnection()) as PythonEnvironment | undefined;
    }

    public getKernelConnection(): KernelConnectionMetadata | undefined {
        return this._executionInfo.kernelConnectionMetadata;
    }

    public async setKernelConnection(connectionMetadata: KernelConnectionMetadata, timeoutMS: number): Promise<void> {
        // We need to start a new session with the new kernel spec
        if (this.session) {
            // Turn off setup
            this.ranInitialSetup = false;

            // Change the kernel on the session
            await this.session.changeKernel(connectionMetadata, timeoutMS);

            // Change our own kernel spec
            // Only after session was successfully created.
            this._executionInfo.kernelConnectionMetadata = connectionMetadata;

            // Rerun our initial setup
            await this.initialize();
        } else {
            // Change our own kernel spec
            this._executionInfo.kernelConnectionMetadata = connectionMetadata;
        }

        this.kernelChanged.fire(connectionMetadata);
    }

    public getLoggers(): INotebookExecutionLogger[] {
        return this.loggers;
    }

    public registerIOPubListener(listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => void): void {
        this.ioPubListeners.add(listener);
    }

    public registerCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ) {
        if (this.session) {
            this.session.registerCommTarget(targetName, callback);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    public sendCommMessage(
        buffers: (ArrayBuffer | ArrayBufferView)[],
        content: { comm_id: string; data: JSONObject; target_name: string | undefined },
        // tslint:disable-next-line: no-any
        metadata: any,
        // tslint:disable-next-line: no-any
        msgId: any
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<'comm_msg'>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    > {
        if (this.session) {
            return this.session.sendCommMessage(buffers, content, metadata, msgId);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    public requestCommInfo(
        content: KernelMessage.ICommInfoRequestMsg['content']
    ): Promise<KernelMessage.ICommInfoReplyMsg> {
        if (this.session) {
            return this.session.requestCommInfo(content);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }
    public registerMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        if (this.session) {
            return this.session.registerMessageHook(msgId, hook);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }
    public removeMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        if (this.session) {
            return this.session.removeMessageHook(msgId, hook);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    private async initializeMatplotlib(cancelToken?: CancellationToken): Promise<void> {
        const settings = this.configService.getSettings(this.resource).datascience;
        if (settings && settings.themeMatplotlibPlots) {
            const matplobInit =
                !settings || settings.enablePlotViewer
                    ? CodeSnippets.MatplotLibInitSvg
                    : CodeSnippets.MatplotLibInitPng;

            traceInfo(`Initialize matplotlib for ${this.identity.toString()}`);
            // Force matplotlib to inline and save the default style. We'll use this later if we
            // get a request to update style
            await this.executeSilently(matplobInit, cancelToken);

            // Use this flag to detemine if we need to rerun this or not.
            this.initializedMatplotlib = true;
        }
    }

    private finishUncompletedCells() {
        const copyPending = [...this.pendingCellSubscriptions];
        copyPending.forEach((c) => c.cancel());
        this.pendingCellSubscriptions = [];
    }

    @captureTelemetry(Telemetry.HiddenCellTime)
    private executeSilently(code: string, cancelToken?: CancellationToken): Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook
        const observable = this.executeObservableImpl(code, Identifiers.EmptyFileName, 0, uuid(), true);
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
            }
        );

        if (cancelToken) {
            this.disposableRegistry.push(
                cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError()))
            );
        }

        // Wait for the execution to finish
        return deferred.promise;
    }

    private extractStreamOutput(cell: ICell): string {
        let result = '';
        if (cell.state === CellState.error || cell.state === CellState.finished) {
            const outputs = cell.data.outputs as nbformat.IOutput[];
            if (outputs) {
                outputs.forEach((o) => {
                    if (o.output_type === 'stream') {
                        const stream = o as nbformat.IStream;
                        result = result.concat(formatStreamText(concatMultilineString(stream.text, true)));
                    } else {
                        const data = o.data;
                        if (data && data.hasOwnProperty('text/plain')) {
                            // tslint:disable-next-line:no-any
                            result = result.concat((data as any)['text/plain']);
                        }
                    }
                });
            }
        }
        return result;
    }

    private executeObservableImpl(
        code: string,
        file: string,
        line: number,
        id: string,
        silent?: boolean
    ): Observable<ICell[]> {
        // If we have a session, execute the code now.
        if (this.session) {
            // Generate our cells ahead of time
            const cells = generateCells(
                this.configService.getSettings(this.resource).datascience,
                code,
                file,
                line,
                true,
                id
            );

            // Might have more than one (markdown might be split)
            if (cells.length > 1) {
                // We need to combine results
                return this.combineObservables(
                    this.executeMarkdownObservable(cells[0]),
                    this.executeCodeObservable(cells[1], silent)
                );
            } else if (cells.length > 0) {
                // Either markdown or or code
                return this.combineObservables(
                    cells[0].data.cell_type === 'code'
                        ? this.executeCodeObservable(cells[0], silent)
                        : this.executeMarkdownObservable(cells[0])
                );
            }
        }

        traceError('No session during execute observable');

        // Can't run because no session
        return new Observable<ICell[]>((subscriber) => {
            subscriber.error(this.getDisposedError());
            subscriber.complete();
        });
    }

    private generateRequest = (
        code: string,
        silent?: boolean,
        // tslint:disable-next-line: no-any
        metadata?: Record<string, any>
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined => {
        //traceInfo(`Executing code in jupyter : ${code}`);
        try {
            const cellMatcher = new CellMatcher(this.configService.getSettings(this.resource).datascience);
            return this.session
                ? this.session.requestExecute(
                      {
                          // Remove the cell marker if we have one.
                          code: cellMatcher.stripFirstMarker(code),
                          stop_on_error: false,
                          allow_stdin: true, // Allow when silent too in case runStartupCommands asks for a password
                          store_history: !silent // Silent actually means don't output anything. Store_history is what affects execution_count
                      },
                      silent, // Dispose only silent futures. Otherwise update_display_data doesn't find a future for a previous cell.
                      metadata
                  )
                : undefined;
        } catch (exc) {
            // Any errors generating a request should just be logged. User can't do anything about it.
            traceError(exc);
        }

        return undefined;
    };

    private combineObservables = (...args: Observable<ICell>[]): Observable<ICell[]> => {
        return new Observable<ICell[]>((subscriber) => {
            // When all complete, we have our results
            const results: Record<string, ICell> = {};

            args.forEach((o) => {
                o.subscribe(
                    (c) => {
                        results[c.id] = c;

                        // Convert to an array
                        const array = Object.keys(results).map((k: string) => {
                            return results[k];
                        });

                        // Update our subscriber of our total results if we have that many
                        if (array.length === args.length) {
                            subscriber.next(array);

                            // Complete when everybody is finished
                            if (array.every((a) => a.state === CellState.finished || a.state === CellState.error)) {
                                subscriber.complete();
                            }
                        }
                    },
                    (e) => {
                        subscriber.error(e);
                    }
                );
            });
        });
    };

    private executeMarkdownObservable = (cell: ICell): Observable<ICell> => {
        // Markdown doesn't need any execution
        return new Observable<ICell>((subscriber) => {
            subscriber.next(cell);
            subscriber.complete();
        });
    };

    private async updateWorkingDirectoryAndPath(launchingFile?: string): Promise<void> {
        if (this._executionInfo && this._executionInfo.connectionInfo.localLaunch && !this._workingDirectory) {
            // See what our working dir is supposed to be
            const suggested = this._executionInfo.workingDir;
            if (suggested && (await this.fs.localDirectoryExists(suggested))) {
                // We should use the launch info directory. It trumps the possible dir
                this._workingDirectory = suggested;
                return this.changeDirectoryIfPossible(this._workingDirectory);
            } else if (launchingFile && (await this.fs.localFileExists(launchingFile))) {
                // Combine the working directory with this file if possible.
                this._workingDirectory = expandWorkingDir(
                    this._executionInfo.workingDir,
                    launchingFile,
                    this.workspace
                );
                if (this._workingDirectory) {
                    return this.changeDirectoryIfPossible(this._workingDirectory);
                }
            }
        }
    }

    // Update both current working directory and sys.path with the desired directory
    private changeDirectoryIfPossible = async (directory: string): Promise<void> => {
        if (
            this._executionInfo &&
            this._executionInfo.connectionInfo.localLaunch &&
            isPythonKernelConnection(this._executionInfo.kernelConnectionMetadata) &&
            (await this.fs.localDirectoryExists(directory))
        ) {
            await this.executeSilently(CodeSnippets.UpdateCWDAndPath.format(directory));
        }
    };

    private handleIOPub(
        subscriber: CellSubscriber,
        silent: boolean | undefined,
        clearState: RefBool,
        msg: KernelMessage.IIOPubMessage
        // tslint:disable-next-line: no-any
    ) {
        // Let our loggers get a first crack at the message. They may change it
        this.getLoggers().forEach((f) => (msg = f.preHandleIOPub ? f.preHandleIOPub(msg) : msg));

        // tslint:disable-next-line:no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

        // Create a trimming function. Only trim user output. Silent output requires the full thing
        const trimFunc = silent ? (s: string) => s : this.trimOutput.bind(this);
        let shouldUpdateSubscriber = true;
        try {
            if (jupyterLab.KernelMessage.isExecuteResultMsg(msg)) {
                this.handleExecuteResult(msg as KernelMessage.IExecuteResultMsg, clearState, subscriber.cell, trimFunc);
            } else if (jupyterLab.KernelMessage.isExecuteInputMsg(msg)) {
                this.handleExecuteInput(msg as KernelMessage.IExecuteInputMsg, clearState, subscriber.cell);
            } else if (jupyterLab.KernelMessage.isStatusMsg(msg)) {
                // If there is no change in the status, then there's no need to update the subscriber.
                // Else we end up sending a number of messages unnecessarily uptream.
                const statusMsg = msg as KernelMessage.IStatusMsg;
                if (statusMsg.content.execution_state === subscriber.executionState) {
                    shouldUpdateSubscriber = false;
                }
                subscriber.executionState = statusMsg.content.execution_state;
                this.handleStatusMessage(statusMsg, clearState, subscriber.cell);
            } else if (jupyterLab.KernelMessage.isStreamMsg(msg)) {
                this.handleStreamMesssage(msg as KernelMessage.IStreamMsg, clearState, subscriber.cell, trimFunc);
            } else if (jupyterLab.KernelMessage.isDisplayDataMsg(msg)) {
                this.handleDisplayData(msg as KernelMessage.IDisplayDataMsg, clearState, subscriber.cell);
            } else if (jupyterLab.KernelMessage.isUpdateDisplayDataMsg(msg)) {
                // No new data to update UI, hence do not send updates.
                shouldUpdateSubscriber = false;
            } else if (jupyterLab.KernelMessage.isClearOutputMsg(msg)) {
                this.handleClearOutput(msg as KernelMessage.IClearOutputMsg, clearState, subscriber.cell);
            } else if (jupyterLab.KernelMessage.isErrorMsg(msg)) {
                this.handleError(msg as KernelMessage.IErrorMsg, clearState, subscriber.cell);
            } else if (jupyterLab.KernelMessage.isCommOpenMsg(msg)) {
                // No new data to update UI, hence do not send updates.
                shouldUpdateSubscriber = false;
            } else if (jupyterLab.KernelMessage.isCommMsgMsg(msg)) {
                // No new data to update UI, hence do not send updates.
                shouldUpdateSubscriber = false;
            } else if (jupyterLab.KernelMessage.isCommCloseMsg(msg)) {
                // No new data to update UI, hence do not send updates.
                shouldUpdateSubscriber = false;
            } else {
                traceWarning(`Unknown message ${msg.header.msg_type} : hasData=${'data' in msg.content}`);
            }

            // Set execution count, all messages should have it
            if ('execution_count' in msg.content && typeof msg.content.execution_count === 'number') {
                subscriber.cell.data.execution_count = msg.content.execution_count as number;
            }

            // Tell all of the listeners about the event.
            [...this.ioPubListeners].forEach((l) => l(msg, msg.header.msg_id));

            // Show our update if any new output.
            if (shouldUpdateSubscriber) {
                subscriber.next(this.sessionStartTime);
            }
        } catch (err) {
            // If not a restart error, then tell the subscriber
            subscriber.error(this.sessionStartTime, err);
        }
    }

    private checkForExit(): Error | undefined {
        if (this._executionInfo && this._executionInfo.connectionInfo && !this._executionInfo.connectionInfo.valid) {
            if (this._executionInfo.connectionInfo.type === 'jupyter') {
                // Not running, just exit
                if (this._executionInfo.connectionInfo.localProcExitCode) {
                    const exitCode = this._executionInfo.connectionInfo.localProcExitCode;
                    traceError(`Jupyter crashed with code ${exitCode}`);
                    return new Error(localize.DataScience.jupyterServerCrashed().format(exitCode.toString()));
                }
            }
        }

        return undefined;
    }

    private handleInputRequest(_subscriber: CellSubscriber, msg: KernelMessage.IStdinMessage) {
        // Ask the user for input
        if (msg.content && 'prompt' in msg.content) {
            const hasPassword = msg.content.password !== null && (msg.content.password as boolean);
            this.applicationService
                .showInputBox({
                    prompt: msg.content.prompt ? msg.content.prompt.toString() : '',
                    ignoreFocusOut: true,
                    password: hasPassword
                })
                .then((v) => {
                    this.session.sendInputReply(v || '');
                });
        }
    }

    private handleReply(
        subscriber: CellSubscriber,
        silent: boolean | undefined,
        clearState: RefBool,
        msg: KernelMessage.IShellControlMessage
    ) {
        // tslint:disable-next-line:no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

        // Create a trimming function. Only trim user output. Silent output requires the full thing
        const trimFunc = silent ? (s: string) => s : this.trimOutput.bind(this);

        if (jupyterLab.KernelMessage.isExecuteReplyMsg(msg)) {
            this.handleExecuteReply(msg, clearState, subscriber.cell, trimFunc);

            // Set execution count, all messages should have it
            if ('execution_count' in msg.content && typeof msg.content.execution_count === 'number') {
                subscriber.cell.data.execution_count = msg.content.execution_count as number;
            }

            // Send this event.
            subscriber.next(this.sessionStartTime);
        }
    }

    // tslint:disable-next-line: max-func-body-length
    private handleCodeRequest = (subscriber: CellSubscriber, silent?: boolean) => {
        // Generate a new request if we still can
        if (subscriber.isValid(this.sessionStartTime)) {
            // Double check process is still running
            const exitError = this.checkForExit();
            if (exitError) {
                // Not running, just exit
                subscriber.error(this.sessionStartTime, exitError);
                subscriber.complete(this.sessionStartTime);
            } else {
                const request = this.generateRequest(concatMultilineString(subscriber.cell.data.source), silent, {
                    ...subscriber.cell.data.metadata,
                    ...{ cellId: subscriber.cell.id }
                });

                // Transition to the busy stage
                subscriber.cell.state = CellState.executing;

                // Make sure our connection doesn't go down
                let exitHandlerDisposable: Disposable | undefined;
                if (this._executionInfo && this._executionInfo.connectionInfo) {
                    // If the server crashes, cancel the current observable
                    exitHandlerDisposable = this._executionInfo.connectionInfo.disconnected((c) => {
                        const str = c ? c.toString() : '';
                        // Only do an error if we're not disposed. If we're disposed we already shutdown.
                        if (!this._disposed) {
                            subscriber.error(
                                this.sessionStartTime,
                                new Error(localize.DataScience.jupyterServerCrashed().format(str))
                            );
                        }
                        subscriber.complete(this.sessionStartTime);
                    });
                }

                // Keep track of our clear state
                const clearState = new RefBool(false);

                // Listen to the reponse messages and update state as we go
                if (request) {
                    // Stop handling the request if the subscriber is canceled.
                    subscriber.onCanceled(() => {
                        request.onIOPub = noop;
                        request.onStdin = noop;
                        request.onReply = noop;
                    });

                    // Listen to messages.
                    request.onIOPub = this.handleIOPub.bind(this, subscriber, silent, clearState);
                    request.onStdin = this.handleInputRequest.bind(this, subscriber);
                    request.onReply = this.handleReply.bind(this, subscriber, silent, clearState);

                    // When the request finishes we are done
                    request.done
                        .then(() => subscriber.complete(this.sessionStartTime))
                        .catch((e) => {
                            // @jupyterlab/services throws a `Canceled` error when the kernel is interrupted.
                            // Such an error must be ignored.
                            if (e && e instanceof Error && e.message === 'Canceled') {
                                subscriber.complete(this.sessionStartTime);
                            } else {
                                subscriber.error(this.sessionStartTime, e);
                            }
                        })
                        .finally(() => {
                            if (exitHandlerDisposable) {
                                exitHandlerDisposable.dispose();
                            }
                        })
                        .ignoreErrors();
                } else {
                    subscriber.error(this.sessionStartTime, this.getDisposedError());
                }
            }
        } else {
            const sessionDate = new Date(this.sessionStartTime!);
            const cellDate = new Date(subscriber.startTime);
            traceInfo(
                `Session start time is newer than cell : \r\n${sessionDate.toTimeString()}\r\n${cellDate.toTimeString()}`
            );

            // Otherwise just set to an error
            this.handleInterrupted(subscriber.cell);
            subscriber.cell.state = CellState.error;
            subscriber.complete(this.sessionStartTime);
        }
    };

    private executeCodeObservable(cell: ICell, silent?: boolean): Observable<ICell> {
        return new Observable<ICell>((subscriber) => {
            // Tell our listener. NOTE: have to do this asap so that markdown cells don't get
            // run before our cells.
            subscriber.next(cell);
            const isSilent = silent !== undefined ? silent : false;

            // Wrap the subscriber and save it. It is now pending and waiting completion. Have to do this
            // synchronously so it happens before interruptions.
            const cellSubscriber = new CellSubscriber(cell, subscriber, (self: CellSubscriber) => {
                // Subscriber completed, remove from subscriptions.
                this.pendingCellSubscriptions = this.pendingCellSubscriptions.filter((p) => p !== self);

                // Indicate success or failure
                this.logPostCode(cell, isSilent).ignoreErrors();
            });
            this.pendingCellSubscriptions.push(cellSubscriber);

            // Log the pre execution.
            this.logPreCode(cell, isSilent)
                .then(() => {
                    // Now send our real request. This should call back on the cellsubscriber when it's done.
                    this.handleCodeRequest(cellSubscriber, silent);
                })
                .ignoreErrors();
        });
    }

    private async logPreCode(cell: ICell, silent: boolean): Promise<void> {
        await Promise.all(this.loggers.map((l) => l.preExecute(cell, silent)));
    }

    private async logPostCode(cell: ICell, silent: boolean): Promise<void> {
        await Promise.all(this.loggers.map((l) => l.postExecute(cloneDeep(cell), silent)));
    }

    private addToCellData = (
        cell: ICell,
        output: nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IStream | nbformat.IError,
        clearState: RefBool
    ) => {
        const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;

        // Clear if necessary
        if (clearState.value) {
            data.outputs = [];
            clearState.update(false);
        }

        // Append to the data.
        data.outputs = [...data.outputs, output];
        cell.data = data;
    };

    // See this for docs on the messages:
    // https://jupyter-client.readthedocs.io/en/latest/messaging.html#messaging-in-jupyter
    private handleExecuteResult(
        msg: KernelMessage.IExecuteResultMsg,
        clearState: RefBool,
        cell: ICell,
        trimFunc: (str: string) => string
    ) {
        // Check our length on text output
        if (msg.content.data && msg.content.data.hasOwnProperty('text/plain')) {
            msg.content.data['text/plain'] = splitMultilineString(
                // tslint:disable-next-line: no-any
                trimFunc(concatMultilineString(msg.content.data['text/plain'] as any))
            );
        }

        this.addToCellData(
            cell,
            {
                output_type: 'execute_result',
                data: msg.content.data,
                metadata: msg.content.metadata,
                // tslint:disable-next-line: no-any
                transient: msg.content.transient as any, // NOSONAR
                execution_count: msg.content.execution_count
            },
            clearState
        );
    }

    private handleExecuteReply(
        msg: KernelMessage.IExecuteReplyMsg,
        clearState: RefBool,
        cell: ICell,
        trimFunc: (str: string) => string
    ) {
        const reply = msg.content as KernelMessage.IExecuteReply;
        if (reply.payload) {
            reply.payload.forEach((o) => {
                if (o.data && o.data.hasOwnProperty('text/plain')) {
                    // tslint:disable-next-line: no-any
                    const str = concatMultilineString((o.data as any)['text/plain']); // NOSONAR
                    const data = trimFunc(str);
                    this.addToCellData(
                        cell,
                        {
                            // Mark as stream output so the text is formatted because it likely has ansi codes in it.
                            output_type: 'stream',
                            text: splitMultilineString(data),
                            name: 'stdout',
                            metadata: {},
                            execution_count: reply.execution_count
                        },
                        clearState
                    );
                }
            });
        }
    }

    private handleExecuteInput(msg: KernelMessage.IExecuteInputMsg, _clearState: RefBool, cell: ICell) {
        cell.data.execution_count = msg.content.execution_count;
    }

    private handleStatusMessage(msg: KernelMessage.IStatusMsg, _clearState: RefBool, _cell: ICell) {
        traceInfo(`Kernel switching to ${msg.content.execution_state}`);
    }

    private handleStreamMesssage(
        msg: KernelMessage.IStreamMsg,
        clearState: RefBool,
        cell: ICell,
        trimFunc: (str: string) => string
    ) {
        const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
        let originalTextLength = 0;
        let trimmedTextLength = 0;

        // Clear output if waiting for a clear
        if (clearState.value) {
            data.outputs = [];
            clearState.update(false);
        }

        // Might already have a stream message. If so, just add on to it.
        const existing =
            data.outputs.length > 0 && data.outputs[data.outputs.length - 1].output_type === 'stream'
                ? data.outputs[data.outputs.length - 1]
                : undefined;
        if (existing) {
            const originalText = formatStreamText(
                // tslint:disable-next-line: no-any
                `${concatMultilineString(existing.text as any)}${concatMultilineString(msg.content.text)}`
            );
            originalTextLength = originalText.length;
            const newText = trimFunc(originalText);
            trimmedTextLength = newText.length;
            existing.text = splitMultilineString(newText);
        } else {
            const originalText = formatStreamText(concatMultilineString(msg.content.text));
            originalTextLength = originalText.length;
            // Create a new stream entry
            const output: nbformat.IStream = {
                output_type: 'stream',
                name: msg.content.name,
                text: [trimFunc(originalText)]
            };
            data.outputs = [...data.outputs, output];
            trimmedTextLength = output.text[0].length;
            cell.data = data;
        }

        // If the output was trimmed, we add the 'outputPrepend' metadata tag.
        // Later, the react side will display a message letting the user know
        // the output is trimmed and what setting changes that.
        // * If data.metadata.tags is undefined, define it so the following
        //   code is can rely on it being defined.
        if (trimmedTextLength < originalTextLength) {
            if (data.metadata.tags === undefined) {
                data.metadata.tags = [];
            }
            data.metadata.tags = data.metadata.tags.filter((t) => t !== 'outputPrepend');
            data.metadata.tags.push('outputPrepend');
        }
    }

    private handleDisplayData(msg: KernelMessage.IDisplayDataMsg, clearState: RefBool, cell: ICell) {
        const output: nbformat.IDisplayData = {
            output_type: 'display_data',
            data: msg.content.data,
            metadata: msg.content.metadata,
            // tslint:disable-next-line: no-any
            transient: msg.content.transient as any // NOSONAR
        };
        this.addToCellData(cell, output, clearState);
    }

    private handleClearOutput(msg: KernelMessage.IClearOutputMsg, clearState: RefBool, cell: ICell) {
        // If the message says wait, add every message type to our clear state. This will
        // make us wait for this type of output before we clear it.
        if (msg && msg.content.wait) {
            clearState.update(true);
        } else {
            // Clear all outputs and start over again.
            const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
            data.outputs = [];
        }
    }

    private handleInterrupted(cell: ICell) {
        this.handleError(
            {
                channel: 'iopub',
                parent_header: {},
                metadata: {},
                header: { username: '', version: '', session: '', msg_id: '', msg_type: 'error', date: '' },
                content: {
                    ename: 'KeyboardInterrupt',
                    evalue: '',
                    // Does this need to be translated? All depends upon if jupyter does or not
                    traceback: [
                        '[1;31m---------------------------------------------------------------------------[0m',
                        '[1;31mKeyboardInterrupt[0m: '
                    ]
                }
            },
            new RefBool(false),
            cell
        );
    }

    private handleError(msg: KernelMessage.IErrorMsg, clearState: RefBool, cell: ICell) {
        const output: nbformat.IError = {
            output_type: 'error',
            ename: msg.content.ename,
            evalue: msg.content.evalue,
            traceback: msg.content.traceback
        };
        if (msg.content.hasOwnProperty('transient')) {
            // tslint:disable-next-line: no-any
            output.transient = (msg.content as any).transient;
        }
        this.addToCellData(cell, output, clearState);
        cell.state = CellState.error;

        // In the error scenario, we want to stop all other pending cells.
        if (this.configService.getSettings(this.resource).datascience.stopOnError) {
            this.pendingCellSubscriptions.forEach((c) => {
                if (c.cell.id !== cell.id) {
                    c.cancel();
                }
            });
        }
    }

    // We have a set limit for the number of output text characters that we display by default
    // trim down strings to that limit, assuming at this point we have compressed down to a single string
    private trimOutput(outputString: string): string {
        const outputLimit = this.configService.getSettings(this.resource).datascience.textOutputLimit;

        if (!outputLimit || outputLimit === 0 || outputString.length <= outputLimit) {
            return outputString;
        }

        return outputString.substr(outputString.length - outputLimit);
    }
}
