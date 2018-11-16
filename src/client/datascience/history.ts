// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Position, Range, Selection, TextEditor, Uri, ViewColumn } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';

import {
    IApplicationShell,
    IDocumentManager,
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelProvider
} from '../common/application/types';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { IDisposableRegistry, ILogger } from '../common/types';
import * as localize from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry';
import { HistoryMessages, Telemetry } from './constants';
import { JupyterInstallError } from './jupyterInstallError';
import { CellState, ICell, ICodeCssGenerator, IHistory, IJupyterExecution, INotebookServer, IStatusProvider } from './types';

@injectable()
export class History implements IWebPanelMessageListener, IHistory {
    private disposed : boolean = false;
    private webPanel : IWebPanel | undefined;
    private loadPromise: Promise<void>;
    private settingsChangedDisposable : Disposable;
    private closedEvent : EventEmitter<IHistory>;
    private unfinishedCells: ICell[] = [];
    private restartingKernel: boolean = false;
    private potentiallyUnfinishedStatus: Disposable[] = [];
    private addedSysInfo: boolean = false;
    private ignoreCount: number = 0;

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(INotebookServer) private jupyterServer: INotebookServer,
        @inject(IWebPanelProvider) private provider: IWebPanelProvider,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) private cssGenerator : ICodeCssGenerator,
        @inject(ILogger) private logger : ILogger,
        @inject(IStatusProvider) private statusProvider : IStatusProvider,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution) {

        // Sign up for configuration changes
        this.settingsChangedDisposable = this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged);

        // Create our event emitter
        this.closedEvent = new EventEmitter<IHistory>();
        this.disposables.push(this.closedEvent);

        // Load on a background thread.
        this.loadPromise = this.load();
    }

    public async show() : Promise<void> {
        if (!this.disposed) {
            // Make sure we're loaded first
            await this.loadPromise;

            // Then show our web panel.
            if (this.webPanel && this.jupyterServer) {
                await this.webPanel.show();
            }
        }
    }

    public get closed() : Event<IHistory> {
        return this.closedEvent.event;
    }

    public async addCode(code: string, file: string, line: number, editor?: TextEditor) : Promise<void> {
        // Start a status item
        const status = this.setStatus(localize.DataScience.executingCode());

        try {
            // Make sure we're loaded first.
            await this.loadPromise;

            // Then show our webpanel
            await this.show();

            // Add our sys info if necessary
            await this.addInitialSysInfo();

            if (this.jupyterServer) {
                // Attempt to evaluate this cell in the jupyter notebook
                const observable = this.jupyterServer.executeObservable(code, file, line);

                // Sign up for cell changes
                observable.subscribe(
                    (cells: ICell[]) => {
                        this.onAddCodeEvent(cells, editor);
                    },
                    (error) => {
                        status.dispose();
                        this.applicationShell.showErrorMessage(error);
                    },
                    () => {
                        // Indicate executing until this cell is done.
                        status.dispose();
                    });
            }
        } catch (err) {
            status.dispose();

            // We failed, dispose of ourselves too so that nobody uses us again
            this.dispose().ignoreErrors();

            throw err;
        }
    }

    // tslint:disable-next-line: no-any no-empty
    public postMessage(type: string, payload?: any) {
        if (this.webPanel) {
            this.webPanel.postMessage({type: type, payload: payload});
        }
    }

    // tslint:disable-next-line: no-any no-empty
    public onMessage = (message: string, payload: any) => {
        switch (message) {
            case HistoryMessages.GotoCodeCell:
                this.gotoCode(payload.file, payload.line);
                break;

            case HistoryMessages.RestartKernel:
                this.restartKernel();
                break;

            case HistoryMessages.Export:
                this.export(payload);
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

            default:
                break;
        }
    }

    public async dispose() {
        if (!this.disposed) {
            this.disposed = true;
            this.settingsChangedDisposable.dispose();
            if (this.jupyterServer) {
                await this.jupyterServer.shutdown();
            }
            this.closedEvent.fire(this);
        }
    }

    private setStatus = (message: string) : Disposable => {
        const result = this.statusProvider.set(message, this);
        this.potentiallyUnfinishedStatus.push(result);
        return result;
    }

    private logTelemetry = (event : string) => {
        sendTelemetryEvent(event);
    }

    private sendCell(cell: ICell, message: string) {
        // Remove our ignore count from the execution count prior to sending
        const copy = JSON.parse(JSON.stringify(cell));
        if (copy.data && copy.data.execution_count !== null && copy.data.execution_count > 0) {
            const count = cell.data.execution_count as number;
            copy.data.execution_count = count - this.ignoreCount;
        }
        if (this.webPanel) {
            this.webPanel.postMessage({type: message, payload: copy});
        }
    }

    private onAddCodeEvent = (cells : ICell[], editor?: TextEditor) => {
        // Send each cell to the other side
        cells.forEach((cell : ICell) => {
            if (this.webPanel) {
                switch (cell.state) {
                    case CellState.init:
                        // Tell the react controls we have a new cell
                        this.sendCell(cell, HistoryMessages.StartCell);

                        // Keep track of this unfinished cell so if we restart we can finish right away.
                        this.unfinishedCells.push(cell);
                        break;

                    case CellState.executing:
                        // Tell the react controls we have an update
                        this.sendCell(cell, HistoryMessages.UpdateCell);
                        break;

                    case CellState.error:
                    case CellState.finished:
                        // Tell the react controls we're done
                        this.sendCell(cell,  HistoryMessages.FinishCell);

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

    private onSettingsChanged = async () => {
        // Update our load promise. We need to restart the jupyter server
        if (this.loadPromise) {
            await this.loadPromise;
            if (this.jupyterServer) {
                await this.jupyterServer.shutdown();
            }
        }
        this.loadPromise = this.loadJupyterServer(true);
    }

    @captureTelemetry(Telemetry.GotoSourceCode, {}, false)
    private gotoCode(file: string, line: number) {
        this.gotoCodeInternal(file, line).catch(err => {
            this.applicationShell.showErrorMessage(err);
        });
    }

    private async gotoCodeInternal(file: string, line: number) {
        let editor : TextEditor | undefined;

        if (await fs.pathExists(file)) {
            editor = await this.documentManager.showTextDocument(Uri.file(file), {viewColumn: ViewColumn.One});
        } else {
            // File URI isn't going to work. Look through the active text documents
            editor = this.documentManager.visibleTextEditors.find(te => te.document.fileName === file);
            if (editor) {
                editor.show(ViewColumn.One);
            }
        }

        // If we found the editor change its selection
        if (editor) {
            editor.revealRange(new Range(line, 0, line, 0));
            editor.selection = new Selection(new Position(line, 0), new Position(line, 0));
        }
    }

    @captureTelemetry(Telemetry.RestartKernel)
    private restartKernel() {
        if (this.jupyterServer && !this.restartingKernel) {
            this.restartingKernel = true;

            // Ask the user if they want us to restart or not.
            const message = localize.DataScience.restartKernelMessage();
            const yes = localize.DataScience.restartKernelMessageYes();
            const no = localize.DataScience.restartKernelMessageNo();

            this.applicationShell.showInformationMessage(message, yes, no).then(v => {
                if (v === yes) {
                    // First we need to finish all outstanding cells.
                    this.unfinishedCells.forEach(c => {
                        c.state = CellState.error;
                        this.webPanel.postMessage({ type: HistoryMessages.FinishCell, payload: c });
                    });
                    this.unfinishedCells = [];
                    this.potentiallyUnfinishedStatus.forEach(s => s.dispose());
                    this.potentiallyUnfinishedStatus = [];

                    // Set our status
                    const status = this.statusProvider.set(localize.DataScience.restartingKernelStatus(), this);

                    // Then restart the kernel. When that finishes, add our sys info again
                    this.jupyterServer.restartKernel()
                        .then(() => {
                            this.addRestartSysInfo().then(status.dispose()).ignoreErrors();
                        })
                        .catch(err => {
                            this.logger.logError(err);
                            status.dispose();
                        });
                    this.restartingKernel = false;
                } else {
                    this.restartingKernel = false;
                }
            });
        }
    }

    @captureTelemetry(Telemetry.ExportNotebook, {}, false)
    // tslint:disable-next-line: no-any no-empty
    private export (payload: any) {
        if (payload.contents) {
            // Should be an array of cells
            const cells = payload.contents as ICell[];
            if (cells && this.applicationShell) {

                const filtersKey = localize.DataScience.exportDialogFilter();
                const filtersObject = {};
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
    }

    private exportToFile = async (cells: ICell[], file : string) => {
        // Take the list of cells, convert them to a notebook json format and write to disk
        if (this.jupyterServer) {
            const notebook = await this.jupyterServer.translateToNotebook(cells);

            try {
                // tslint:disable-next-line: no-any
                await fs.writeFile(file, JSON.stringify(notebook), {encoding: 'utf8', flag: 'w'});
                this.applicationShell.showInformationMessage(localize.DataScience.exportDialogComplete().format(file), localize.DataScience.exportOpenQuestion()).then((str : string | undefined) => {
                    if (str && file && this.jupyterServer) {
                        // If the user wants to, open the notebook they just generated.
                        this.jupyterServer.launchNotebook(file).ignoreErrors();
                    }
                });
            } catch (exc) {
                this.applicationShell.showInformationMessage(localize.DataScience.exportDialogFailed().format(exc));
            }

        }
    }

    private loadJupyterServer = async (restart?: boolean) : Promise<void> => {
        // Startup our jupyter server
        const status = this.setStatus(localize.DataScience.startingJupyter());
        try {
            await this.jupyterServer.start();

            // If this is a restart, show our restart info
            if (restart) {
                await this.addRestartSysInfo();
            }
        } catch (err) {
            throw err;
        } finally {
            if (status) {
                status.dispose();
            }
        }
    }

    private extractStreamOutput(cell: ICell) : string {
        let result = '';
        if (cell.state === CellState.error || cell.state === CellState.finished) {
            const outputs = cell.data.outputs as nbformat.IOutput[];
            if (outputs) {
                outputs.forEach(o => {
                    if (o.output_type === 'stream') {
                        const stream = o as nbformat.IStream;
                        result = result.concat(stream.text.toString());
                    } else {
                        const data = o.data;
                        if (data && data.hasOwnProperty('text/plain')) {
                            result = result.concat(data['text/plain']);
                        }
                    }
                });
            }
        }
        return result;
    }

    private generateSysInfoCell = async (message: string) : Promise<ICell> => {
        // Execute the code 'import sys\r\nsys.version' and 'import sys\r\nsys.executable' to get our
        // version and executable
        // tslint:disable-next-line:no-multiline-string
        const versionCells = await this.jupyterServer.execute(`import sys\r\nsys.version`, 'foo.py', 0);
        // tslint:disable-next-line:no-multiline-string
        const pathCells = await this.jupyterServer.execute(`import sys\r\nsys.executable`, 'foo.py', 0);

        // Both should have streamed output
        const version = versionCells.length > 0 ? this.extractStreamOutput(versionCells[0]).trimQuotes() : '';
        const pythonPath = versionCells.length > 0 ? this.extractStreamOutput(pathCells[0]).trimQuotes() : '';

        // Both should influence our ignore count. We don't want them to count against execution
        this.ignoreCount = this.ignoreCount + 2;

        // Combine this data together to make our sys info
        return {
            data: {
                cell_type : 'sys_info',
                message: message,
                version: version,
                path: pythonPath,
                metadata : {},
                source : []
            },
            id: uuid(),
            file: '',
            line: 0,
            state: CellState.finished
        };
    }

    private addInitialSysInfo = async () : Promise<void> => {
        // Message depends upon if ipykernel is supported or not.
        if (!(await this.jupyterExecution.isipykernelSupported())) {
            return this.addSysInfo(localize.DataScience.pythonVersionHeaderNoPyKernel());
        }

        return this.addSysInfo(localize.DataScience.pythonVersionHeader());
    }

    private addRestartSysInfo = () : Promise<void> => {
        this.addedSysInfo = false;
        return this.addSysInfo(localize.DataScience.pythonRestartHeader());
    }

    private addSysInfo = async (message: string) : Promise<void> => {
        // Add our sys info if necessary
        if (!this.addedSysInfo) {
            this.addedSysInfo = true;
            this.ignoreCount = 0;

            // Generate a new sys info cell and send it to the web panel.
            const sysInfo = await this.generateSysInfoCell(message);
            this.onAddCodeEvent([sysInfo]);
        }
    }

    private loadWebPanel = async () : Promise<void> => {
        // Create our web panel (it's the UI that shows up for the history)

        // Figure out the name of our main bundle. Should be in our output directory
        const mainScriptPath = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'history-react', 'index_bundle.js');

        // Generate a css to put into the webpanel for viewing code
        const css = await this.cssGenerator.generateThemeCss();

        // Use this script to create our web view panel. It should contain all of the necessary
        // script to communicate with this class.
        this.webPanel = this.provider.create(this, localize.DataScience.historyTitle(), mainScriptPath, css);
    }

    private load = async () : Promise<void> => {
        // Check to see if we support jupyter or not. If not quick fail
        if (!(await this.jupyterExecution.isImportSupported())) {
            throw new JupyterInstallError(localize.DataScience.jupyterNotSupported(), localize.DataScience.pythonInteractiveHelpLink());
        }

        // Otherwise wait for both
        await Promise.all([this.loadJupyterServer(), this.loadWebPanel()]);
    }
}
