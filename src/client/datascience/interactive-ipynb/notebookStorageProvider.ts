// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { IWorkspaceService } from '../../common/application/types';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { INotebookModel, INotebookStorage } from '../types';
import { getNextUntitledCounter } from './nativeEditorStorage';

// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');

export const INotebookStorageProvider = Symbol.for('INotebookStorageProvider');
export interface INotebookStorageProvider extends INotebookStorage {
    createNew(contents?: string): Promise<INotebookModel>;
}
@injectable()
export class NotebookStorageProvider implements INotebookStorageProvider {
    public get onSavedAs() {
        return this._savedAs.event;
    }
    private static untitledCounter = 1;
    private readonly _savedAs = new EventEmitter<{ new: Uri; old: Uri }>();
    private readonly storageAndModels = new Map<string, Promise<INotebookModel>>();
    private models = new Set<INotebookModel>();
    private readonly disposables: IDisposable[] = [];
    private readonly _autoSaveNotebookInHotExitFile = new WeakMap<INotebookModel, Function>();
    constructor(
        @inject(INotebookStorage) private readonly storage: INotebookStorage,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {
        disposables.push(this);
        disposables.push(storage.onSavedAs((e) => this._savedAs.fire(e)));
    }
    public save(model: INotebookModel, cancellation: CancellationToken) {
        return this.storage.save(model, cancellation);
    }
    public async saveAs(model: INotebookModel, targetResource: Uri) {
        const oldUri = model.file;
        await this.storage.saveAs(model, targetResource);
        this.trackModel(model);
        this.storageAndModels.delete(oldUri.toString());
        this.storageAndModels.set(targetResource.toString(), Promise.resolve(model));
    }
    public backup(model: INotebookModel, cancellation: CancellationToken) {
        return this.storage.backup(model, cancellation);
    }
    public load(file: Uri, contents?: string | undefined, skipDirtyContents?: boolean): Promise<INotebookModel> {
        const key = file.toString();
        if (!this.storageAndModels.has(key)) {
            // Every time we load a new untitled file, up the counter past the max value for this counter
            NotebookStorageProvider.untitledCounter = getNextUntitledCounter(
                file,
                NotebookStorageProvider.untitledCounter
            );
            const promise = this.storage.load(file, contents, skipDirtyContents);
            this.storageAndModels.set(key, promise.then(this.trackModel.bind(this)));
        }
        return this.storageAndModels.get(key)!;
    }
    public dispose() {
        while (this.disposables.length) {
            this.disposables.shift()?.dispose(); // NOSONAR
        }
    }

    public async createNew(contents?: string): Promise<INotebookModel> {
        // Create a new URI for the dummy file using our root workspace path
        const uri = await this.getNextNewNotebookUri();

        // Always skip loading from the hot exit file. When creating a new file we want a new file.
        return this.load(uri, contents, true);
    }

    private async getNextNewNotebookUri(): Promise<Uri> {
        // Just use the current counter. Counter will be incremented after actually opening a file.
        const fileName = `${DataScience.untitledNotebookFileName()}-${NotebookStorageProvider.untitledCounter}.ipynb`;
        const fileUri = Uri.file(fileName);
        // Turn this back into an untitled
        return fileUri.with({ scheme: 'untitled', path: fileName });
    }

    private trackModel(model: INotebookModel): INotebookModel {
        this.disposables.push(model);
        this.models.add(model);
        // When a model is no longer used, ensure we remove it from the cache.
        model.onDidDispose(
            () => {
                this.models.delete(model);
                this.storageAndModels.delete(model.file.toString());
                this._autoSaveNotebookInHotExitFile.delete(model);
            },
            this,
            this.disposables
        );

        // Ensure we save into back for hotexit
        this.disposables.push(model.changed(this.modelChanged.bind(this, model)));
        return model;
    }

    private modelChanged(model: INotebookModel, e: NotebookModelChange) {
        const actualModel = e.model || model; // Test mocks can screw up bound values.
        if (actualModel) {
            let debounceFunc = this._autoSaveNotebookInHotExitFile.get(actualModel);
            if (!debounceFunc) {
                debounceFunc = debounce(this.autoSaveNotebookInHotExitFile.bind(this, actualModel), 250);
                this._autoSaveNotebookInHotExitFile.set(actualModel, debounceFunc);
            }
            debounceFunc();
        }
    }
    private autoSaveNotebookInHotExitFile(model: INotebookModel) {
        // Refetch settings each time as they can change before the debounce can happen
        const fileSettings = this.workspaceService.getConfiguration('files', model.file);
        // We need to backup, only if auto save if turned off and not an untitled file.
        if (fileSettings.get('autoSave', 'off') !== 'off' && !model.isUntitled) {
            return;
        }
        this.storage.backup(model, CancellationToken.None).ignoreErrors();
    }
}
