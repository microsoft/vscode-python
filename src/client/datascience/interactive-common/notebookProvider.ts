// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import {
    IInteractiveWindowProvider,
    INotebook,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookServer
} from '../types';

export interface INotebookProvider {
    /**
     * Gets or creates a notebook, and manages the lifetime of notebooks.
     */
    getNotebook(server: INotebookServer, resource: Uri, options?: nbformat.INotebookMetadata): Promise<INotebook>;
}

@injectable()
export class BaseNotebookProvider implements INotebookProvider {
    protected readonly notebooks = new Map<string, Promise<INotebook>>();
    public async getNotebook(
        server: INotebookServer,
        resource: Uri,
        metadata?: nbformat.INotebookMetadata | undefined
    ): Promise<INotebook> {
        // We could have multiple native editors opened for the same file/model.
        const notebook = await server.getNotebook(resource);
        if (notebook) {
            return notebook;
        }

        if (this.notebooks.get(resource.fsPath)) {
            return this.notebooks.get(resource.fsPath)!!;
        }

        const promise = server.createNotebook(resource, resource, metadata);
        this.notebooks.set(resource.fsPath, promise);

        // Remove promise from cache if the same promise still exists.
        const removeFromCache = () => {
            const cachedPromise = this.notebooks.get(resource.fsPath);
            if (cachedPromise === promise) {
                this.notebooks.delete(resource.fsPath);
            }
        };

        // If the notebook is disposed, remove from cache.
        promise.then(nb => nb.onDisposed(removeFromCache)).catch(noop);

        // If promise fails, then remove the promise from cache.
        promise.catch(removeFromCache);

        return promise;
    }
    protected async disposeNotebook(resource: Uri) {
        // First find all notebooks associated with this editor (ipynb file).
        const notebookPromise = this.notebooks.get(resource.fsPath);
        if (!notebookPromise) {
            // Possible it was closed before a notebook could be created.
            return;
        }
        const notebook = await notebookPromise.catch(noop);
        if (!notebook) {
            return;
        }

        await notebook.dispose().catch(noop);
    }
}

@injectable()
export class InteractiveWindowNotebookovider extends BaseNotebookProvider {
    constructor(
        @inject(IInteractiveWindowProvider) private readonly interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        super();
        disposables.push(
            interactiveWindowProvider.onDidChangeActiveInteractiveWindow(this.checkAndDisposeNotebook, this)
        );
    }

    /**
     * Interactive windows have just one window.
     * When that it closed, just close all of the notebooks associated with interactive windows.
     */
    protected checkAndDisposeNotebook() {
        if (this.interactiveWindowProvider.getActive()) {
            return;
        }

        Array.from(this.notebooks.values()).forEach(promise => {
            promise.then(notebook => notebook.dispose()).catch(noop);
        });

        this.notebooks.clear();
    }
}

@injectable()
export class NativeNotebookovider extends BaseNotebookProvider {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        super();
        disposables.push(editorProvider.onDidCloseNotebookEditor(this.onDidCloseNotebookEditor, this));
    }

    protected async onDidCloseNotebookEditor(editor: INotebookEditor) {
        // First find all notebooks associated with this editor (ipynb file).
        const editors = this.editorProvider.editors.filter(
            e => this.fs.arePathsSame(e.file.fsPath, editor.file.fsPath) && e !== editor
        );

        // If we have no editors for this file, then dispose the notebook.
        if (editors.length === 0) {
            await super.disposeNotebook(editor.file);
        }
    }
}
