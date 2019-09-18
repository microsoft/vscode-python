// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IAsyncDisposable, IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import { INotebookEditor, INotebookEditorProvider, INotebookServerOptions } from '../types';

@injectable()
export class NativeEditorProvider implements INotebookEditorProvider, IAsyncDisposable {
    private activeEditors: Map<string, INotebookEditor> = new Map<string, INotebookEditor>();
    private executedEditors: Set<string> = new Set<string>();
    private notebookCount: number = 0;
    private openedNotebookCount: number = 0;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IConfigurationService) private configuration: IConfigurationService,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        asyncRegistry.push(this);

        // No live share sync required as open document from vscode will give us our contents.

        // Look through the file system for ipynb files to see how many we have in the workspace. Don't wait
        // on this though.
        const findFilesPromise = this.workspace.findFiles('**/*.ipynb');
        if (findFilesPromise && findFilesPromise.then) {
            findFilesPromise.then(r => this.notebookCount += r.length);
        }
    }

    public async dispose(): Promise<void> {
        // Send a bunch of telemetry
        sendTelemetryEvent(Telemetry.NotebookOpenCount, this.openedNotebookCount);
        sendTelemetryEvent(Telemetry.NotebookRunCount, this.executedEditors.size);
        sendTelemetryEvent(Telemetry.NotebookWorkspaceCount, this.notebookCount);

        // Try to save all of the currently dirty editors
        await Promise.all(this.editors.map(e => e.save()));
    }

    public get activeEditor(): INotebookEditor | undefined {
        const active = [...this.activeEditors.entries()].find(e => e[1].active);
        if (active) {
            return active[1];
        }
    }

    public get editors(): INotebookEditor[] {
        return [...this.activeEditors.values()];
    }

    public async open(file: Uri, contents: string): Promise<INotebookEditor> {
        // See if this file is open or not already
        let editor = this.activeEditors.get(file.fsPath);
        if (!editor) {
            editor = await this.create(file, contents);
            this.activeEditors.set(file.fsPath, editor);
            this.openedNotebookCount += 1;
        }
        return editor;
    }

    public async show(file: Uri): Promise<INotebookEditor | undefined> {
        // See if this file is open or not already
        const editor = this.activeEditors.get(file.fsPath);
        if (editor) {
            await editor.show();
        }
        return editor;
    }

    @captureTelemetry(Telemetry.CreateNewNotebook, undefined, false)
    public async createNew(): Promise<INotebookEditor> {
        // Create a new URI for the dummy file using our root workspace path
        const uri = await this.getNextNewNotebookUri();
        this.notebookCount += 1;
        return this.open(uri, '');
    }

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        const settings = this.configuration.getSettings();
        let serverURI: string | undefined = settings.datascience.jupyterServerURI;
        const useDefaultConfig: boolean | undefined = settings.datascience.useDefaultConfigForJupyter;

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;
        }

        return {
            enableDebugging: true,
            uri: serverURI,
            useDefaultConfig,
            purpose: Identifiers.HistoryPurpose  // Share the same one as the interactive window. Just need a new session
        };
    }

    private async create(file: Uri, contents: string): Promise<INotebookEditor> {
        const editor = this.serviceContainer.get<INotebookEditor>(INotebookEditor);
        await editor.load(contents, file);
        this.disposables.push(editor.closed(this.onClosedEditor.bind(this)));
        this.disposables.push(editor.executed(this.onExecutedEditor.bind(this)));
        await editor.show();
        return editor;
    }

    private onClosedEditor(e: INotebookEditor) {
        this.activeEditors.delete(e.file.fsPath);
    }

    private onExecutedEditor(e: INotebookEditor) {
        this.executedEditors.add(e.file.fsPath);
    }

    private async getNextNewNotebookUri(): Promise<Uri> {
        // Start in the root and look for files starting with untitled
        let number = 1;
        const dir = this.workspace.rootPath;
        if (dir) {
            const existing = await this.fileSystem.search(`${dir}/${localize.DataScience.untitledNotebookFileName()}-*.ipynb`);

            // Sort by number
            const sorted = existing.sort();

            // Add one onto the end of the last one
            if (sorted.length > 0) {
                const match = /(\w+)-(\d+)\.ipynb/.exec(path.basename(sorted[sorted.length - 1]));
                if (match && match.length > 1) {
                    number = parseInt(match[2], 10);
                }
            }
            return Uri.file(path.join(dir, `${localize.DataScience.untitledNotebookFileName()}-${number}`));
        }

        return Uri.file(`${localize.DataScience.untitledNotebookFileName()}-${number}`);
    }
}
