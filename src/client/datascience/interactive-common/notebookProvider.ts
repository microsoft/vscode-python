// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { EventEmitter, Uri } from 'vscode';
import { ServerStatus } from '../../../datascience-ui/interactive-common/mainState';
import { IWorkspaceService } from '../../common/application/types';
import { IDisposableRegistry, Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { Identifiers } from '../constants';
import { KernelSpecInterpreter } from '../jupyter/kernels/kernelSelector';
import {
    ConnectNotebookProviderOptions,
    GetNotebookOptions,
    IJupyterNotebookProvider,
    INotebook,
    INotebookProvider,
    INotebookProviderConnection,
    IRawNotebookProvider
} from '../types';

@injectable()
export class NotebookProvider implements INotebookProvider {
    private readonly notebooks = new Map<string, Promise<INotebook>>();
    private _notebookCreated = new EventEmitter<{ identity: Uri; notebook: INotebook }>();
    private readonly _onSessionStatusChanged = new EventEmitter<{ status: ServerStatus; notebook: INotebook }>();
    private _connectionMade = new EventEmitter<void>();
    private _potentialKernelChanged = new EventEmitter<{ identity: Uri; kernel: KernelSpecInterpreter }>();
    private _type: 'jupyter' | 'raw' = 'jupyter';
    public get activeNotebooks() {
        return [...this.notebooks.values()];
    }
    public get onSessionStatusChanged() {
        return this._onSessionStatusChanged.event;
    }
    public get onPotentialKernelChanged() {
        return this._potentialKernelChanged.event;
    }
    constructor(
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IRawNotebookProvider) private readonly rawNotebookProvider: IRawNotebookProvider,
        @inject(IJupyterNotebookProvider) private readonly jupyterNotebookProvider: IJupyterNotebookProvider,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {
        this.rawNotebookProvider
            .supported()
            .then((b) => (this._type = b ? 'raw' : 'jupyter'))
            .ignoreErrors();
    }
    public get onNotebookCreated() {
        return this._notebookCreated.event;
    }

    public get onConnectionMade() {
        return this._connectionMade.event;
    }

    public get type(): 'jupyter' | 'raw' {
        return this._type;
    }

    // Disconnect from the specified provider
    public async disconnect(options: ConnectNotebookProviderOptions): Promise<void> {
        // Only need to disconnect from actual jupyter servers
        if (!(await this.rawNotebookProvider.supported())) {
            return this.jupyterNotebookProvider.disconnect(options);
        }
    }

    // Attempt to connect to our server provider, and if we do, return the connection info
    public async connect(options: ConnectNotebookProviderOptions): Promise<INotebookProviderConnection | undefined> {
        // Connect to either a jupyter server or a stubbed out raw notebook "connection"
        if (await this.rawNotebookProvider.supported()) {
            return this.rawNotebookProvider.connect({
                ...options,
                onConnectionMade: this.fireConnectionMade.bind(this)
            });
        } else {
            return this.jupyterNotebookProvider.connect({
                ...options,
                onConnectionMade: this.fireConnectionMade.bind(this)
            });
        }
    }

    public async getOrCreateNotebook(options: GetNotebookOptions): Promise<INotebook | undefined> {
        const rawKernel = await this.rawNotebookProvider.supported();

        // Check our own promise cache
        if (this.notebooks.get(options.identity.toString())) {
            return this.notebooks.get(options.identity.toString())!!;
        }

        // Check to see if our provider already has this notebook
        const notebook = rawKernel
            ? await this.rawNotebookProvider.getNotebook(options.identity, options.token)
            : await this.jupyterNotebookProvider.getNotebook(options);
        if (notebook) {
            this.cacheNotebookPromise(options.identity, Promise.resolve(notebook));
            return notebook;
        }

        // If get only, don't create a notebook
        if (options.getOnly) {
            return undefined;
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
        let resource: Resource = options.resource;
        if (options.identity.scheme === Identifiers.HistoryPurpose && !resource) {
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

    // This method is here so that the kernel selector can pick a kernel and not have
    // to know about any of the UI that's active.
    public firePotentialKernelChanged(identity: Uri, kernel: KernelSpecInterpreter) {
        this._potentialKernelChanged.fire({ identity, kernel });
    }

    private fireConnectionMade() {
        this._connectionMade.fire();
    }

    // Cache the promise that will return a notebook
    private cacheNotebookPromise(identity: Uri, promise: Promise<INotebook>) {
        this.notebooks.set(identity.toString(), promise);

        // Remove promise from cache if the same promise still exists.
        const removeFromCache = () => {
            const cachedPromise = this.notebooks.get(identity.toString());
            if (cachedPromise === promise) {
                this.notebooks.delete(identity.toString());
            }
        };

        promise
            .then((nb) => {
                // If the notebook is disposed, remove from cache.
                nb.onDisposed(removeFromCache);
                nb.onSessionStatusChanged(
                    (e) => this._onSessionStatusChanged.fire({ status: e, notebook: nb }),
                    this,
                    this.disposables
                );
                this._notebookCreated.fire({ identity: identity, notebook: nb });
            })
            .catch(noop);

        // If promise fails, then remove the promise from cache.
        promise.catch(removeFromCache);
    }
}
