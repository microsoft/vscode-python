// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Position, Range, Selection, TextEditor, Uri, ViewColumn } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanel,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { CancellationError } from '../../common/cancellation';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { ContextKey } from '../../common/contextKey';
import { traceInfo } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposable, IDisposableRegistry, ILogger } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EditorContexts, Identifiers, Telemetry } from '../constants';
import { JupyterInstallError } from '../jupyter/jupyterInstallError';
import {
    CellState,
    ICell,
    ICodeCssGenerator,
    IConnection,
    IDataExplorerProvider,
    IDataScienceExtraSettings,
    IHistory,
    IHistoryInfo,
    IHistoryProvider,
    IJupyterExecution,
    IJupyterVariable,
    IJupyterVariables,
    INotebookExporter,
    INotebookServer,
    InterruptResult,
    IStatusProvider
} from '../types';
import { HistoryMessageListener } from './historyMessageListener';
import { HistoryMessages, IAddedSysInfo, IGotoCode, IHistoryMapping, IRemoteAddCode, ISubmitNewCell } from './historyTypes';

export enum SysInfoReason {
    Start,
    Restart,
    Interrupt,
    New
}

@injectable()
export class History implements IHistory {
    private disposed: boolean = false;
    private webPanel: IWebPanel | undefined;
    private webPanelInit: Deferred<void>;
    private loadPromise: Promise<void>;
    private interpreterChangedDisposable: Disposable;
    private closedEvent: EventEmitter<IHistory>;
    private unfinishedCells: ICell[] = [];
    private restartingKernel: boolean = false;
    private potentiallyUnfinishedStatus: Disposable[] = [];
    private addSysInfoPromise: Deferred<boolean> | undefined;
    private waitingForExportCells: boolean = false;
    private jupyterServer: INotebookServer | undefined;
    private changeHandler: IDisposable | undefined;
    private messageListener : HistoryMessageListener;
    private id : string;
    private executeEvent: EventEmitter<string> = new EventEmitter<string>();
    private viewState : { visible: boolean; active: boolean } = { visible: false, active: false };

