// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import type { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import { injectable, unmanaged } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import {
    CancellationToken,
    commands,
    ConfigurationTarget,
    Event,
    EventEmitter,
    Memento,
    Position,
    Range,
    Selection,
    TextEditor,
    Uri,
    ViewColumn
} from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { ServerStatus } from '../../../datascience-ui/interactive-common/mainState';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { CancellationError } from '../../common/cancellation';
import { EXTENSION_ROOT_DIR, isTestExecution, PYTHON_LANGUAGE } from '../../common/constants';
import { RunByLine, WebHostNotebook } from '../../common/experiments/groups';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IExperimentsManager } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { PythonInterpreter } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { generateCellRangesFromDocument } from '../cellFactory';
import { CellMatcher } from '../cellMatcher';
import { addToUriList, translateKernelLanguageToMonaco } from '../common';
import { Commands, Identifiers, Telemetry } from '../constants';
import { ColumnWarningSize, IDataViewerFactory } from '../data-viewing/types';
import {
    IAddedSysInfo,
    ICopyCode,
    IGotoCode,
    IInteractiveWindowMapping,
    INotebookIdentity,
    InteractiveWindowMessages,
    IReExecuteCells,
    IRemoteAddCode,
    IRemoteReexecuteCode,
    IShowDataViewer,
    ISubmitNewCell,
    SysInfoReason
} from '../interactive-common/interactiveWindowTypes';
import { JupyterInvalidKernelError } from '../jupyter/jupyterInvalidKernelError';
import { JupyterKernelPromiseFailedError } from '../jupyter/kernels/jupyterKernelPromiseFailedError';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { CssMessages, SharedMessages } from '../messages';
import {
    CellState,
    ICell,
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IInteractiveBase,
    IInteractiveWindowInfo,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterKernelSpec,
    IJupyterVariableDataProviderFactory,
    IJupyterVariables,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    IMessageCell,
    INotebook,
    INotebookExporter,
    INotebookProvider,
    INotebookProviderConnection,
    InterruptResult,
    IStatusProvider,
    IThemeFinder,
    WebViewViewChangeEventArgs
} from '../types';
import { WebViewHost } from '../webViewHost';
import { InteractiveWindowMessageListener } from './interactiveWindowMessageListener';

@injectable()
export abstract class InteractiveBase extends WebViewHost<IInteractiveWindowMapping> implements IInteractiveBase {
    public get notebook(): INotebook | undefined {
        return this._notebook;
    }

    public get id(): string {
        return this._id;
    }

    public get onExecutedCode(): Event<string> {
        return this.executeEvent.event;
    }
    private unfinishedCells: ICell[] = [];
    private restartingKernel: boolean = false;
    private perceivedJupyterStartupTelemetryCaptured: boolean = false;
    private potentiallyUnfinishedStatus: Disposable[] = [];
    private addSysInfoPromise: Deferred<boolean> | undefined;
    private _notebook: INotebook | undefined;
    private _id: string;
    private executeEvent: EventEmitter<string> = new EventEmitter<string>();
    private connectionAndNotebookPromise: Promise<void> | undefined;
    private notebookPromise: Promise<void> | undefined;
    private setDarkPromise: Deferred<boolean> | undefined;

    constructor(
        @unmanaged() private readonly listeners: IInteractiveWindowListener[],
        @unmanaged() liveShare: ILiveShareApi,
        @unmanaged() protected applicationShell: IApplicationShell,
        @unmanaged() protected documentManager: IDocumentManager,
        @unmanaged() provider: IWebPanelProvider,
        @unmanaged() private disposables: IDisposableRegistry,
        @unmanaged() cssGenerator: ICodeCssGenerator,
        @unmanaged() themeFinder: IThemeFinder,
        @unmanaged() private statusProvider: IStatusProvider,
        @unmanaged() protected jupyterExecution: IJupyterExecution,
        @unmanaged() protected fileSystem: IFileSystem,
        @unmanaged() protected configuration: IConfigurationService,
        @unmanaged() protected jupyterExporter: INotebookExporter,
        @unmanaged() workspaceService: IWorkspaceService,
        @unmanaged() private dataExplorerFactory: IDataViewerFactory,
        @unmanaged() private jupyterVariableDataProviderFactory: IJupyterVariableDataProviderFactory,
        @unmanaged() private jupyterVariables: IJupyterVariables,
        @unmanaged() private jupyterDebugger: IJupyterDebugger,
        @unmanaged() protected errorHandler: IDataScienceErrorHandler,
        @unmanaged() protected readonly commandManager: ICommandManager,
        @unmanaged() protected globalStorage: Memento,
        @unmanaged() rootPath: string,
        @unmanaged() scripts: string[],
        @unmanaged() title: string,
        @unmanaged() viewColumn: ViewColumn,
        @unmanaged() experimentsManager: IExperimentsManager,
        @unmanaged() private switcher: KernelSwitcher,
        @unmanaged() private readonly notebookProvider: INotebookProvider,
        @unmanaged() useCustomEditorApi: boolean
    ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new InteractiveWindowMessageListener(liveShare, c, v, d),
            rootPath,
            scripts,
            title,
            viewColumn,
            experimentsManager.inExperiment(WebHostNotebook.experiment),
            useCustomEditorApi,
            experimentsManager.inExperiment(RunByLine.experiment)
        );

        // Create our unique id. We use this to skip messages we send to other interactive windows
        this._id = uuid();

        // Listen for active text editor changes. This is the only way we can tell that we might be needing to gain focus
        const handler = this.documentManager.onDidChangeActiveTextEditor(() => this.activating());
        this.disposables.push(handler);

        // If our execution changes its liveshare session, we need to close our server
        this.jupyterExecution.sessionChanged(() => this.reloadAfterShutdown());

        // For each listener sign up for their post events
        this.listeners.forEach((l) => l.postMessage((e) => this.postMessageInternal(e.message, e.payload)));
        // Channel for listeners to send messages to the interactive base.
        this.listeners.forEach((l) => {
            if (l.postInternalMessage) {
                l.postInternalMessage((e) => this.onMessage(e.message, e.payload));
            }
        });

        // Tell each listener our identity. Can't do it here though as were in the constructor for the base class
        setTimeout(() => {
            this.getNotebookIdentity()
                .then((identity) =>
                    this.listeners.forEach((l) => l.onMessage(InteractiveWindowMessages.NotebookIdentity, identity))
                )
                .ignoreErrors();
        }, 0);

