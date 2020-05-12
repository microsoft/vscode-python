// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry, Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import {
    ConnectNotebookProviderOptions,
    GetNotebookOptions,
    IInteractiveWindowProvider,
    IJupyterNotebookProvider,
    INotebook,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookProvider,
    INotebookProviderConnection,
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
        @inject(IRawNotebookProvider) private readonly rawNotebookProvider: IRawNotebookProvider,
        @inject(IJupyterNotebookProvider) private readonly jupyterNotebookProvider: IJupyterNotebookProvider,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
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
        // Only need to disconnect from actual jupyter servers
        if (!(await this.rawNotebookProvider.supported())) {
            return this.jupyterNotebookProvider.disconnect(options);
        }
    }

    // Attempt to connect to our server provider, and if we do, return the connection info
    public async connect(
        options: ConnectNotebookProviderOptions,
        token?: CancellationToken
    ): Promise<INotebookProviderConnection | undefined> {
        // Connect to either a jupyter server or a stubbed out raw notebook "connection"
        if (await this.rawNotebookProvider.supported()) {
            return this.rawNotebookProvider.connect(token);
        } else {
            return this.jupyterNotebookProvider.connect(options);
        }
    }

    public async getOrCreateNotebook(options: GetNotebookOptions): Promise<INotebook | undefined> {
        const rawKernel = await this.rawNotebookProvider.supported();

        // Check to see if our provider already has this notebook
        const notebook = rawKernel
            ? await this.rawNotebookProvider.getNotebook(options.identity, options.token)
            : await this.jupyterNotebookProvider.getNotebook(options);
        if (notebook) {
            return notebook;
        }

        // Next check our own promise cache
        if (this.notebooks.get(options.identity.fsPath)) {
            return this.notebooks.get(options.identity.fsPath)!!;
        }

        // We want to cache a Promise<INotebook> from the create functions
        // but jupyterNotebookProvider.createNotebook can be undefined if the server is not available
        // so check for our connection here first
        if (!rawKernel) {
            if (!(await this.jupyterNotebookProvider.connect(options))) {
                return undefined;
            }
        }

        // Finally create if needed
        let resource: Resource = options.identity;
        if (options.identity.scheme === Identifiers.HistoryPurpose) {
            // If we have any workspaces, then use the first available workspace.
            // This is required, else using `undefined` as a resource when we have worksapce folders is a different meaning.
            // This means interactive window doesn't properly support mult-root workspaces as we pick first workspace.
            // Ideally we need to pick the resource of the corresponding Python file.
            resource = this.workspaceService.hasWorkspaceFolders
                ? this.workspaceService.workspaceFolders![0]!.uri
                : undefined;
        }
        const promise = rawKernel
            ? this.rawNotebookProvider.createNotebook(
                  options.identity,
                  resource,
                  options.disableUI,
                  options.metadata,
                  options.token
              )
            : this.jupyterNotebookProvider.createNotebook(options);

        this.cacheNotebookPromise(options.identity, promise);

        return promise;
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
            .then((nb) => {
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
            (e) => this.fs.arePathsSame(e.file.fsPath, editor.file.fsPath) && e !== editor
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

        Array.from(this.notebooks.values()).forEach((promise) => {
            promise
                .then((notebook) => {
                    if (notebook.identity.scheme === 'history') {
                        notebook.dispose().ignoreErrors();
                    }
                })
                .catch(noop);
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
