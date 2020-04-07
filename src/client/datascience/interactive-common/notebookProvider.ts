// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { EventEmitter, Uri } from 'vscode';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import {
    ConnectNotebookProviderOptions,
    GetNotebookOptions,
    IInteractiveWindowProvider,
    INotebook,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookProvider,
    INotebookProviderConnection,
    INotebookServerProvider,
    IRawNotebookProvider
} from '../types';

@injectable()
export class NotebookProvider implements INotebookProvider {
    private readonly notebooks = new Map<string, Promise<INotebook>>();
    private _notebookCreated = new EventEmitter<{ identity: Uri; notebook: INotebook }>();
    public get activeNotebooks() {
        return [...this.notebooks.values()];
    }
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private readonly interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(INotebookServerProvider) private readonly serverProvider: INotebookServerProvider,
        @inject(IRawNotebookProvider) private readonly rawNotebookProvider: IRawNotebookProvider
    ) {
        disposables.push(editorProvider.onDidCloseNotebookEditor(this.onDidCloseNotebookEditor, this));
        disposables.push(
            interactiveWindowProvider.onDidChangeActiveInteractiveWindow(this.checkAndDisposeNotebook, this)
        );
    }
    public get onNotebookCreated() {
        return this._notebookCreated.event;
    }

    // Disconnect from the specified provider
    public async disconnect(options: ConnectNotebookProviderOptions): Promise<void> {
        const server = await this.serverProvider.getOrCreateServer(options);

        return server?.dispose();
    }

    // Attempt to connect to our server provider, and if we do, return the connection info
    public async connect(options: ConnectNotebookProviderOptions): Promise<INotebookProviderConnection | undefined> {
        // Connect to either a jupyter server or a stubbed out raw notebook "connection"
        if (await this.rawNotebookProvider.supported()) {
            return this.rawNotebookProvider.connect();
        } else {
            const server = await this.serverProvider.getOrCreateServer(options);
            return server?.getConnectionInfo();
        }
    }

    public async getOrCreateNotebook(options: GetNotebookOptions): Promise<INotebook | undefined> {
        if (await this.rawNotebookProvider.supported()) {
            // Check to see if our raw notebook provider already has this notebook
            const notebook = await this.rawNotebookProvider.getNotebook(options.identity);
            if (notebook) {
                return notebook;
            }

            // Check our provider cache
            if (this.notebooks.get(options.identity.fsPath)) {
                return this.notebooks.get(options.identity.fsPath)!!;
            }
            const promise = this.rawNotebookProvider.createNotebook(
                options.identity,
                options.identity,
                options.metadata
            );

            this.cacheNotebookPromise(options.identity, promise);

            return promise;
        } else {
            // Jupyter server case
            // Make sure we have a server
            const server = await this.serverProvider.getOrCreateServer({
                getOnly: options.getOnly,
                disableUI: options.disableUI
            });
            if (server) {
                // We could have multiple native editors opened for the same file/model.
                const notebook = await server.getNotebook(options.identity);
                if (notebook) {
                    return notebook;
                }

                if (this.notebooks.get(options.identity.fsPath)) {
                    return this.notebooks.get(options.identity.fsPath)!!;
                }

                const promise = server.createNotebook(options.identity, options.identity, options.metadata);

                this.cacheNotebookPromise(options.identity, promise);

                return promise;
            }
        }
    }

    // Cache the promise that will return a notebook
    private cacheNotebookPromise(identity: Uri, promise: Promise<INotebook>) {
        this.notebooks.set(identity.fsPath, promise);

        // Remove promise from cache if the same promise still exists.
        const removeFromCache = () => {
            const cachedPromise = this.notebooks.get(identity.fsPath);
            if (cachedPromise === promise) {
                this.notebooks.delete(identity.fsPath);
            }
        };

        promise
            .then(nb => {
                // If the notebook is disposed, remove from cache.
                nb.onDisposed(removeFromCache);
                this._notebookCreated.fire({ identity: identity, notebook: nb });
            })
            .catch(noop);

        // If promise fails, then remove the promise from cache.
        promise.catch(removeFromCache);
    }

    private async onDidCloseNotebookEditor(editor: INotebookEditor) {
        // First find all notebooks associated with this editor (ipynb file).
        const editors = this.editorProvider.editors.filter(
            e => this.fs.arePathsSame(e.file.fsPath, editor.file.fsPath) && e !== editor
        );

        // If we have no editors for this file, then dispose the notebook.
        if (editors.length === 0) {
            await this.disposeNotebook(editor.file);
        }
    }

    /**
     * Interactive windows have just one window.
     * When that it closed, just close all of the notebooks associated with interactive windows.
     */
    private checkAndDisposeNotebook() {
        if (this.interactiveWindowProvider.getActive()) {
            return;
        }

        Array.from(this.notebooks.values()).forEach(promise => {
            promise.then(notebook => notebook.dispose()).catch(noop);
        });

        this.notebooks.clear();
    }

    private async disposeNotebook(resource: Uri) {
        // First find all notebooks associated with this editor (ipynb file).
        const notebookPromise = this.notebooks.get(resource.fsPath);
        if (!notebookPromise) {
            // Possible it was closed before a notebook could be created.
            return;
        }
        this.notebooks.delete(resource.fsPath);
        const notebook = await notebookPromise.catch(noop);
        if (!notebook) {
            return;
        }

        await notebook.dispose().catch(noop);
    }
}
