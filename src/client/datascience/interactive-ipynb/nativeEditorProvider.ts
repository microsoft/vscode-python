// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';

import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IAsyncDisposable, IAsyncDisposableRegistry, IDisposableRegistry } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { INotebookEditor, INotebookEditorProvider } from '../types';

@injectable()
export class NativeEditorProvider implements INotebookEditorProvider, IAsyncDisposable {
    private activeEditors: Map<string, INotebookEditor> = new Map<string, INotebookEditor>();
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) {
        asyncRegistry.push(this);

        // No live share sync required as open document from vscode will give us our contents.
    }

    public dispose(): Promise<void> {
        return Promise.resolve();
    }

    public get activeEditor(): INotebookEditor | undefined {
        const active = [...this.activeEditors.entries()].find(e => e[1].active);
        if (active) {
            return active[1];
        }
    }

    public async open(file: Uri, contents: string): Promise<INotebookEditor> {
        // See if this file is open or not already
        let editor = this.activeEditors.get(file.fsPath);
        if (!editor) {
            editor = await this.create(file, contents);
            this.activeEditors.set(file.fsPath, editor);
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
        return this.open(uri, '');
    }

    private async create(file: Uri, contents: string): Promise<INotebookEditor> {
        const editor = this.serviceContainer.get<INotebookEditor>(INotebookEditor);
        await editor.load(contents, file);
        this.disposables.push(editor.closed(this.onClosedEditor.bind(this)));
        await editor.show();
        return editor;
    }

    private onClosedEditor(e: INotebookEditor) {
        this.activeEditors.delete(e.file.fsPath);
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
