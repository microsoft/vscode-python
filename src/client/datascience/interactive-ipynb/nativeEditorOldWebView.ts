// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import { Memento, Uri, WebviewPanel } from 'vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService,
} from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IMemento,
} from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry } from '../../telemetry';
import { Commands, Telemetry } from '../constants';
import { InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import {
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataViewerProvider,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterVariables,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    INotebookModel,
    INotebookProvider,
    IStatusProvider,
    IThemeFinder,
} from '../types';
import { NativeEditor } from './nativeEditor';
import { NativeEditorStorage } from './nativeEditorStorage';
import { NativeEditorSynchronizer } from './nativeEditorSynchronizer';

enum AskForSaveResult {
    Yes,
    No,
    Cancel,
}

@injectable()
export class NativeEditorOldWebView extends NativeEditor {
    public get visible(): boolean {
        return this.viewState.visible;
    }
    public get active(): boolean {
        return this.viewState.active;
    }

    private isPromptingToSaveToDisc: boolean = false;

    constructor(
        @multiInject(IInteractiveWindowListener) listeners: IInteractiveWindowListener[],
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IStatusProvider) statusProvider: IStatusProvider,
        @inject(IJupyterExecution) jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(INotebookExporter) jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(NativeEditorSynchronizer) synchronizer: NativeEditorSynchronizer,
        @inject(INotebookEditorProvider) editorProvider: INotebookEditorProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookImporter) importer: INotebookImporter,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalStorage: Memento,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(KernelSwitcher) switcher: KernelSwitcher,
        @inject(INotebookProvider) notebookProvider: INotebookProvider
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
            jupyterExecution,
            fileSystem,
            configuration,
            commandManager,
            jupyterExporter,
            workspaceService,
            synchronizer,
            editorProvider,
            dataExplorerProvider,
            jupyterVariables,
            jupyterDebugger,
            importer,
            errorHandler,
            globalStorage,
            experimentsManager,
            asyncRegistry,
            switcher,
            notebookProvider
        );
        asyncRegistry.push(this);
        // No ui syncing in old notebooks.
        synchronizer.disable();
    }
    public async load(model: INotebookModel, webViewPanel: WebviewPanel): Promise<void> {
        await super.load(model, webViewPanel);

        // Update our title to match
        this.setTitle(path.basename(model.file.fsPath));

        // Show ourselves
        await this.show();
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
            if (autoSave === 'off') {
                const model = this.model as NativeEditorStorage;
                await model.storeContentsInHotExitFile();
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
                defaultUri,
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
