// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { noop } from '../../common/utils/misc';
import { INotebook, INotebookProvider, INotebookServer } from '../types';

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
        this.notebooks.delete(resource.fsPath);
        const notebook = await notebookPromise.catch(noop);
        if (!notebook) {
            return;
        }

        await notebook.dispose().catch(noop);
    }
}
