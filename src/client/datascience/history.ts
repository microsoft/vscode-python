// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Position, Range, Selection, TextEditor, Uri, ViewColumn } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';

import {
    IApplicationShell,
    IDocumentManager,
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelProvider
} from '../common/application/types';
import { EXTENSION_ROOT_DIR } from '../common/constants';
import { createDeferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry';
import { HistoryMessages, Telemetry } from './constants';
import { CellState, ICell, ICodeCssGenerator, IHistory, INotebookServer } from './types';

@injectable()
export class History implements IWebPanelMessageListener, IHistory {
    private static activeHistory: History;
    private webPanel : IWebPanel | undefined;
    // tslint:disable-next-line: no-any
    private loadPromise: Promise<any>;
    private settingsChangedDisposable : Disposable;

    constructor(
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(INotebookServer) private jupyterServer: INotebookServer,
        @inject(IWebPanelProvider) private provider: IWebPanelProvider,
        @inject(ICodeCssGenerator) private cssGenerator : ICodeCssGenerator) {

        // Sign up for configuration changes
        this.settingsChangedDisposable = this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged);

        // Load on a background thread.
        this.loadPromise = this.load();
    }

    public async show() : Promise<void> {
        // Make sure we're loaded first
        await this.loadPromise;

        // Then show our web panel.
        if (this.webPanel) {
            await this.webPanel.show();
        }
    }

    public async addCode(code: string, file: string, line: number, editor?: TextEditor) : Promise<void> {
        // Make sure we're loaded first.
        await this.loadPromise;

        if (this.jupyterServer) {
            // Create a deferred that we'll fire when we're done
            const deferred = createDeferred();

            // Attempt to evaluate this cell in the jupyter notebook
            const observable = this.jupyterServer.executeObservable(code, file, line);

            // Sign up for cell changes
            observable.subscribe(
                (cells: ICell[]) => {
                    this.onAddCodeEvent(cells, editor);
                },
                (error) => {
                    this.applicationShell.showErrorMessage(error);
                    deferred.resolve();
                },
                () => {
                    deferred.resolve();
                });

            // Wait for the execution to finish
            await deferred.promise;

            // Then show our webpanel
            await this.show();
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

    public onDisposed() {
        this.settingsChangedDisposable.dispose();
        if (this.jupyterServer) {
            this.jupyterServer.dispose();
        }
        if (History.activeHistory === this) {
            delete History.activeHistory;
        }
    }

    private logTelemetry = (event : string) => {
        sendTelemetryEvent(event);
    }

    private onAddCodeEvent = (cells : ICell[], editor?: TextEditor) => {
        // Send each cell to the other side
        cells.forEach((cell : ICell) => {
            if (this.webPanel) {
                switch (cell.state) {
                    case CellState.init:
                        // Tell the react controls we have a new cell
                        this.webPanel.postMessage({ type: HistoryMessages.StartCell, payload: cell });
                        break;

                    case CellState.error:
                    case CellState.finished:
                        // Tell the react controls we're done
                        this.webPanel.postMessage({ type: HistoryMessages.FinishCell, payload: cell });
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
        this.loadPromise = this.loadJupyterServer();
    }

    @captureTelemetry(Telemetry.GotoSourceCode)
    private gotoCode(file: string, line: number) {
        this.documentManager.showTextDocument(Uri.file(file), { viewColumn: ViewColumn.One }).then((editor: TextEditor) => {
            editor.revealRange(new Range(line, 0, line, 0));
            editor.selection = new Selection(new Position(line, 0), new Position(line, 0));
        });
    }

    @captureTelemetry(Telemetry.RestartKernel)
    private restartKernel() {
        if (this.jupyterServer) {
            this.jupyterServer.restartKernel();
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

    private loadJupyterServer = async () : Promise<void> => {
        // Startup our jupyter server
        const status = this.applicationShell ? this.applicationShell.setStatusBarMessage(localize.DataScience.startingJupyter()) :
            undefined;
        try {
            await this.jupyterServer.start();
        } catch (err) {
            throw err;
        } finally {
            if (status) {
                status.dispose();
            }
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

    private load = () : Promise<[void, void]> => {
        return Promise.all([
            this.loadWebPanel(),
            this.loadJupyterServer()
        ]);
    }
}