        // When a server starts, make sure we create a notebook if the server matches
        jupyterExecution.serverStarted(this.checkForNotebookProviderConnection.bind(this));

        // When the variable service requests a refresh, refresh our variable list
        this.disposables.push(this.jupyterVariables.refreshRequired(this.refreshVariables.bind(this)));
    }

    public async show(): Promise<void> {
        // Verify a server that matches us hasn't started already
        this.checkForNotebookProviderConnection().ignoreErrors();

        // Show our web panel.
        return super.show(true);
    }

    // tslint:disable-next-line: no-any no-empty cyclomatic-complexity max-func-body-length
    public onMessage(message: string, payload: any) {
        switch (message) {
            case InteractiveWindowMessages.ConvertUriForUseInWebViewRequest:
                const request = payload as Uri;
                const response = { request, response: this.asWebviewUri(request) };
                this.postMessageToListeners(InteractiveWindowMessages.ConvertUriForUseInWebViewResponse, response);
                break;

            case InteractiveWindowMessages.Started:
                // Send the first settings message
                this.onDataScienceSettingsChanged().ignoreErrors();

                // Send the loc strings (skip during testing as it takes up a lot of memory)
                const locStrings = isTestExecution() ? '{}' : localize.getCollectionJSON();
                this.postMessageInternal(SharedMessages.LocInit, locStrings).ignoreErrors();
                break;

            case InteractiveWindowMessages.GotoCodeCell:
                this.handleMessage(message, payload, this.gotoCode);
                break;

            case InteractiveWindowMessages.CopyCodeCell:
                this.handleMessage(message, payload, this.copyCode);
                break;

            case InteractiveWindowMessages.RestartKernel:
                this.restartKernel().ignoreErrors();
                break;

            case InteractiveWindowMessages.Interrupt:
                this.interruptKernel().ignoreErrors();
                break;

            case InteractiveWindowMessages.SendInfo:
                this.handleMessage(message, payload, this.updateContexts);
                break;

            case InteractiveWindowMessages.SubmitNewCell:
                this.handleMessage(message, payload, this.submitNewCell);
                break;

            case InteractiveWindowMessages.ReExecuteCells:
                this.handleMessage(message, payload, this.reexecuteCells);
                break;

            case InteractiveWindowMessages.Undo:
                this.logTelemetry(Telemetry.Undo);
                break;

            case InteractiveWindowMessages.Redo:
                this.logTelemetry(Telemetry.Redo);
                break;

            case InteractiveWindowMessages.ExpandAll:
                this.logTelemetry(Telemetry.ExpandAll);
                break;

            case InteractiveWindowMessages.CollapseAll:
                this.logTelemetry(Telemetry.CollapseAll);
                break;

            case InteractiveWindowMessages.VariableExplorerToggle:
                this.variableExplorerToggle(payload);
                break;

            case InteractiveWindowMessages.AddedSysInfo:
                this.handleMessage(message, payload, this.onAddedSysInfo);
                break;

            case InteractiveWindowMessages.RemoteAddCode:
                this.handleMessage(message, payload, this.onRemoteAddedCode);
                break;

            case InteractiveWindowMessages.RemoteReexecuteCode:
                this.handleMessage(message, payload, this.onRemoteReexecuteCode);
                break;

            case InteractiveWindowMessages.ShowDataViewer:
                this.handleMessage(message, payload, this.showDataViewer);
                break;

            case InteractiveWindowMessages.GetVariablesRequest:
                this.handleMessage(message, payload, this.requestVariables);
                break;

            case InteractiveWindowMessages.LoadTmLanguageRequest:
                this.handleMessage(message, payload, this.requestTmLanguage);
                break;

            case InteractiveWindowMessages.LoadOnigasmAssemblyRequest:
                this.handleMessage(message, payload, this.requestOnigasm);
                break;

            case InteractiveWindowMessages.SelectKernel:
                this.handleMessage(message, payload, this.selectKernel);
                break;

            case InteractiveWindowMessages.SelectJupyterServer:
                this.handleMessage(message, payload, this.selectServer);
                break;

            case InteractiveWindowMessages.OpenSettings:
                this.handleMessage(message, payload, this.openSettings);
                break;
            default:
                break;
        }

        // Let our listeners handle the message too
        this.postMessageToListeners(message, payload);

        // Pass onto our base class.
        super.onMessage(message, payload);

        // After our base class handles some stuff, handle it ourselves too.
        switch (message) {
            case CssMessages.GetCssRequest:
                // Update the notebook if we have one:
                if (this._notebook) {
                    this.isDark()
                        .then((d) => (this._notebook ? this._notebook.setMatplotLibStyle(d) : Promise.resolve()))
                        .ignoreErrors();
                }
                break;

            default:
                break;
        }
    }

    public dispose() {
        super.dispose();
        this.getNotebookIdentity()
            .then((r) => {
                // Tell listeners we're closing. They can decide if they should dispose themselves or not.
                this.listeners.forEach((l) => l.onMessage(InteractiveWindowMessages.NotebookClose, r));
            })
            .ignoreErrors();
        this.updateContexts(undefined);
    }

    public startProgress() {
        this.postMessage(InteractiveWindowMessages.StartProgress).ignoreErrors();
    }

    public stopProgress() {
        this.postMessage(InteractiveWindowMessages.StopProgress).ignoreErrors();
    }

    @captureTelemetry(Telemetry.Undo)
    public undoCells() {
        this.postMessage(InteractiveWindowMessages.Undo).ignoreErrors();
    }

    @captureTelemetry(Telemetry.Redo)
    public redoCells() {
        this.postMessage(InteractiveWindowMessages.Redo).ignoreErrors();
    }

    @captureTelemetry(Telemetry.DeleteAllCells)
    public removeAllCells() {
        this.postMessage(InteractiveWindowMessages.DeleteAllCells).ignoreErrors();
    }

    @captureTelemetry(Telemetry.RestartKernel)
    public async restartKernel(internal: boolean = false): Promise<void> {
        // Only log this if it's user requested restart
        if (!internal) {
            this.logTelemetry(Telemetry.RestartKernelCommand);
        }

        if (this._notebook && !this.restartingKernel) {
            this.restartingKernel = true;
            this.startProgress();

            try {
                if (await this.shouldAskForRestart()) {
                    // Ask the user if they want us to restart or not.
                    const message = localize.DataScience.restartKernelMessage();
                    const yes = localize.DataScience.restartKernelMessageYes();
                    const dontAskAgain = localize.DataScience.restartKernelMessageDontAskAgain();
                    const no = localize.DataScience.restartKernelMessageNo();

                    const v = await this.applicationShell.showInformationMessage(message, yes, dontAskAgain, no);
                    if (v === dontAskAgain) {
                        await this.disableAskForRestart();
                        await this.restartKernelInternal();
                    } else if (v === yes) {
                        await this.restartKernelInternal();
                    }
                } else {
                    await this.restartKernelInternal();
                }
            } finally {
                this.restartingKernel = false;
                this.stopProgress();
            }
        }
    }

    @captureTelemetry(Telemetry.Interrupt)
    public async interruptKernel(): Promise<void> {
        if (this._notebook && !this.restartingKernel) {
            this.restartingKernel = true;

            const status = this.statusProvider.set(
                localize.DataScience.interruptKernelStatus(),
                true,
                undefined,
                undefined,
                this
            );

            try {
                const settings = this.configuration.getSettings(await this.getOwningResource());
                const interruptTimeout = settings.datascience.jupyterInterruptTimeout;

                const result = await this._notebook.interruptKernel(interruptTimeout);
                status.dispose();

                // We timed out, ask the user if they want to restart instead.
                if (result === InterruptResult.TimedOut) {
                    const message = localize.DataScience.restartKernelAfterInterruptMessage();
                    const yes = localize.DataScience.restartKernelMessageYes();
                    const no = localize.DataScience.restartKernelMessageNo();
                    const v = await this.applicationShell.showInformationMessage(message, yes, no);
                    if (v === yes) {
                        await this.restartKernelInternal();
                    }
                } else if (result === InterruptResult.Restarted) {
                    // Uh-oh, keyboard interrupt crashed the kernel.
                    this.addSysInfo(SysInfoReason.Interrupt).ignoreErrors();
                }
            } catch (err) {
                status.dispose();
                traceError(err);
                this.applicationShell.showErrorMessage(err);
            } finally {
                this.restartingKernel = false;
            }
        }
    }

    @captureTelemetry(Telemetry.CopySourceCode, undefined, false)
    public copyCode(args: ICopyCode) {
        return this.copyCodeInternal(args.source).catch((err) => {
            this.applicationShell.showErrorMessage(err);
        });
    }

    protected onViewStateChanged(args: WebViewViewChangeEventArgs) {
        // Only activate if the active editor is empty. This means that
        // vscode thinks we are actually supposed to have focus. It would be
        // nice if they would more accurrately tell us this, but this works for now.
        // Essentially the problem is the webPanel.active state doesn't track
        // if the focus is supposed to be in the webPanel or not. It only tracks if
        // it's been activated. However if there's no active text editor and we're active, we
        // can safely attempt to give ourselves focus. This won't actually give us focus if we aren't
        // allowed to have it.
        if (args.current.active && !args.previous.active) {
            this.activating().ignoreErrors();
        }

        // Tell our listeners, they may need to know too
        this.listeners.forEach((l) => (l.onViewStateChanged ? l.onViewStateChanged(args) : noop()));
    }

    protected async activating() {
        // Only activate if the active editor is empty. This means that
        // vscode thinks we are actually supposed to have focus. It would be
        // nice if they would more accurrately tell us this, but this works for now.
        // Essentially the problem is the webPanel.active state doesn't track
        // if the focus is supposed to be in the webPanel or not. It only tracks if
        // it's been activated. However if there's no active text editor and we're active, we
        // can safely attempt to give ourselves focus. This won't actually give us focus if we aren't
        // allowed to have it.
        if (this.viewState.active && !this.documentManager.activeTextEditor) {
            // Force the webpanel to reveal and take focus.
            await super.show(false);

            // Send this to the react control
            await this.postMessage(InteractiveWindowMessages.Activate);
        }
    }

    // Submits a new cell to the window
    protected abstract submitNewCell(info: ISubmitNewCell): void;

    // Re-executes cells already in the window
    protected reexecuteCells(_info: IReExecuteCells): void {
        // Default is not to do anything. This only works in the native editor
    }

    protected abstract getNotebookMetadata(): Promise<nbformat.INotebookMetadata | undefined>;

    protected abstract updateContexts(info: IInteractiveWindowInfo | undefined): void;

    protected abstract getNotebookIdentity(): Promise<INotebookIdentity>;

    protected abstract closeBecauseOfFailure(exc: Error): Promise<void>;

    protected abstract updateNotebookOptions(
        kernelSpec: IJupyterKernelSpec,
        interpreter: PythonInterpreter | undefined
    ): Promise<void>;

    protected async clearResult(id: string): Promise<void> {
        await this.ensureConnectionAndNotebook();
        if (this._notebook) {
            this._notebook.clear(id);
        }
    }

    protected async setLaunchingFile(file: string): Promise<void> {
        if (file !== Identifiers.EmptyFileName && this._notebook) {
            await this._notebook.setLaunchingFile(file);
        }
    }

    protected getNotebook(): INotebook | undefined {
        return this._notebook;
    }

    // tslint:disable-next-line: max-func-body-length
    protected async submitCode(
        code: string,
        file: string,
        line: number,
        id?: string,
        data?: nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell,
        debugInfo?: { runByLine: boolean; hashFileName?: string },
        cancelToken?: CancellationToken
    ): Promise<boolean> {
        traceInfo(`Submitting code for ${this.id}`);
        const stopWatch =
            this._notebook && !this.perceivedJupyterStartupTelemetryCaptured ? new StopWatch() : undefined;
        let result = true;
        // Do not execute or render empty code cells
        const cellMatcher = new CellMatcher(this.configService.getSettings(await this.getOwningResource()).datascience);
        if (cellMatcher.stripFirstMarker(code).length === 0) {
            return result;
        }

        // Start a status item
        const status = this.setStatus(localize.DataScience.executingCode(), false);

        // Transmit this submission to all other listeners (in a live share session)
        if (!id) {
            id = uuid();
            this.shareMessage(InteractiveWindowMessages.RemoteAddCode, {
                code,
                file,
                line,
                id,
                originator: this.id,
                debug: debugInfo !== undefined ? true : false
            });
        }

        // Create a deferred object that will wait until the status is disposed
        const finishedAddingCode = createDeferred<void>();
        const actualDispose = status.dispose.bind(status);
        status.dispose = () => {
            finishedAddingCode.resolve();
            actualDispose();
        };

        try {
            // Make sure we're loaded first.
            await this.ensureConnectionAndNotebook();

            // Make sure we set the dark setting
            await this.ensureDarkSet();

            // Then show our webpanel
            await this.show();

            // Add our sys info if necessary
            if (file !== Identifiers.EmptyFileName) {
                await this.addSysInfo(SysInfoReason.Start);
            }

            if (this._notebook) {
                // Before we try to execute code make sure that we have an initial directory set
                // Normally set via the workspace, but we might not have one here if loading a single loose file
                await this.setLaunchingFile(file);

                if (debugInfo) {
                    // Attach our debugger based on run by line setting
                    if (debugInfo.runByLine && debugInfo.hashFileName) {
                        await this.jupyterDebugger.startRunByLine(this._notebook, debugInfo.hashFileName);
                    } else if (!debugInfo.runByLine) {
                        await this.jupyterDebugger.startDebugging(this._notebook);
                    } else {
                        throw Error('Missing hash file name when running by line');
                    }
                }

                // If the file isn't unknown, set the active kernel's __file__ variable to point to that same file.
                if (file !== Identifiers.EmptyFileName) {
                    await this._notebook.execute(
                        `__file__ = '${file.replace(/\\/g, '\\\\')}'`,
                        file,
                        line,
                        uuid(),
                        cancelToken,
                        true
                    );
                }
                if (stopWatch && !this.perceivedJupyterStartupTelemetryCaptured) {
                    this.perceivedJupyterStartupTelemetryCaptured = true;
                    sendTelemetryEvent(Telemetry.PerceivedJupyterStartupNotebook, stopWatch?.elapsedTime);
                    const disposable = this._notebook.onSessionStatusChanged((e) => {
                        if (e === ServerStatus.Busy) {
                            sendTelemetryEvent(Telemetry.StartExecuteNotebookCellPerceivedCold, stopWatch?.elapsedTime);
                            disposable.dispose();
                        }
                    });
                }
                const owningResource = await this.getOwningResource();
                const observable = this._notebook.executeObservable(code, file, line, id, false);

                // Indicate we executed some code
                this.executeEvent.fire(code);

                // Sign up for cell changes
                observable.subscribe(
                    (cells: ICell[]) => {
                        // Combine the cell data with the possible input data (so we don't lose anything that might have already been in the cells)
                        const combined = cells.map(this.combineData.bind(undefined, data));

                        // Then send the combined output to the UI
                        this.sendCellsToWebView(combined);

                        // Any errors will move our result to false (if allowed)
                        if (this.configuration.getSettings(owningResource).datascience.stopOnError) {
                            result = result && cells.find((c) => c.state === CellState.error) === undefined;
                        }
                    },
                    (error) => {
                        status.dispose();
                        if (!(error instanceof CancellationError)) {
                            this.applicationShell.showErrorMessage(error.toString());
                        }
                    },
                    () => {
                        // Indicate executing until this cell is done.
                        status.dispose();
                    }
                );

                // Wait for the cell to finish
                await finishedAddingCode.promise;
                traceInfo(`Finished execution for ${id}`);
            }
        } finally {
            status.dispose();

            if (debugInfo) {
                if (this._notebook) {
                    await this.jupyterDebugger.stopDebugging(this._notebook);
                }
            }
        }

        return result;
    }

    protected addMessageImpl(message: string): void {
        const cell: ICell = {
            id: uuid(),
            file: Identifiers.EmptyFileName,
            line: 0,
            state: CellState.finished,
            data: {
                cell_type: 'messages',
                messages: [message],
                source: [],
                metadata: {}
            }
        };

        // Do the same thing that happens when new code is added.
        this.sendCellsToWebView([cell]);
    }

    protected sendCellsToWebView(cells: ICell[]) {
        // Send each cell to the other side
        cells.forEach((cell: ICell) => {
            switch (cell.state) {
                case CellState.init:
                    // Tell the react controls we have a new cell
                    this.postMessage(InteractiveWindowMessages.StartCell, cell).ignoreErrors();

                    // Keep track of this unfinished cell so if we restart we can finish right away.
                    this.unfinishedCells.push(cell);
                    break;

                case CellState.executing:
                    // Tell the react controls we have an update
                    this.postMessage(InteractiveWindowMessages.UpdateCellWithExecutionResults, cell).ignoreErrors();
                    break;

                case CellState.error:
                case CellState.finished:
                    // Tell the react controls we're done
                    this.postMessage(InteractiveWindowMessages.FinishCell, cell).ignoreErrors();

                    // Remove from the list of unfinished cells
                    this.unfinishedCells = this.unfinishedCells.filter((c) => c.id !== cell.id);
                    break;

                default:
                    break; // might want to do a progress bar or something
            }
        });
    }

    protected postMessage<M extends IInteractiveWindowMapping, T extends keyof M>(
        type: T,
        payload?: M[T]
    ): Promise<void> {
        // First send to our listeners
        this.postMessageToListeners(type.toString(), payload);

        // Then send it to the webview
        return super.postMessage(type, payload);
    }

    protected handleMessage<M extends IInteractiveWindowMapping, T extends keyof M>(
        _message: T,
        // tslint:disable-next-line:no-any
        payload: any,
        handler: (args: M[T]) => void
    ) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }

    protected setStatus = (message: string, showInWebView: boolean): Disposable => {
        const result = this.statusProvider.set(message, showInWebView, undefined, undefined, this);
        this.potentiallyUnfinishedStatus.push(result);
        return result;
    };

    protected async addSysInfo(reason: SysInfoReason): Promise<void> {
        if (!this.addSysInfoPromise || reason !== SysInfoReason.Start) {
            traceInfo(`Adding sys info for ${this.id} ${reason}`);
            const deferred = createDeferred<boolean>();
            this.addSysInfoPromise = deferred;

            // Generate a new sys info cell and send it to the web panel.
            const sysInfo = await this.generateSysInfoCell(reason);
            if (sysInfo) {
                this.sendCellsToWebView([sysInfo]);
            }

            // For anything but start, tell the other sides of a live share session
            if (reason !== SysInfoReason.Start && sysInfo) {
                this.shareMessage(InteractiveWindowMessages.AddedSysInfo, {
                    type: reason,
                    sysInfoCell: sysInfo,
                    id: this.id
                });
            }

            // For a restart, tell our window to reset
            if (reason === SysInfoReason.Restart || reason === SysInfoReason.New) {
                this.postMessage(InteractiveWindowMessages.RestartKernel).ignoreErrors();
            }

            traceInfo(`Sys info for ${this.id} ${reason} complete`);
            deferred.resolve(true);
        } else if (this.addSysInfoPromise) {
            traceInfo(`Wait for sys info for ${this.id} ${reason}`);
            await this.addSysInfoPromise.promise;
        }
    }

    protected async ensureConnectionAndNotebook(): Promise<void> {
        if (!this.connectionAndNotebookPromise) {
            this.connectionAndNotebookPromise = this.ensureConnectionAndNotebookImpl();
        }
        try {
            await this.connectionAndNotebookPromise;
        } catch (e) {
            // Reset the load promise. Don't want to keep hitting the same error
            this.connectionAndNotebookPromise = undefined;
            throw e;
        }
    }

    private combineData(
        oldData: nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell | undefined,
        cell: ICell
    ): ICell {
        if (oldData) {
            const result = {
                ...cell,
                data: {
                    ...oldData,
                    ...cell.data,
                    metadata: {
                        ...oldData.metadata,
                        ...cell.data.metadata
                    }
                }
            };
            // Workaround the nyc compiler problem.
            // tslint:disable-next-line: no-any
            return (result as any) as ICell;
        }
        // tslint:disable-next-line: no-any
        return (cell as any) as ICell;
    }

    private async ensureConnectionAndNotebookImpl(): Promise<void> {
        // Make sure we're loaded first.
        try {
            traceInfo('Waiting for jupyter server and web panel ...');
            const serverConnection = await this.notebookProvider.connect({ getOnly: false, disableUI: false });
            if (serverConnection) {
                await this.ensureNotebook(serverConnection);
            }
        } catch (exc) {
            // We should dispose ourselves if the load fails. Othewise the user
            // updates their install and we just fail again because the load promise is the same.
            await this.closeBecauseOfFailure(exc);

            // Finally throw the exception so the user can do something about it.
            throw exc;
        }
    }

    // tslint:disable-next-line: no-any
    private postMessageToListeners(message: string, payload: any) {
        if (this.listeners) {
            this.listeners.forEach((l) => l.onMessage(message, payload));
        }
    }

    private async shouldAskForRestart(): Promise<boolean> {
        const settings = this.configuration.getSettings(await this.getOwningResource());
        return settings && settings.datascience && settings.datascience.askForKernelRestart === true;
    }

    private async disableAskForRestart(): Promise<void> {
        const settings = this.configuration.getSettings(await this.getOwningResource());
        if (settings && settings.datascience) {
            settings.datascience.askForKernelRestart = false;
            this.configuration
                .updateSetting('dataScience.askForKernelRestart', false, undefined, ConfigurationTarget.Global)
                .ignoreErrors();
        }
    }

    private async shouldAskForLargeData(): Promise<boolean> {
        const settings = this.configuration.getSettings(await this.getOwningResource());
        return settings && settings.datascience && settings.datascience.askForLargeDataFrames === true;
    }

    private async disableAskForLargeData(): Promise<void> {
        const settings = this.configuration.getSettings(await this.getOwningResource());
        if (settings && settings.datascience) {
            settings.datascience.askForLargeDataFrames = false;
            this.configuration
                .updateSetting('dataScience.askForLargeDataFrames', false, undefined, ConfigurationTarget.Global)
                .ignoreErrors();
        }
    }

    private async checkColumnSize(columnSize: number): Promise<boolean> {
        if (columnSize > ColumnWarningSize && (await this.shouldAskForLargeData())) {
            const message = localize.DataScience.tooManyColumnsMessage();
            const yes = localize.DataScience.tooManyColumnsYes();
            const no = localize.DataScience.tooManyColumnsNo();
            const dontAskAgain = localize.DataScience.tooManyColumnsDontAskAgain();

            const result = await this.applicationShell.showWarningMessage(message, yes, no, dontAskAgain);
            if (result === dontAskAgain) {
                await this.disableAskForLargeData();
            }
            return result === yes;
        }
        return true;
    }

    private async showDataViewer(request: IShowDataViewer): Promise<void> {
        try {
            if (await this.checkColumnSize(request.columnSize)) {
                const jupyterVariableDataProvider = await this.jupyterVariableDataProviderFactory.create(
                    request.variable,
                    this._notebook!
                );
                const title: string = `${localize.DataScience.dataExplorerTitle()} - ${request.variable.name}`;
                await this.dataExplorerFactory.create(jupyterVariableDataProvider, title);
            }
        } catch (e) {
            this.applicationShell.showErrorMessage(e.toString());
        }
    }

    private onAddedSysInfo(sysInfo: IAddedSysInfo) {
        // See if this is from us or not.
        if (sysInfo.id !== this.id) {
            // Not from us, must come from a different interactive window. Add to our
            // own to keep in sync
            if (sysInfo.sysInfoCell) {
                this.sendCellsToWebView([sysInfo.sysInfoCell]);
            }
        }
    }

    private async onRemoteReexecuteCode(args: IRemoteReexecuteCode) {
        // Make sure this is valid
        if (args && args.id && args.file && args.originator !== this.id) {
            try {
                // On a reexecute clear the previous execution
                if (this._notebook) {
                    this._notebook.clear(args.id);
                }

                // Indicate this in our telemetry.
                // Add new telemetry type
                sendTelemetryEvent(Telemetry.RemoteReexecuteCode);

                // Submit this item as new code.
                this.submitCode(
                    args.code,
                    args.file,
                    args.line,
                    args.id,
                    undefined,
                    args.debug ? { runByLine: false } : undefined
                ).ignoreErrors();
            } catch (exc) {
                this.errorHandler.handleError(exc).ignoreErrors();
            }
        }
    }

    private async onRemoteAddedCode(args: IRemoteAddCode) {
        // Make sure this is valid
        if (args && args.id && args.file && args.originator !== this.id) {
            try {
                // Indicate this in our telemetry.
                sendTelemetryEvent(Telemetry.RemoteAddCode);

                // Submit this item as new code.
                await this.submitCode(
                    args.code,
                    args.file,
                    args.line,
                    args.id,
                    undefined,
                    args.debug ? { runByLine: false } : undefined
                );
            } catch (exc) {
                this.errorHandler.handleError(exc).ignoreErrors();
            }
        }
    }

    private finishOutstandingCells() {
        this.unfinishedCells.forEach((c) => {
            c.state = CellState.error;
            this.postMessage(InteractiveWindowMessages.FinishCell, c).ignoreErrors();
        });
        this.unfinishedCells = [];
        this.potentiallyUnfinishedStatus.forEach((s) => s.dispose());
        this.potentiallyUnfinishedStatus = [];
    }

    private async restartKernelInternal(): Promise<void> {
        this.restartingKernel = true;

        // First we need to finish all outstanding cells.
        this.finishOutstandingCells();

        // Set our status
        const status = this.statusProvider.set(
            localize.DataScience.restartingKernelStatus(),
            true,
            undefined,
            undefined,
            this
        );

        try {
            if (this._notebook) {
                await this._notebook.restartKernel(
                    (await this.generateDataScienceExtraSettings()).jupyterInterruptTimeout
                );
                await this.addSysInfo(SysInfoReason.Restart);

                // Compute if dark or not.
                const knownDark = await this.isDark();

                // Before we run any cells, update the dark setting
                await this._notebook.setMatplotLibStyle(knownDark);
            }
        } catch (exc) {
            // If we get a kernel promise failure, then restarting timed out. Just shutdown and restart the entire server
            if (exc instanceof JupyterKernelPromiseFailedError && this._notebook) {
                await this._notebook.dispose();
                await this.ensureConnectionAndNotebook();
                await this.addSysInfo(SysInfoReason.Restart);
            } else {
                // Show the error message
                this.applicationShell.showErrorMessage(exc);
                traceError(exc);
            }
        } finally {
            status.dispose();
            this.restartingKernel = false;
        }
    }

    private logTelemetry = (event: Telemetry) => {
        sendTelemetryEvent(event);
    };

    private async stopServer(): Promise<void> {
        // Finish either of our notebook promises
        if (this.connectionAndNotebookPromise) {
            await this.connectionAndNotebookPromise;
            this.connectionAndNotebookPromise = undefined;
        }
        if (this.notebookPromise) {
            await this.notebookPromise;
            this.notebookPromise = undefined;
        }
        // If we have a notebook dispose of it
        if (this._notebook) {
            const notebook = this._notebook;
            this._notebook = undefined;
            await notebook.dispose();
        }

        // Disconnect from our notebook provider
        await this.notebookProvider.disconnect({ getOnly: true });
    }

    // ensureNotebook can be called apart from ensureNotebookAndServer and it needs
    // the same protection to not be called twice
    // tslint:disable-next-line: member-ordering
    protected async ensureNotebook(serverConnection: INotebookProviderConnection): Promise<void> {
        if (!this.notebookPromise) {
            this.notebookPromise = this.ensureNotebookImpl(serverConnection);
        }
        try {
            await this.notebookPromise;
        } catch (e) {
            // Reset the load promise. Don't want to keep hitting the same error
            this.notebookPromise = undefined;

            throw e;
        }
    }

    private async createNotebook(serverConnection: INotebookProviderConnection): Promise<INotebook> {
        let notebook: INotebook | undefined;
        while (!notebook) {
            const [resource, identity, metadata] = await Promise.all([
                this.getOwningResource(),
                this.getNotebookIdentity(),
                this.getNotebookMetadata()
            ]);
            try {
                notebook = identity
                    ? await this.notebookProvider.getOrCreateNotebook({
                          identity: identity.resource,
                          resource,
                          metadata
                      })
                    : undefined;
                if (notebook) {
                    const executionActivation = { ...identity, owningResource: resource };
                    this.postMessageToListeners(
                        InteractiveWindowMessages.NotebookExecutionActivated,
                        executionActivation
                    );
                }
            } catch (e) {
                // If we get an invalid kernel error, make sure to ask the user to switch
                if (e instanceof JupyterInvalidKernelError && serverConnection && serverConnection.localLaunch) {
                    // Ask the user for a new local kernel
                    const newKernel = await this.switcher.askForLocalKernel(
                        resource,
                        serverConnection.type,
                        e.kernelSpec
                    );
                    if (newKernel?.kernelSpec) {
                        // Update the notebook metadata
                        await this.updateNotebookOptions(newKernel.kernelSpec, newKernel.interpreter);
                    }
                } else {
                    throw e;
                }
            }
        }
        return notebook;
    }

    private getServerUri(serverConnection: INotebookProviderConnection | undefined): string {
        let localizedUri = '';

        if (serverConnection) {
            // Determine the connection URI of the connected server to display
            if (serverConnection.localLaunch) {
                localizedUri = localize.DataScience.localJupyterServer();
            } else {
                localizedUri = serverConnection.displayName;

                // Log this remote URI into our MRU list
                addToUriList(this.globalStorage, localizedUri, Date.now());
            }
        }

        return localizedUri;
    }

    private async listenToNotebookEvents(notebook: INotebook): Promise<void> {
        const statusChangeHandler = async (status: ServerStatus) => {
            const kernelSpec = notebook.getKernelSpec();
            const name = kernelSpec?.display_name || kernelSpec?.name || '';

            await this.postMessage(InteractiveWindowMessages.UpdateKernel, {
                jupyterServerStatus: status,
                localizedUri: this.getServerUri(notebook.connection),
                displayName: name,
                language: translateKernelLanguageToMonaco(kernelSpec?.language ?? PYTHON_LANGUAGE)
            });
        };
        notebook.onSessionStatusChanged(statusChangeHandler);
        this.disposables.push(notebook.onKernelChanged(this.kernelChangeHandler.bind(this)));

        // Fire the status changed handler at least once (might have already been running and so won't show a status update)
        statusChangeHandler(notebook.status).ignoreErrors();

        // Also listen to iopub messages so we can update other cells on update_display_data
        notebook.registerIOPubListener(this.handleKernelMessage.bind(this));
    }

    private async ensureNotebookImpl(serverConnection: INotebookProviderConnection): Promise<void> {
        // Create a new notebook if we need to.
        if (!this._notebook) {
            // While waiting make the notebook look busy
            this.postMessage(InteractiveWindowMessages.UpdateKernel, {
                jupyterServerStatus: ServerStatus.Busy,
                localizedUri: this.getServerUri(serverConnection),
                displayName: '',
                language: PYTHON_LANGUAGE
            }).ignoreErrors();

            this._notebook = await this.createNotebook(serverConnection);

            // If that works notify the UI and listen to status changes.
            if (this._notebook && this._notebook.identity) {
                return this.listenToNotebookEvents(this._notebook);
            }
        }
    }

    private refreshVariables() {
        this.postMessage(InteractiveWindowMessages.ForceVariableRefresh).ignoreErrors();
    }

    private async checkForNotebookProviderConnection(): Promise<void> {
        // Check to see if we are already connected to our provider
        const providerConnection = await this.notebookProvider.connect({ getOnly: true });

        if (providerConnection) {
            try {
                await this.ensureNotebook(providerConnection);
            } catch (e) {
                this.errorHandler.handleError(e).ignoreErrors();
            }
        }
    }

    private async reloadAfterShutdown(): Promise<void> {
        try {
            await this.stopServer();
        } catch {
            // We just switched from host to guest mode. Don't really care
            // if closing the host server kills it.
            this._notebook = undefined;
        } finally {
            this.connectionAndNotebookPromise = undefined;
            this.notebookPromise = undefined;
        }
        await this.ensureConnectionAndNotebook();
    }

    @captureTelemetry(Telemetry.GotoSourceCode, undefined, false)
    private gotoCode(args: IGotoCode) {
        this.gotoCodeInternal(args.file, args.line).catch((err) => {
            this.applicationShell.showErrorMessage(err);
        });
    }

    private async gotoCodeInternal(file: string, line: number) {
        let editor: TextEditor | undefined;

        if (await this.fileSystem.fileExists(file)) {
            editor = await this.documentManager.showTextDocument(Uri.file(file), { viewColumn: ViewColumn.One });
        } else {
            // File URI isn't going to work. Look through the active text documents
            editor = this.documentManager.visibleTextEditors.find((te) => te.document.fileName === file);
            if (editor) {
                editor.show();
            }
        }

        // If we found the editor change its selection
        if (editor) {
            editor.revealRange(new Range(line, 0, line, 0));
            editor.selection = new Selection(new Position(line, 0), new Position(line, 0));
        }
    }

    private async copyCodeInternal(source: string) {
        let editor = this.documentManager.activeTextEditor;
        if (!editor || editor.document.languageId !== PYTHON_LANGUAGE) {
            // Find the first visible python editor
            const pythonEditors = this.documentManager.visibleTextEditors.filter(
                (e) => e.document.languageId === PYTHON_LANGUAGE || e.document.isUntitled
            );

            if (pythonEditors.length > 0) {
                editor = pythonEditors[0];
            }
        }
        if (editor && (editor.document.languageId === PYTHON_LANGUAGE || editor.document.isUntitled)) {
            // Figure out if any cells in this document already.
            const ranges = generateCellRangesFromDocument(
                editor.document,
                await this.generateDataScienceExtraSettings()
            );
            const hasCellsAlready = ranges.length > 0;
            const line = editor.selection.start.line;
            const revealLine = line + 1;
            const defaultCellMarker =
                this.configService.getSettings(await this.getOwningResource()).datascience.defaultCellMarker ||
                Identifiers.DefaultCodeCellMarker;
            let newCode = `${source}${os.EOL}`;
            if (hasCellsAlready) {
                // See if inside of a range or not.
                const matchingRange = ranges.find((r) => r.range.start.line <= line && r.range.end.line >= line);

                // If in the middle, wrap the new code
                if (matchingRange && matchingRange.range.start.line < line && line < editor.document.lineCount - 1) {
                    newCode = `${defaultCellMarker}${os.EOL}${source}${os.EOL}${defaultCellMarker}${os.EOL}`;
                } else {
                    newCode = `${defaultCellMarker}${os.EOL}${source}${os.EOL}`;
                }
            } else if (editor.document.lineCount <= 0 || editor.document.isUntitled) {
                // No lines in the document at all, just insert new code
                newCode = `${defaultCellMarker}${os.EOL}${source}${os.EOL}`;
            }

            await editor.edit((editBuilder) => {
                editBuilder.insert(new Position(line, 0), newCode);
            });
            editor.revealRange(new Range(revealLine, 0, revealLine + source.split('\n').length + 3, 0));

            // Move selection to just beyond the text we input so that the next
            // paste will be right after
            const selectionLine = line + newCode.split('\n').length - 1;
            editor.selection = new Selection(new Position(selectionLine, 0), new Position(selectionLine, 0));
        }
    }

    private async ensureDarkSet(): Promise<void> {
        if (!this.setDarkPromise) {
            this.setDarkPromise = createDeferred<boolean>();

            // Wait for the web panel to get the isDark setting
            const knownDark = await this.isDark();

            // Before we run any cells, update the dark setting
            if (this._notebook) {
                await this._notebook.setMatplotLibStyle(knownDark);
            }

            this.setDarkPromise.resolve(true);
        } else {
            await this.setDarkPromise.promise;
        }
    }

    private generateSysInfoCell = async (reason: SysInfoReason): Promise<ICell | undefined> => {
        // Execute the code 'import sys\r\nsys.version' and 'import sys\r\nsys.executable' to get our
        // version and executable
        if (this._notebook) {
            const message = await this.generateSysInfoMessage(reason);

            // The server handles getting this data.
            const sysInfo = await this._notebook.getSysInfo();
            if (sysInfo) {
                // Connection string only for our initial start, not restart or interrupt
                let connectionString: string = '';
                if (reason === SysInfoReason.Start) {
                    connectionString = this.generateConnectionInfoString(this._notebook.connection);
                }

                // Update our sys info with our locally applied data.
                const cell = sysInfo.data as IMessageCell;
                if (cell) {
                    cell.messages.unshift(message);
                    if (connectionString && connectionString.length) {
                        cell.messages.unshift(connectionString);
                    }
                }

                return sysInfo;
            }
        }
    };

    private async generateSysInfoMessage(reason: SysInfoReason): Promise<string> {
        switch (reason) {
            case SysInfoReason.Start:
                return localize.DataScience.pythonVersionHeader();
                break;
            case SysInfoReason.Restart:
                return localize.DataScience.pythonRestartHeader();
                break;
            case SysInfoReason.Interrupt:
                return localize.DataScience.pythonInterruptFailedHeader();
                break;
            case SysInfoReason.New:
                return localize.DataScience.pythonNewHeader();
                break;
            case SysInfoReason.Connect:
                return localize.DataScience.pythonConnectHeader();
                break;
            default:
                traceError('Invalid SysInfoReason');
                return '';
                break;
        }
    }

    private generateConnectionInfoString(connInfo: INotebookProviderConnection | undefined): string {
        return connInfo?.displayName || '';
    }

    private async requestVariables(args: IJupyterVariablesRequest): Promise<void> {
        // Request our new list of variables
        const response: IJupyterVariablesResponse = this._notebook
            ? await this.jupyterVariables.getVariables(this._notebook, args)
            : {
                  totalCount: 0,
                  pageResponse: [],
                  pageStartIndex: args?.startIndex,
                  executionCount: args?.executionCount
              };

        this.postMessage(InteractiveWindowMessages.GetVariablesResponse, response).ignoreErrors();
        sendTelemetryEvent(Telemetry.VariableExplorerVariableCount, undefined, { variableCount: response.totalCount });
    }

    // tslint:disable-next-line: no-any
    private variableExplorerToggle = (payload?: any) => {
        // Direct undefined check as false boolean will skip code
        if (payload !== undefined) {
            const openValue = payload as boolean;

            // Log the state in our Telemetry
            sendTelemetryEvent(Telemetry.VariableExplorerToggled, undefined, { open: openValue });
        }
    };

    private async requestTmLanguage(languageId: string) {
        // Get the contents of the appropriate tmLanguage file.
        traceInfo('Request for tmlanguage file.');
        const languageJson = await this.themeFinder.findTmLanguage(languageId);
        const languageConfiguration = await this.themeFinder.findLanguageConfiguration(languageId);
        const extensions = languageId === PYTHON_LANGUAGE ? ['.py'] : [];
        const scopeName = `scope.${languageId}`; // This works for python, not sure about c# etc.
        this.postMessage(InteractiveWindowMessages.LoadTmLanguageResponse, {
            languageJSON: languageJson ?? '',
            languageConfiguration,
            extensions,
            scopeName,
            languageId
        }).ignoreErrors();
    }

    private async requestOnigasm(): Promise<void> {
        // Look for the file next or our current file (this is where it's installed in the vsix)
        let filePath = path.join(__dirname, 'node_modules', 'onigasm', 'lib', 'onigasm.wasm');
        traceInfo(`Request for onigasm file at ${filePath}`);
        if (this.fileSystem) {
            if (await this.fileSystem.fileExists(filePath)) {
                const contents = await this.fileSystem.readData(filePath);
                this.postMessage(InteractiveWindowMessages.LoadOnigasmAssemblyResponse, contents).ignoreErrors();
            } else {
                // During development it's actually in the node_modules folder
                filePath = path.join(EXTENSION_ROOT_DIR, 'node_modules', 'onigasm', 'lib', 'onigasm.wasm');
                traceInfo(`Backup request for onigasm file at ${filePath}`);
                if (await this.fileSystem.fileExists(filePath)) {
                    const contents = await this.fileSystem.readData(filePath);
                    this.postMessage(InteractiveWindowMessages.LoadOnigasmAssemblyResponse, contents).ignoreErrors();
                } else {
                    traceWarning('Onigasm file not found. Colorization will not be available.');
                    this.postMessage(InteractiveWindowMessages.LoadOnigasmAssemblyResponse).ignoreErrors();
                }
            }
        } else {
            // This happens during testing. Onigasm not needed as we're not testing colorization.
            traceWarning('File system not found. Colorization will not be available.');
            this.postMessage(InteractiveWindowMessages.LoadOnigasmAssemblyResponse).ignoreErrors();
        }
    }

    private async selectServer() {
        await this.commandManager.executeCommand(Commands.SelectJupyterURI);
    }

    private async selectKernel() {
        if (!this._notebook) {
            return;
        }
        try {
            this.startProgress();
            await this.commandManager.executeCommand(Commands.SwitchJupyterKernel, this._notebook);
        } finally {
            this.stopProgress();
        }
    }
    private async kernelChangeHandler(kernel: IJupyterKernelSpec | LiveKernelModel) {
        // Check if we are changing to LiveKernelModel
        if (kernel.hasOwnProperty('numberOfConnections')) {
            await this.addSysInfo(SysInfoReason.Connect);
        } else {
            await this.addSysInfo(SysInfoReason.New);
        }

        // Force an update of the kernel metadata
        const kernelSpec: IJupyterKernelSpec = {
            path: kernel.path ?? '',
            name: kernel.name,
            language: kernel.language ?? 'python',
            display_name: kernel.display_name ?? kernel.name,
            argv: kernel.argv ?? [],
            env: kernel.env
        };
        return this.updateNotebookOptions(kernelSpec, this._notebook?.getMatchingInterpreter());
    }

    private openSettings(setting: string | undefined) {
        if (setting) {
            commands.executeCommand('workbench.action.openSettings', setting);
        } else {
            commands.executeCommand('workbench.action.openSettings');
        }
    }

    private async handleKernelMessage(msg: KernelMessage.IIOPubMessage, _requestId: string) {
        // Only care about one sort of message, UpdateDisplayData
        // tslint:disable-next-line: no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services'); // NOSONAR
        if (jupyterLab.KernelMessage.isUpdateDisplayDataMsg(msg)) {
            return this.handleUpdateDisplayData(msg as KernelMessage.IUpdateDisplayDataMsg);
        }
    }

    private async handleUpdateDisplayData(msg: KernelMessage.IUpdateDisplayDataMsg) {
        // Send to the UI to handle
        return this.postMessage(InteractiveWindowMessages.UpdateDisplayData, msg).ignoreErrors();
    }
}
