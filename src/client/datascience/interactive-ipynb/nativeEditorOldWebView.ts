// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import * as path from 'path';
import { CancellationTokenSource, Memento, Uri, WebviewPanel } from 'vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { traceError } from '../../common/logger';

import {
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IExperimentsManager
} from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry } from '../../telemetry';
import { Commands, Telemetry } from '../constants';
import { IDataViewerFactory } from '../data-viewing/types';
import { InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import {
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataScienceFileSystem,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterVariableDataProviderFactory,
    IJupyterVariables,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    INotebookModel,
    INotebookProvider,
    IStatusProvider,
    IThemeFinder,
    ITrustService
} from '../types';
import { NativeEditor } from './nativeEditor';
import { NativeEditorSynchronizer } from './nativeEditorSynchronizer';

enum AskForSaveResult {
    Yes,
    No,
    Cancel
}

export class NativeEditorOldWebView extends NativeEditor {
    public readonly type = 'old';
    public get visible(): boolean {
        return this.viewState.visible;
    }
    public get active(): boolean {
        return this.viewState.active;
    }

    private isPromptingToSaveToDisc: boolean = false;

    constructor(
        listeners: IInteractiveWindowListener[],
        liveShare: ILiveShareApi,
        applicationShell: IApplicationShell,
        documentManager: IDocumentManager,
        provider: IWebPanelProvider,
        disposables: IDisposableRegistry,
        cssGenerator: ICodeCssGenerator,
        themeFinder: IThemeFinder,
        statusProvider: IStatusProvider,
        fs: IDataScienceFileSystem,
        configuration: IConfigurationService,
        commandManager: ICommandManager,
        jupyterExporter: INotebookExporter,
        workspaceService: IWorkspaceService,
        synchronizer: NativeEditorSynchronizer,
        editorProvider: INotebookEditorProvider,
        dataExplorerFactory: IDataViewerFactory,

        jupyterVariableDataProviderFactory: IJupyterVariableDataProviderFactory,
        jupyterVariables: IJupyterVariables,
        jupyterDebugger: IJupyterDebugger,
        importer: INotebookImporter,
        errorHandler: IDataScienceErrorHandler,
        globalStorage: Memento,
        workspaceStorage: Memento,
        experimentsManager: IExperimentsManager,
        asyncRegistry: IAsyncDisposableRegistry,
        notebookProvider: INotebookProvider,
        useCustomEditorApi: boolean,
        private readonly storage: INotebookStorageProvider,
        trustService: ITrustService,
        expService: IExperimentService,
        model: INotebookModel,
        webviewPanel: WebviewPanel | undefined,
        selector: KernelSelector
    ) {
        super(
            listeners,
            liveShare,
            applicationShell,
            documentManager,
            provider,
            disposables,
            cssGenerator,
            themeFinder,
            statusProvider,
            fs,
            configuration,
            commandManager,
            jupyterExporter,
            workspaceService,
            synchronizer,
            editorProvider,
            dataExplorerFactory,
            jupyterVariableDataProviderFactory,
            jupyterVariables,
            jupyterDebugger,
            importer,
            errorHandler,
            globalStorage,
            workspaceStorage,
            experimentsManager,
            asyncRegistry,
            notebookProvider,
            useCustomEditorApi,
            trustService,
            expService,
            model,
            webviewPanel,
            selector
        );
        asyncRegistry.push(this);
        // No ui syncing in old notebooks.
        synchronizer.disable();

        // Update our title to match
        this.setTitle(path.basename(model.file.fsPath));

        // Update dirty if model started out that way
        if (this.model?.isDirty) {
            this.setDirty().ignoreErrors();
        }

        this.model?.changed(() => {
            if (this.model?.isDirty) {
                this.setDirty().ignoreErrors();
            } else {
                this.setClean().ignoreErrors();
            }
        });
    }

    protected async close(): Promise<void> {
        // Ask user if they want to save. It seems hotExit has no bearing on
        // whether or not we should ask
        if (this.isDirty) {
            const askResult = await this.askForSave();
            switch (askResult) {
                case AskForSaveResult.Yes:
                    // Save the file
                    await this.saveToDisk();

                    // Close it
                    await super.close();
                    break;

                case AskForSaveResult.No:
                    // If there were changes, delete them
                    if (this.model) {
                        await this.storage.deleteBackup(this.model);
                    }
                    // Close it
                    await super.close();
                    break;

                default: {
                    await super.close();
                    await this.reopen();
                    break;
                }
            }
        } else {
            // Not dirty, just close normally.
            await super.close();
        }
    }

    protected saveAll() {
        this.saveToDisk().ignoreErrors();
    }

    /**
     * Used closed notebook with unsaved changes, then when prompted they clicked cancel.
     * Clicking cancel means we need to keep the nb open.
     * Hack is to re-open nb with old changes.
     */
    private async reopen(): Promise<void> {
        if (this.model) {
            // Skip doing this if auto save is enabled.
            const filesConfig = this.workspaceService.getConfiguration('files', this.file);
            const autoSave = filesConfig.get('autoSave', 'off');
            if (autoSave === 'off' || this.isUntitled) {
                await this.storage.backup(this.model, new CancellationTokenSource().token);
            }
            this.commandManager.executeCommand(Commands.OpenNotebookNonCustomEditor, this.model.file).then(noop, noop);
        }
    }

    private async askForSave(): Promise<AskForSaveResult> {
        const message1 = localize.DataScience.dirtyNotebookMessage1().format(`${path.basename(this.file.fsPath)}`);
        const message2 = localize.DataScience.dirtyNotebookMessage2();
        const yes = localize.DataScience.dirtyNotebookYes();
        const no = localize.DataScience.dirtyNotebookNo();
        const result = await this.applicationShell.showInformationMessage(
            // tslint:disable-next-line: messages-must-be-localized
            `${message1}\n${message2}`,
            { modal: true },
            yes,
            no
        );
        switch (result) {
            case yes:
                return AskForSaveResult.Yes;

            case no:
                return AskForSaveResult.No;

            default:
                return AskForSaveResult.Cancel;
        }
    }
    private async setDirty(): Promise<void> {
        // Then update dirty flag.
        if (this.isDirty) {
            this.setTitle(`${path.basename(this.file.fsPath)}*`);

            // Tell the webview we're dirty
            await this.postMessage(InteractiveWindowMessages.NotebookDirty);

            // Tell listeners we're dirty
            this.modifiedEvent.fire(this);
        }
    }

    private async setClean(): Promise<void> {
        if (!this.isDirty) {
            this.setTitle(`${path.basename(this.file.fsPath)}`);
            await this.postMessage(InteractiveWindowMessages.NotebookClean);
        }
    }

    @captureTelemetry(Telemetry.Save, undefined, true)
    private async saveToDisk(): Promise<void> {
        // If we're already in the middle of prompting the user to save, then get out of here.
        // We could add a debounce decorator, unfortunately that slows saving (by waiting for no more save events to get sent).
        if ((this.isPromptingToSaveToDisc && this.isUntitled) || !this.model) {
            return;
        }
        try {
            if (!this.isUntitled) {
                await this.commandManager.executeCommand(Commands.SaveNotebookNonCustomEditor, this.model?.file);
                this.savedEvent.fire(this);
                return;
            }
            // Ask user for a save as dialog if no title
            let fileToSaveTo: Uri | undefined = this.file;

            this.isPromptingToSaveToDisc = true;
            const filtersKey = localize.DataScience.dirtyNotebookDialogFilter();
            const filtersObject: { [name: string]: string[] } = {};
            filtersObject[filtersKey] = ['ipynb'];

            const defaultUri =
                Array.isArray(this.workspaceService.workspaceFolders) &&
                this.workspaceService.workspaceFolders.length > 0
                    ? this.workspaceService.workspaceFolders[0].uri
                    : undefined;
            fileToSaveTo = await this.applicationShell.showSaveDialog({
                saveLabel: localize.DataScience.dirtyNotebookDialogTitle(),
                filters: filtersObject,
                defaultUri
            });

            if (fileToSaveTo) {
                await this.commandManager.executeCommand(
                    Commands.SaveAsNotebookNonCustomEditor,
                    this.model.file,
                    fileToSaveTo
                );
                this.savedEvent.fire(this);
            }
        } catch (e) {
            traceError('Failed to Save nb', e);
        } finally {
            this.isPromptingToSaveToDisc = false;
        }
    }
}