    constructor(
        @inject(ILiveShareApi) private liveShare : ILiveShareApi,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IWebPanelProvider) private provider: IWebPanelProvider,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) private cssGenerator: ICodeCssGenerator,
        @inject(ILogger) private logger: ILogger,
        @inject(IStatusProvider) private statusProvider: IStatusProvider,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IHistoryProvider) private historyProvider: IHistoryProvider,
        @inject(IDataExplorerProvider) private dataExplorerProvider: IDataExplorerProvider,
        @inject(IJupyterVariables) private jupyterVariables: IJupyterVariables
        ) {

        // Create our unique id. We use this to skip messages we send to other history windows
        this.id = uuid();

        // Sign up for configuration changes
        this.interpreterChangedDisposable = this.interpreterService.onDidChangeInterpreter(this.onInterpreterChanged);
        this.changeHandler = this.configuration.getSettings().onDidChange(this.onSettingsChanged.bind(this));

        // Create our event emitter
        this.closedEvent = new EventEmitter<IHistory>();
        this.disposables.push(this.closedEvent);

        // Listen for active text editor changes. This is the only way we can tell that we might be needing to gain focus
        const handler = this.documentManager.onDidChangeActiveTextEditor(() => this.activate().ignoreErrors());
        this.disposables.push(handler);

        // Create a history message listener to listen to messages from our webpanel (or remote session)
        this.messageListener = new HistoryMessageListener(this.liveShare, this.onMessage, this.onViewStateChanged, this.dispose);

        // Setup our init promise for the web panel. We use this to make sure we're in sync with our
        // react control.
        this.webPanelInit = createDeferred();

        // If our execution changes its liveshare session, we need to close our server
        this.jupyterExecution.sessionChanged(() => this.loadPromise = this.reloadAfterShutdown());

        // Load on a background thread.
        this.loadPromise = this.load();
    }

    public get ready() : Promise<void> {
        // We need this to ensure the history window is up and ready to receive messages.
        return this.loadPromise;
    }

    public async show(): Promise<void> {
        if (!this.disposed) {
            // Make sure we're loaded first
            await this.loadPromise;

            // Make sure we have at least the initial sys info
            await this.addSysInfo(SysInfoReason.Start);

            // Then show our web panel.
            if (this.webPanel && this.jupyterServer) {
                await this.webPanel.show(true);
            }
        }
    }

    public get closed(): Event<IHistory> {
        return this.closedEvent.event;
    }

    public get onExecutedCode() : Event<string> {
        return this.executeEvent.event;
    }

    public addCode(code: string, file: string, line: number, editor?: TextEditor) : Promise<void> {
        // Call the internal method.
        return this.submitCode(code, file, line, undefined, editor);
    }

    // tslint:disable-next-line: no-any no-empty
    public async postMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) : Promise<void> {
        if (this.webPanel) {
            // Make sure the webpanel is up before we send it anything.
            await this.webPanelInit.promise;

            // Then send it the message
            this.webPanel.postMessage({ type: type.toString(), payload: payload });
        }
    }

    // tslint:disable-next-line: no-any no-empty
    public onMessage = (message: string, payload: any) => {
        switch (message) {
            case HistoryMessages.GotoCodeCell:
                this.dispatchMessage(message, payload, this.gotoCode);
                break;

            case HistoryMessages.RestartKernel:
                this.restartKernel();
                break;

            case HistoryMessages.ReturnAllCells:
                this.dispatchMessage(message, payload, this.handleReturnAllCells);
                break;

            case HistoryMessages.Interrupt:
                this.interruptKernel();
                break;

            case HistoryMessages.Export:
                this.dispatchMessage(message, payload, this.export);
                break;

            case HistoryMessages.Started:
                this.webPanelRendered();
                break;

            case HistoryMessages.SendInfo:
                this.dispatchMessage(message, payload, this.updateContexts);
                break;

            case HistoryMessages.SubmitNewCell:
                this.dispatchMessage(message, payload, this.submitNewCell);
                break;

            case HistoryMessages.DeleteAllCells:
                this.logTelemetry(Telemetry.DeleteAllCells);
                break;

            case HistoryMessages.DeleteCell:
                this.logTelemetry(Telemetry.DeleteCell);
                break;

            case HistoryMessages.Undo:
                this.logTelemetry(Telemetry.Undo);
                break;

            case HistoryMessages.Redo:
                this.logTelemetry(Telemetry.Redo);
                break;

            case HistoryMessages.ExpandAll:
                this.logTelemetry(Telemetry.ExpandAll);
                break;

            case HistoryMessages.CollapseAll:
                this.logTelemetry(Telemetry.CollapseAll);
                break;

            case HistoryMessages.AddedSysInfo:
                this.dispatchMessage(message, payload, this.onAddedSysInfo);
                break;

            case HistoryMessages.RemoteAddCode:
                this.dispatchMessage(message, payload, this.onRemoteAddedCode);
                break;

            case HistoryMessages.ShowDataExplorer:
                this.dispatchMessage(message, payload, this.showDataExplorer);
                break;

            case HistoryMessages.GetVariablesRequest:
                this.requestVariables().ignoreErrors();
                break;

            case HistoryMessages.GetVariableValueRequest:
                this.requestVariableValue(payload).ignoreErrors();
                break;

            default:
                break;
        }
    }

    public dispose = async () => {
        if (!this.disposed) {
            this.disposed = true;
            if (this.interpreterChangedDisposable) {
                this.interpreterChangedDisposable.dispose();
            }
            if (this.closedEvent) {
                this.closedEvent.fire(this);
            }
            this.updateContexts(undefined);
            if (this.webPanel) {
                this.webPanel.close();
                this.webPanel = undefined;
            }
        }
        if (this.changeHandler) {
            this.changeHandler.dispose();
            this.changeHandler = undefined;
        }
    }

    @captureTelemetry(Telemetry.Undo)
    public undoCells() {
        this.postMessage(HistoryMessages.Undo).ignoreErrors();
    }

    @captureTelemetry(Telemetry.Redo)
    public redoCells() {
        this.postMessage(HistoryMessages.Redo).ignoreErrors();
    }

    @captureTelemetry(Telemetry.DeleteAllCells)
    public removeAllCells() {
        this.postMessage(HistoryMessages.DeleteAllCells).ignoreErrors();
    }

    @captureTelemetry(Telemetry.ExpandAll)
    public expandAllCells() {
        this.postMessage(HistoryMessages.ExpandAll).ignoreErrors();
    }

    @captureTelemetry(Telemetry.CollapseAll)
    public collapseAllCells() {
        this.postMessage(HistoryMessages.CollapseAll).ignoreErrors();
    }

    public exportCells() {
        // First ask for all cells. Set state to indicate waiting for result
        this.waitingForExportCells = true;

        // Telemetry will fire when the export function is called.
        this.postMessage(HistoryMessages.GetAllCells).ignoreErrors();
    }

    @captureTelemetry(Telemetry.RestartKernel)
    public restartKernel() {
        if (this.jupyterServer && !this.restartingKernel) {
            // Ask the user if they want us to restart or not.
            const message = localize.DataScience.restartKernelMessage();
            const yes = localize.DataScience.restartKernelMessageYes();
            const no = localize.DataScience.restartKernelMessageNo();

            this.applicationShell.showInformationMessage(message, yes, no).then(v => {
                if (v === yes) {
                    this.restartKernelInternal().catch(e => {
                        this.applicationShell.showErrorMessage(e);
                        this.logger.logError(e);
                    });
                }
            });
        }
    }

    @captureTelemetry(Telemetry.Interrupt)
    public interruptKernel() {
        if (this.jupyterServer && !this.restartingKernel) {
            const status = this.statusProvider.set(localize.DataScience.interruptKernelStatus());

            const settings = this.configuration.getSettings();
            const interruptTimeout = settings.datascience.jupyterInterruptTimeout;

            this.jupyterServer.interruptKernel(interruptTimeout)
                .then(result => {
                    status.dispose();
                    if (result === InterruptResult.TimedOut) {
                        const message = localize.DataScience.restartKernelAfterInterruptMessage();
                        const yes = localize.DataScience.restartKernelMessageYes();
                        const no = localize.DataScience.restartKernelMessageNo();

                        this.applicationShell.showInformationMessage(message, yes, no).then(v => {
                            if (v === yes) {
                                this.restartKernelInternal().catch(e => {
                                    this.applicationShell.showErrorMessage(e);
                                    this.logger.logError(e);
                                });
                            }
                        });
                    } else if (result === InterruptResult.Restarted) {
                        // Uh-oh, keyboard interrupt crashed the kernel.
                        this.addSysInfo(SysInfoReason.Interrupt).ignoreErrors();
                    }
                })
                .catch(err => {
                    status.dispose();
                    this.logger.logError(err);
                    this.applicationShell.showErrorMessage(err);
                });
        }
    }

    private async showDataExplorer(variable: string) : Promise<void> {
        try {
            const pandasVersion = await this.dataExplorerProvider.getPandasVersion();
            if (!pandasVersion) {
                sendTelemetryEvent(Telemetry.PandasNotInstalled);
                // Warn user that there is no pandas.
                this.applicationShell.showErrorMessage(localize.DataScience.pandasRequiredForViewing());
            } else if (pandasVersion.major < 1 && pandasVersion.minor < 20) {
                sendTelemetryEvent(Telemetry.PandasTooOld);
                // Warn user that we cannot start because pandas is too old.
                const versionStr = `${pandasVersion.major}.${pandasVersion.minor}.${pandasVersion.build}`;
                this.applicationShell.showErrorMessage(localize.DataScience.pandasTooOldForViewingFormat().format(versionStr));
            } else {
                await this.dataExplorerProvider.create(variable);
            }
        } catch (e) {
            this.applicationShell.showErrorMessage(e.toString());
        }
    }

    private onViewStateChanged = (webPanel: IWebPanel) => {
        const oldActive = this.viewState.active;
        this.viewState.active = webPanel.isActive();
        this.viewState.visible = webPanel.isVisible();

        // See if suddenly becoming active or not
        if (!oldActive && this.viewState.active) {
            this.activate().ignoreErrors();
        }
    }

    private async activate() {
        // Only activate if the active editor is empty. This means that
        // vscode thinks we are actually supposed to have focus. It would be
        // nice if they would more accurrately tell us this, but this works for now.
        // Essentially the problem is the webPanel.active state doesn't track
        // if the focus is supposed to be in the webPanel or not. It only tracks if
        // it's been activated. However if there's no active text editor and we're active, we
        // can safely attempt to give ourselves focus. This won't actually give us focus if we aren't
        // allowed to have it.
        if (this.webPanel && this.viewState.active && !this.documentManager.activeTextEditor) {
            // Force the webpanel to reveal and take focus.
            await this.webPanel.show(false);

            // Send this to the react control
            await this.postMessage(HistoryMessages.Activate);
        }
    }

    // tslint:disable-next-line:no-any
    private dispatchMessage<M extends IHistoryMapping, T extends keyof M>(_message: T, payload: any, handler: (args : M[T]) => void) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }

    // tslint:disable-next-line:no-any
    private onAddedSysInfo(sysInfo : IAddedSysInfo) {
        // See if this is from us or not.
        if (sysInfo.id !== this.id) {

            // Not from us, must come from a different history window. Add to our
            // own to keep in sync
            if (sysInfo.sysInfoCell) {
                this.onAddCodeEvent([sysInfo.sysInfoCell]);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private onRemoteAddedCode(args: IRemoteAddCode) {
        // Make sure this is valid
        if (args && args.id && args.file && args.originator !== this.id) {
            // Indicate this in our telemetry.
            sendTelemetryEvent(Telemetry.RemoteAddCode);

            // Submit this item as new code.
            this.submitCode(args.code, args.file, args.line, args.id).ignoreErrors();
        }
    }

    private async restartKernelInternal(): Promise<void> {
        this.restartingKernel = true;

        // First we need to finish all outstanding cells.
        this.unfinishedCells.forEach(c => {
            c.state = CellState.error;
            this.postMessage(HistoryMessages.FinishCell, c).ignoreErrors();
        });
        this.unfinishedCells = [];
        this.potentiallyUnfinishedStatus.forEach(s => s.dispose());
        this.potentiallyUnfinishedStatus = [];

        // Set our status
        const status = this.statusProvider.set(localize.DataScience.restartingKernelStatus());

        try {
            if (this.jupyterServer) {
                await this.jupyterServer.restartKernel();
                await this.addSysInfo(SysInfoReason.Restart);
            }
        } finally {
            status.dispose();
            this.restartingKernel = false;
        }
    }

    // tslint:disable-next-line:no-any
    private handleReturnAllCells(cells: ICell[]) {
        // See what we're waiting for.
        if (this.waitingForExportCells) {
            this.export(cells);
        }
    }

    // tslint:disable-next-line:no-any
    private webPanelRendered() {
        if (!this.webPanelInit.resolved) {
            this.webPanelInit.resolve();
        }
    }

    // tslint:disable-next-line:no-any
    private updateContexts(info: IHistoryInfo | undefined) {
        // This should be called by the python interactive window every
        // time state changes. We use this opportunity to update our
        // extension contexts
        const interactiveContext = new ContextKey(EditorContexts.HaveInteractive, this.commandManager);
        interactiveContext.set(!this.disposed).catch();
        const interactiveCellsContext = new ContextKey(EditorContexts.HaveInteractiveCells, this.commandManager);
        const redoableContext = new ContextKey(EditorContexts.HaveRedoableCells, this.commandManager);
        if (info) {
            interactiveCellsContext.set(info.cellCount > 0).catch();
            redoableContext.set(info.redoCount > 0).catch();
        } else {
            interactiveCellsContext.set(false).catch();
            redoableContext.set(false).catch();
        }
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    private submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            // Send to ourselves.
            this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id, undefined).ignoreErrors();

            // Activate the other side, and send as if came from a file
            this.historyProvider.getOrCreateActive().then(_v => {
                this.shareMessage(HistoryMessages.RemoteAddCode, {code: info.code, file: Identifiers.EmptyFileName, line: 0, id: info.id, originator: this.id});
            }).ignoreErrors();
        }
    }

    private async submitCode(code: string, file: string, line: number, id?: string, _editor?: TextEditor) : Promise<void> {
        this.logger.logInformation(`Submitting code for ${this.id}`);

        // Start a status item
        const status = this.setStatus(localize.DataScience.executingCode());

        // Transmit this submission to all other listeners (in a live share session)
        if (!id) {
            id = uuid();
            this.shareMessage(HistoryMessages.RemoteAddCode, {code, file, line, id, originator: this.id});
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
            try {
                this.logger.logInformation('Waiting for jupyter server and web panel ...');
                await this.loadPromise;
            } catch (exc) {
                // We should dispose ourselves if the load fails. Othewise the user
                // updates their install and we just fail again because the load promise is the same.
                await this.dispose();

                throw exc;
            }

            // Then show our webpanel
            await this.show();

            // Add our sys info if necessary
            if (file !== Identifiers.EmptyFileName) {
                await this.addSysInfo(SysInfoReason.Start);
            }

            if (this.jupyterServer) {
                // Before we try to execute code make sure that we have an initial directory set
                // Normally set via the workspace, but we might not have one here if loading a single loose file
                if (file !== Identifiers.EmptyFileName) {
                    await this.jupyterServer.setInitialDirectory(path.dirname(file));
                }

                // Attempt to evaluate this cell in the jupyter notebook
                const observable = this.jupyterServer.executeObservable(code, file, line, id, false);

                // Indicate we executed some code
                this.executeEvent.fire(code);

                // Sign up for cell changes
                observable.subscribe(
                    (cells: ICell[]) => {
                        this.onAddCodeEvent(cells, undefined);
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
                    });

                // Wait for the cell to finish
                await finishedAddingCode.promise;
                traceInfo(`Finished execution for ${id}`);
            }
        } catch (err) {
            status.dispose();

            const message = localize.DataScience.executingCodeFailure().format(err);
            this.applicationShell.showErrorMessage(message);
        }
    }

    private setStatus = (message: string): Disposable => {
        const result = this.statusProvider.set(message);
        this.potentiallyUnfinishedStatus.push(result);
        return result;
    }

    private logTelemetry = (event : Telemetry) => {
        sendTelemetryEvent(event);
    }

    private onAddCodeEvent = (cells: ICell[], editor?: TextEditor) => {
        // Send each cell to the other side
        cells.forEach((cell: ICell) => {
            if (this.webPanel) {
                switch (cell.state) {
                    case CellState.init:
                        // Tell the react controls we have a new cell
                        this.postMessage(HistoryMessages.StartCell, cell).ignoreErrors();

                        // Keep track of this unfinished cell so if we restart we can finish right away.
                        this.unfinishedCells.push(cell);
                        break;

                    case CellState.executing:
                        // Tell the react controls we have an update
                        this.postMessage(HistoryMessages.UpdateCell, cell).ignoreErrors();
                        break;

                    case CellState.error:
                    case CellState.finished:
                        // Tell the react controls we're done
                        this.postMessage(HistoryMessages.FinishCell, cell).ignoreErrors();

                        // Remove from the list of unfinished cells
                        this.unfinishedCells = this.unfinishedCells.filter(c => c.id !== cell.id);
                        break;

                    default:
                        break; // might want to do a progress bar or something
                }
            }
        });

        // If we have more than one cell, the second one should be a code cell. After it finishes, we need to inject a new cell entry
        if (cells.length > 1 && cells[1].state === CellState.finished) {
            // If we have an active editor, do the edit there so that the user can undo it, otherwise don't bother
            if (editor) {
                editor.edit((editBuilder) => {
                    editBuilder.insert(new Position(cells[1].line, 0), '#%%\n');
                });
            }
        }
    }

    // Post a message to our webpanel and update our new datascience settings
    private onSettingsChanged = () => {
        // Stringify our settings to send over to the panel
        const dsSettings = JSON.stringify(this.generateDataScienceExtraSettings());
        this.postMessage(HistoryMessages.UpdateSettings, dsSettings).ignoreErrors();
    }

    private onInterpreterChanged = () => {
        // Update our load promise. We need to restart the jupyter server
        this.loadPromise = this.reloadWithNew();
    }

    private async reloadWithNew() : Promise<void> {
        const status = this.setStatus(localize.DataScience.startingJupyter());
        try {
            // Not the same as reload, we need to actually dispose the server.
            if (this.loadPromise) {
                await this.loadPromise;
                if (this.jupyterServer) {
                    const server = this.jupyterServer;
                    this.jupyterServer = undefined;
                    await server.dispose();
                }
            }
            await this.load();
            await this.addSysInfo(SysInfoReason.New);
        } finally {
            status.dispose();
        }
    }

    private async reloadAfterShutdown() : Promise<void> {
        try {
            if (this.loadPromise) {
                await this.loadPromise;
                if (this.jupyterServer) {
                    const server = this.jupyterServer;
                    this.jupyterServer = undefined;
                    server.shutdown().ignoreErrors(); // Don't care what happens as we're disconnected.
                }
            }
        } catch {
            // We just switched from host to guest mode. Don't really care
            // if closing the host server kills it.
            this.jupyterServer = undefined;
        }
        return this.load();
    }

    @captureTelemetry(Telemetry.GotoSourceCode, undefined, false)
    private gotoCode(args: IGotoCode) {
        this.gotoCodeInternal(args.file, args.line).catch(err => {
            this.applicationShell.showErrorMessage(err);
        });
    }

    private async gotoCodeInternal(file: string, line: number) {
        let editor: TextEditor | undefined;

        if (await fs.pathExists(file)) {
            editor = await this.documentManager.showTextDocument(Uri.file(file), { viewColumn: ViewColumn.One });
        } else {
            // File URI isn't going to work. Look through the active text documents
            editor = this.documentManager.visibleTextEditors.find(te => te.document.fileName === file);
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

    @captureTelemetry(Telemetry.ExportNotebook, undefined, false)
    // tslint:disable-next-line: no-any no-empty
    private export(cells: ICell[]) {
        // Should be an array of cells
        if (cells && this.applicationShell) {

            const filtersKey = localize.DataScience.exportDialogFilter();
            const filtersObject: Record<string, string[]> = {};
            filtersObject[filtersKey] = ['ipynb'];

            // Bring up the open file dialog box
            this.applicationShell.showSaveDialog(
                {
                    saveLabel: localize.DataScience.exportDialogTitle(),
                    filters: filtersObject
                }).then(async (uri: Uri | undefined) => {
                    if (uri) {
                        await this.exportToFile(cells, uri.fsPath);
                    }
                });
        }
    }

    private showInformationMessage(message: string, question?: string) : Thenable<string | undefined> {
        if (question) {
            return this.applicationShell.showInformationMessage(message, question);
        } else {
            return this.applicationShell.showInformationMessage(message);
        }
    }

    private exportToFile = async (cells: ICell[], file: string) => {
        // Take the list of cells, convert them to a notebook json format and write to disk
        if (this.jupyterServer) {
            let directoryChange;
            const settings = this.configuration.getSettings();
            if (settings.datascience.changeDirOnImportExport) {
                directoryChange = file;
            }

            const notebook = await this.jupyterExporter.translateToNotebook(cells, directoryChange);

            try {
                // tslint:disable-next-line: no-any
                await this.fileSystem.writeFile(file, JSON.stringify(notebook), { encoding: 'utf8', flag: 'w' });
                const openQuestion = (await this.jupyterExecution.isSpawnSupported()) ? localize.DataScience.exportOpenQuestion() : undefined;
                this.showInformationMessage(localize.DataScience.exportDialogComplete().format(file), openQuestion).then((str: string | undefined) => {
                    if (str && this.jupyterServer) {
                        // If the user wants to, open the notebook they just generated.
                        this.jupyterExecution.spawnNotebook(file).ignoreErrors();
                    }
                });
            } catch (exc) {
                this.logger.logError('Error in exporting notebook file');
                this.applicationShell.showInformationMessage(localize.DataScience.exportDialogFailed().format(exc));
            }
        }
    }

    private async loadJupyterServer(_restart?: boolean): Promise<void> {
        this.logger.logInformation('Getting jupyter server options ...');

        // Extract our options
        const options = await this.historyProvider.getNotebookOptions();

        this.logger.logInformation('Connecting to jupyter server ...');

        // Now try to create a notebook server
        this.jupyterServer = await this.jupyterExecution.connectToNotebookServer(options);

        this.logger.logInformation('Connected to jupyter server.');
    }

    private generateSysInfoCell = async (reason: SysInfoReason): Promise<ICell | undefined> => {
        // Execute the code 'import sys\r\nsys.version' and 'import sys\r\nsys.executable' to get our
        // version and executable
        if (this.jupyterServer) {
            const message = await this.generateSysInfoMessage(reason);

            // The server handles getting this data.
            const sysInfo = await this.jupyterServer.getSysInfo();
            if (sysInfo) {
                // Connection string only for our initial start, not restart or interrupt
                let connectionString: string = '';
                if (reason === SysInfoReason.Start) {
                    connectionString = this.generateConnectionInfoString(this.jupyterServer.getConnectionInfo());
                }

                // Update our sys info with our locally applied data.
                sysInfo.data.message = message;
                sysInfo.data.connection = connectionString;

                return sysInfo;
            }
        }
    }

    private async generateSysInfoMessage(reason: SysInfoReason): Promise<string> {
        switch (reason) {
            case SysInfoReason.Start:
                // Message depends upon if ipykernel is supported or not.
                if (!(await this.jupyterExecution.isKernelCreateSupported())) {
                    return localize.DataScience.pythonVersionHeaderNoPyKernel();
                }
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
            default:
                this.logger.logError('Invalid SysInfoReason');
                return '';
                break;
        }
    }

    private generateConnectionInfoString(connInfo: IConnection | undefined): string {
        if (!connInfo) {
            return '';
        }

        const tokenString = connInfo.token.length > 0 ? `?token=${connInfo.token}` : '';
        const urlString = `${connInfo.baseUrl}${tokenString}`;

        return `${localize.DataScience.sysInfoURILabel()}${urlString}`;
    }

    private shareMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) {
        // Send our remote message.
        this.messageListener.onMessage(type.toString(), payload);
    }

    private addSysInfo = async (reason: SysInfoReason): Promise<void> => {
        if (!this.addSysInfoPromise || reason !== SysInfoReason.Start) {
            this.logger.logInformation(`Adding sys info for ${this.id} ${reason}`);
            const deferred = createDeferred<boolean>();
            this.addSysInfoPromise = deferred;

            // Generate a new sys info cell and send it to the web panel.
            const sysInfo = await this.generateSysInfoCell(reason);
            if (sysInfo) {
                this.onAddCodeEvent([sysInfo]);
            }

            // For anything but start, tell the other sides of a live share session
            if (reason !== SysInfoReason.Start && sysInfo) {
                this.shareMessage(HistoryMessages.AddedSysInfo, { sysInfoCell: sysInfo, id: this.id });
            }

            this.logger.logInformation(`Sys info for ${this.id} ${reason} complete`);
            deferred.resolve(true);
        } else if (this.addSysInfoPromise) {
            this.logger.logInformation(`Wait for sys info for ${this.id} ${reason}`);
            await this.addSysInfoPromise.promise;
        }
    }

    private generateDataScienceExtraSettings() : IDataScienceExtraSettings {
        const terminal = this.workspaceService.getConfiguration('terminal');
        const terminalCursor = terminal ? terminal.get<string>('integrated.cursorStyle', 'block') : 'block';
        return {
            ...this.configuration.getSettings().datascience,
            extraSettings: {
                terminalCursor: terminalCursor
            }
        };
    }

    private loadWebPanel = async (): Promise<void> => {
        this.logger.logInformation(`Loading web panel. Panel is ${this.webPanel ? 'set' : 'notset'}`);

        // Create our web panel (it's the UI that shows up for the history)
        if (this.webPanel === undefined) {
            // Figure out the name of our main bundle. Should be in our output directory
            const mainScriptPath = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'history-react', 'index_bundle.js');

            this.logger.logInformation('Generating CSS...');
            // Generate a css to put into the webpanel for viewing code
            const css = await this.cssGenerator.generateThemeCss();

            // Get our settings to pass along to the react control
            const settings = this.generateDataScienceExtraSettings();

            this.logger.logInformation('Loading web view...');
            // Use this script to create our web view panel. It should contain all of the necessary
            // script to communicate with this class.
            this.webPanel = this.provider.create(ViewColumn.Two, this.messageListener, localize.DataScience.historyTitle(), mainScriptPath, css, settings);

            this.logger.logInformation('Web view created.');
        }
    }

    private async checkUsable() : Promise<boolean> {
        let activeInterpreter : PythonInterpreter | undefined;
        try {
            activeInterpreter = await this.interpreterService.getActiveInterpreter();
            const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
            if (usableInterpreter) {
                // See if the usable interpreter is not our active one. If so, show a warning
                // Only do this if not the guest in a liveshare session
                const api = await this.liveShare.getApi();
                if (!api || (api.session && api.session.role !== vsls.Role.Guest)) {
                    const active = await this.interpreterService.getActiveInterpreter();
                    const activeDisplayName = active ? active.displayName : undefined;
                    const activePath = active ? active.path : undefined;
                    const usableDisplayName = usableInterpreter ? usableInterpreter.displayName : undefined;
                    const usablePath = usableInterpreter ? usableInterpreter.path : undefined;
                    if (activePath && usablePath && !this.fileSystem.arePathsSame(activePath, usablePath) && activeDisplayName && usableDisplayName) {
                        this.applicationShell.showWarningMessage(localize.DataScience.jupyterKernelNotSupportedOnActive().format(activeDisplayName, usableDisplayName));
                    }
                }
            }

            return usableInterpreter ? true : false;

        } catch (e) {
            // Can't find a usable interpreter, show the error.
            if (activeInterpreter) {
                const displayName = activeInterpreter.displayName ? activeInterpreter.displayName : activeInterpreter.path;
                throw new Error(localize.DataScience.jupyterNotSupportedBecauseOfEnvironment().format(displayName, e.toString()));
            } else {
                throw new JupyterInstallError(localize.DataScience.jupyterNotSupported(), localize.DataScience.pythonInteractiveHelpLink());
            }
        }
    }

    private load = async (): Promise<void> => {
        // Status depends upon if we're about to connect to existing server or not.
        const status = (await this.jupyterExecution.getServer(await this.historyProvider.getNotebookOptions())) ?
            this.setStatus(localize.DataScience.connectingToJupyter()) : this.setStatus(localize.DataScience.startingJupyter());

        // Check to see if we support ipykernel or not
        try {
            const usable = await this.checkUsable();
            if (!usable) {
                // Not loading anymore
                status.dispose();

                // Indicate failing.
                throw new JupyterInstallError(localize.DataScience.jupyterNotSupported(), localize.DataScience.pythonInteractiveHelpLink());
            }

            // Get the web panel to show first
            await this.loadWebPanel();

            // Then load the jupyter server
            await this.loadJupyterServer();

        } finally {
            status.dispose();
        }
    }

    private requestVariables = async (): Promise<void> => {
        // Request our new list of variables
        const vars: IJupyterVariable[] = await this.jupyterVariables.getVariables();
        this.postMessage(HistoryMessages.GetVariablesResponse, vars).ignoreErrors();
    }

    // tslint:disable-next-line: no-any
    private requestVariableValue = async (payload?: any): Promise<void> => {
        if (payload) {
            const targetVar = payload as IJupyterVariable;
            // Request our variable value
            const varValue: IJupyterVariable = await this.jupyterVariables.getValue(targetVar);
            this.postMessage(HistoryMessages.GetVariableValueResponse, varValue).ignoreErrors();
        }
    }
}
