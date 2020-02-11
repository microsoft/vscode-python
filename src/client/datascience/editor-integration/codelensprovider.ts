// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';

import { ICommandManager, IDebugService, IDocumentManager } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDataScienceSettings, IDisposable, IDisposableRegistry } from '../../common/types';
import { StopWatch } from '../../common/utils/stopWatch';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { CodeLensCommands, EditorContexts, Telemetry } from '../constants';
import { ICodeWatcher, IDataScienceCodeLensProvider, IDebugLocationTracker } from '../types';

@injectable()
export class DataScienceCodeLensProvider implements IDataScienceCodeLensProvider, IDisposable {
    private totalExecutionTimeInMs: number = 0;
    private totalGetCodeLensCalls: number = 0;
    private activeCodeWatchers: ICodeWatcher[] = [];
    private didChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IDebugLocationTracker) private debugLocationTracker: IDebugLocationTracker,
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IDebugService) private debugService: IDebugService,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        disposableRegistry.push(this);
        disposableRegistry.push(this.debugService.onDidChangeActiveDebugSession(this.onChangeDebugSession.bind(this)));
        disposableRegistry.push(this.documentManager.onDidCloseTextDocument(this.onDidCloseTextDocument.bind(this)));
        disposableRegistry.push(this.debugLocationTracker.updated(this.onDebugLocationUpdated.bind(this)));
    }

    public dispose() {
        // On shutdown send how long on average we spent parsing code lens
        if (this.totalGetCodeLensCalls > 0) {
            sendTelemetryEvent(
                Telemetry.CodeLensAverageAcquisitionTime,
                this.totalExecutionTimeInMs / this.totalGetCodeLensCalls
            );
        }
    }

    public get onDidChangeCodeLenses(): vscode.Event<void> {
        return this.didChangeCodeLenses.event;
    }

    // CodeLensProvider interface
    // Some implementation based on DonJayamanne's jupyter extension work
    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[] {
        // Get the list of code lens for this document.
        return this.getCodeLensTimed(document);
    }

    // IDataScienceCodeLensProvider interface
    public getCodeWatcher(document: vscode.TextDocument): ICodeWatcher | undefined {
        return this.matchWatcher(document.fileName, document.version, this.configuration.getSettings().datascience);
    }

    private onDebugLocationUpdated() {
        this.didChangeCodeLenses.fire();
    }

    private onChangeDebugSession(_e: vscode.DebugSession | undefined) {
        this.didChangeCodeLenses.fire();
    }

    private onDidCloseTextDocument(e: vscode.TextDocument) {
        const index = this.activeCodeWatchers.findIndex(item => item.getFileName() === e.fileName);
        if (index >= 0) {
            this.activeCodeWatchers.splice(index, 1);
        }
    }

    private getCodeLensTimed(document: vscode.TextDocument): vscode.CodeLens[] {
        const stopWatch = new StopWatch();
        const result = this.getCodeLens(document);
        this.totalExecutionTimeInMs += stopWatch.elapsedTime;
        this.totalGetCodeLensCalls += 1;

        // Update the hasCodeCells context at the same time we are asked for codelens as VS code will
        // ask whenever a change occurs. Do this regardless of if we have code lens turned on or not as
        // shift+enter relies on this code context.
        const editorContext = new ContextKey(EditorContexts.HasCodeCells, this.commandManager);
        editorContext.set(result && result.length > 0).catch();

        // Don't provide any code lenses if we have not enabled data science
        const settings = this.configuration.getSettings();
        if (!settings.datascience.enabled || !settings.datascience.enableCellCodeLens) {
            // Clear out any existing code watchers, providecodelenses is called on settings change
            // so we don't need to watch the settings change specifically here
            if (this.activeCodeWatchers.length > 0) {
                this.activeCodeWatchers = [];
            }
            return [];
        }

        return this.adjustDebuggingLenses(document, result);
    }

    // Adjust what code lenses are visible or not given debug mode and debug context location
    private adjustDebuggingLenses(document: vscode.TextDocument, lenses: vscode.CodeLens[]): vscode.CodeLens[] {
        const debugCellList = CodeLensCommands.DebuggerCommands;

        if (this.debugService.activeDebugSession) {
            const debugLocation = this.debugLocationTracker.getLocation(this.debugService.activeDebugSession);

            if (debugLocation && this.fileSystem.arePathsSame(debugLocation.fileName, document.uri.fsPath)) {
                // We are in the given debug file, so only return the code lens that contains the given line
                const activeLenses = lenses.filter(lens => {
                    // -1 for difference between file system one based and debugger zero based
                    const pos = new vscode.Position(debugLocation.lineNumber - 1, debugLocation.column - 1);
                    return lens.range.contains(pos);
                });

                return activeLenses.filter(lens => {
                    if (lens.command) {
                        return debugCellList.includes(lens.command.command);
                    }
                    return false;
                });
            }
        } else {
            return lenses.filter(lens => {
                if (lens.command) {
                    return !debugCellList.includes(lens.command.command);
                }
                return false;
            });
        }

        // Fall through case to return nothing
        return [];
    }

    private getCodeLens(document: vscode.TextDocument): vscode.CodeLens[] {
        // See if we already have a watcher for this file and version
        const codeWatcher: ICodeWatcher | undefined = this.matchWatcher(
            document.fileName,
            document.version,
            this.configuration.getSettings().datascience
        );
        if (codeWatcher) {
            return codeWatcher.getCodeLenses();
        }

        // Create a new watcher for this file
        const newCodeWatcher = this.createNewCodeWatcher(document);
        return newCodeWatcher.getCodeLenses();
    }

    private matchWatcher(fileName: string, version: number, settings: IDataScienceSettings): ICodeWatcher | undefined {
        const index = this.activeCodeWatchers.findIndex(item => item.getFileName() === fileName);
        if (index >= 0) {
            const item = this.activeCodeWatchers[index];
            if (item.getVersion() === version) {
                // Also make sure the cached settings are the same. Otherwise these code lenses
                // were created with old settings
                const settingsStr = JSON.stringify(settings);
                const itemSettings = JSON.stringify(item.getCachedSettings());
                if (settingsStr === itemSettings) {
                    return item;
                }
            }
            // If we have an old version remove it from the active list
            this.activeCodeWatchers.splice(index, 1);
        }

        // Create a new watcher for this file if we can find a matching document
        const possibleDocuments = this.documentManager.textDocuments.filter(d => d.fileName === fileName);
        if (possibleDocuments && possibleDocuments.length > 0) {
            return this.createNewCodeWatcher(possibleDocuments[0]);
        }

        return undefined;
    }

    private createNewCodeWatcher(document: vscode.TextDocument): ICodeWatcher {
        const newCodeWatcher = this.serviceContainer.get<ICodeWatcher>(ICodeWatcher);
        newCodeWatcher.setDocument(document);
        newCodeWatcher.codeLensUpdated(this.onWatcherUpdated.bind(this));
        this.activeCodeWatchers.push(newCodeWatcher);
        return newCodeWatcher;
    }

    private onWatcherUpdated(): void {
        this.didChangeCodeLenses.fire();
    }
}
