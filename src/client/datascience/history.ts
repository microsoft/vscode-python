// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as fs from 'fs-extra';
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
import { createDeferred } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { CodeCssGenerator } from './codeCssGenerator';
import { HistoryMessages } from './constants';
import { CellState, ICell, IJupyterServer, IJupyterServerProvider } from './types';

export class History implements IWebPanelMessageListener {
    private static activeHistory: History;
    private webPanel : IWebPanel | undefined;
    // tslint:disable-next-line: no-unused-variable
    private jupyterServer: IJupyterServer | undefined;
    // tslint:disable-next-line: no-any
    private loadPromise: Promise<any>;
    private documentManager : IDocumentManager;
    private applicationShell : IApplicationShell;
    private interpreterService : IInterpreterService;
    private serviceContainer : IServiceContainer;
    private settingsChangedDisposable : Disposable;

    constructor(serviceContainer: IServiceContainer) {
        this.serviceContainer = serviceContainer;

        // Save our services
        this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager);
        this.applicationShell = serviceContainer.get<IApplicationShell>(IApplicationShell);

        // Sign up for configuration changes
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.settingsChangedDisposable = this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged);

        // Load on a background thread.
        this.loadPromise = this.load(serviceContainer);
    }

    public static getOrCreateActive(serviceContainer: IServiceContainer) {
        if (!(History.activeHistory)) {
            History.activeHistory = new History(serviceContainer);
        }
        return History.activeHistory;
    }

    public static setActive(active: History) {
        History.activeHistory = active;
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
                this.jupyterServer.dispose();
                this.jupyterServer = undefined;
            }
        }
        this.loadPromise = this.loadJupyterServer(this.serviceContainer);
    }

    private gotoCode = (file: string, line: number) => {
        this.documentManager.showTextDocument(Uri.file(file), { viewColumn: ViewColumn.One }).then((editor: TextEditor) => {
            editor.revealRange(new Range(line, 0, line, 0));
            editor.selection = new Selection(new Position(line, 0), new Position(line, 0));
        });
    }

    private restartKernel = () => {
        if (this.jupyterServer) {
            this.jupyterServer.restartKernel();
        }
    }

    // tslint:disable-next-line: no-any no-empty
    private export = (payload: any) => {
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

    private loadJupyterServer = async (serviceContainer: IServiceContainer) : Promise<void> => {
        // Startup our jupyter server
        const status = this.applicationShell ? this.applicationShell.setStatusBarMessage(localize.DataScience.startingJupyter()) :
            undefined;
        try {
            const provider = serviceContainer.get<IJupyterServerProvider>(IJupyterServerProvider);
            this.jupyterServer = await provider.start();
        } catch (err) {
            throw err;
        } finally {
            if (status) {
                status.dispose();
            }
        }
    }

    private loadWebPanel = async (serviceContainer: IServiceContainer) : Promise<void> => {
        // Create our web panel (it's the UI that shows up for the history)
        const provider = serviceContainer.get<IWebPanelProvider>(IWebPanelProvider);

        // Figure out the name of our main bundle. Should be in our output directory
        const mainScriptPath = path.join(__dirname, 'history-react', 'index_bundle.js');

        // Generate a css to put into the webpanel for viewing code
        const codeCssGenerator = new CodeCssGenerator(serviceContainer);
        const css = await codeCssGenerator.generateThemeCss();

        // Use this script to create our web view panel. It should contain all of the necessary
        // script to communicate with this class.
        this.webPanel = provider.create(this, localize.DataScience.historyTitle(), mainScriptPath, css);
    }

    private load = (serviceContainer: IServiceContainer) : Promise<[void, void]> => {
        return Promise.all([
            this.loadWebPanel(serviceContainer),
            this.loadJupyterServer(serviceContainer)
        ]);
    }
}
