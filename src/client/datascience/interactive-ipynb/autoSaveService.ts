// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Event, EventEmitter, TextEditor, Uri, WindowState } from 'vscode';
import { IApplicationShell, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';

import { IDisposable } from '../../common/types';
import { INotebookIdentity, InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import {
    FileSettings,
    IDataScienceFileSystem,
    IInteractiveWindowListener,
    INotebookEditor,
    INotebookEditorProvider,
    WebViewViewChangeEventArgs
} from '../types';

// tslint:disable: no-any

/**
 * Sends notifications to Notebooks to save the notebook.
 * Based on auto save settings, this class will regularly check for changes and send a save requet.
 * If window state changes or active editor changes, then notify notebooks (if auto save is configured to do so).
 * Monitor save and modified events on editor to determine its current dirty state.
 *
 * @export
 * @class AutoSaveService
 * @implements {IInteractiveWindowListener}
 */
@injectable()
export class AutoSaveService implements IInteractiveWindowListener {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        payload: any;
    }>();
    private disposables: IDisposable[] = [];
    private notebookUri?: Uri;
    private timeout?: ReturnType<typeof setTimeout>;
    private visible: boolean | undefined;
    private active: boolean | undefined;
    constructor(
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService
    ) {
        this.workspace.onDidChangeConfiguration(this.onSettingsChanded.bind(this), this, this.disposables);
        this.disposables.push(appShell.onDidChangeWindowState(this.onDidChangeWindowState.bind(this)));
        this.disposables.push(documentManager.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this)));
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onMessage(message: string, payload?: any): void {
        if (message === InteractiveWindowMessages.NotebookIdentity) {
            this.notebookUri = (payload as INotebookIdentity).resource;
        } else if (message === InteractiveWindowMessages.NotebookClose) {
            this.dispose();
        } else if (message === InteractiveWindowMessages.LoadAllCellsComplete) {
            const notebook = this.getNotebook();
            if (!notebook) {
                return;
            }
            this.disposables.push(notebook.modified(this.onNotebookModified, this, this.disposables));
            this.disposables.push(notebook.saved(this.onNotebookSaved, this, this.disposables));
        }
    }
    public onViewStateChanged(args: WebViewViewChangeEventArgs) {
        let changed = false;
        if (this.visible !== args.current.visible) {
            this.visible = args.current.visible;
            changed = true;
        }
        if (this.active !== args.current.active) {
            this.active = args.current.active;
            changed = true;
        }
        if (changed) {
            const settings = this.getAutoSaveSettings();
            if (settings && settings.autoSave === 'onFocusChange') {
                this.save();
            }
        }
    }
    public dispose(): void | undefined {
        this.disposables.filter((item) => !!item).forEach((item) => item.dispose());
        this.clearTimeout();
    }
    private onNotebookModified(_: INotebookEditor) {
        // If we haven't started a timer, then start if necessary.
        if (!this.timeout) {
            this.setTimer();
        }
    }
    private onNotebookSaved(_: INotebookEditor) {
        // If we haven't started a timer, then start if necessary.
        if (!this.timeout) {
            this.setTimer();
        }
    }
    private getNotebook(): INotebookEditor | undefined {
        const uri = this.notebookUri;
        if (!uri) {
            return;
        }
        return this.notebookEditorProvider.editors.find((item) =>
            this.fs.areLocalPathsSame(item.file.fsPath, uri.fsPath)
        );
    }
    private getAutoSaveSettings(): FileSettings {
        const filesConfig = this.workspace.getConfiguration('files', this.notebookUri);
        return {
            autoSave: filesConfig.get('autoSave', 'off'),
            autoSaveDelay: filesConfig.get('autoSaveDelay', 1000)
        };
    }
    private onSettingsChanded(e: ConfigurationChangeEvent) {
        if (
            e.affectsConfiguration('files.autoSave', this.notebookUri) ||
            e.affectsConfiguration('files.autoSaveDelay', this.notebookUri)
        ) {
            // Reset the timer, as we may have increased it, turned it off or other.
            this.clearTimeout();
            this.setTimer();
        }
    }
    private setTimer() {
        const settings = this.getAutoSaveSettings();
        if (!settings || settings.autoSave === 'off') {
            return;
        }
        if (settings && settings.autoSave === 'afterDelay') {
            // Add a timeout to save after n milli seconds.
            // Do not use setInterval, as that will cause all handlers to queue up.
            this.timeout = setTimeout(() => {
                this.save();
            }, settings.autoSaveDelay);
        }
    }
    private clearTimeout() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
    }
    private save() {
        this.clearTimeout();
        const notebook = this.getNotebook();
        if (notebook && notebook.isDirty && !notebook.isUntitled) {
            // Notify webview to perform a save.
            this.postEmitter.fire({ message: InteractiveWindowMessages.DoSave, payload: undefined });
        } else {
            this.setTimer();
        }
    }
    private onDidChangeWindowState(_state: WindowState) {
        const settings = this.getAutoSaveSettings();
        if (settings && (settings.autoSave === 'onWindowChange' || settings.autoSave === 'onFocusChange')) {
            this.save();
        }
    }
    private onDidChangeActiveTextEditor(_e?: TextEditor) {
        const settings = this.getAutoSaveSettings();
        if (settings && settings.autoSave === 'onFocusChange') {
            this.save();
        }
    }
}
