// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';

import { ICommandManager, IDebugService, IDocumentManager } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { IConfigurationService, IDataScienceSettings, IDisposable, IDisposableRegistry } from '../../common/types';
import { StopWatch } from '../../common/utils/stopWatch';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EditorContexts, Telemetry } from '../constants';
import { ICodeWatcher, IDataScienceCodeLensProvider } from '../types';

@injectable()
export class DataScienceCodeLensProvider implements IDataScienceCodeLensProvider, IDisposable {
    private totalExecutionTimeInMs : number = 0;
    private totalGetCodeLensCalls : number = 0;
    private activeCodeWatchers: ICodeWatcher[] = [];
    private didChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
                @inject(IDocumentManager) private documentManager: IDocumentManager,
                @inject(IConfigurationService) private configuration: IConfigurationService,
                @inject(ICommandManager) private commandManager: ICommandManager,
                @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
                @inject(IDebugService) private debugService: IDebugService
        )
    {
        disposableRegistry.push(this);
        disposableRegistry.push(this.debugService.onDidChangeActiveDebugSession(this.onChangeDebugSession.bind(this)));

    }

    public dispose() {
        // On shutdown send how long on average we spent parsing code lens
        if (this.totalGetCodeLensCalls > 0) {
            sendTelemetryEvent(Telemetry.CodeLensAverageAcquisitionTime, this.totalExecutionTimeInMs / this.totalGetCodeLensCalls);
        }
    }

    public get onDidChangeCodeLenses() : vscode.Event<void> {
        return this.didChangeCodeLenses.event;
    }

    // CodeLensProvider interface
    // Some implementation based on DonJayamanne's jupyter extension work
    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[] {
        // Get the list of code lens for this document.
        const result = this.getCodeLensTimed(document);

        // Update the hasCodeCells context at the same time we are asked for codelens as VS code will
        // ask whenever a change occurs.
        const editorContext = new ContextKey(EditorContexts.HasCodeCells, this.commandManager);
        editorContext.set(result && result.length > 0).catch();

        return result;
    }

    // IDataScienceCodeLensProvider interface
    public getCodeWatcher(document: vscode.TextDocument): ICodeWatcher | undefined {
        return this.matchWatcher(document.fileName, document.version, this.configuration.getSettings().datascience);
    }

    private onChangeDebugSession(_e: vscode.DebugSession | undefined) {
        this.didChangeCodeLenses.fire();
    }

    private getCodeLensTimed(document: vscode.TextDocument): vscode.CodeLens[] {
        const stopWatch = new StopWatch();
        const result = this.getCodeLens(document);
        this.totalExecutionTimeInMs += stopWatch.elapsedTime;
        this.totalGetCodeLensCalls += 1;
        return result;
    }

    private getCodeLens(document: vscode.TextDocument): vscode.CodeLens[] {
        // Don't provide any code lenses if we have not enabled data science
        const settings = this.configuration.getSettings();
        if (!settings.datascience.enabled || !settings.datascience.enableCellCodeLens || this.debugService.activeDebugSession) {
            // Clear out any existing code watchers, providecodelenses is called on settings change
            // so we don't need to watch the settings change specifically here
            if (this.activeCodeWatchers.length > 0) {
                this.activeCodeWatchers = [];
            }
            return [];
        }

        // See if we already have a watcher for this file and version
        const codeWatcher: ICodeWatcher | undefined = this.matchWatcher(document.fileName, document.version, this.configuration.getSettings().datascience);
        if (codeWatcher) {
            return codeWatcher.getCodeLenses();
        }

        // Create a new watcher for this file
        const newCodeWatcher = this.serviceContainer.get<ICodeWatcher>(ICodeWatcher);
        newCodeWatcher.setDocument(document);
        this.activeCodeWatchers.push(newCodeWatcher);
        return newCodeWatcher.getCodeLenses();
    }

    private matchWatcher(fileName: string, version: number, settings: IDataScienceSettings) : ICodeWatcher | undefined {
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
            const newCodeWatcher = this.serviceContainer.get<ICodeWatcher>(ICodeWatcher);
            newCodeWatcher.setDocument(possibleDocuments[0]);
            this.activeCodeWatchers.push(newCodeWatcher);
            return newCodeWatcher;
        }

        return undefined;
    }
}
