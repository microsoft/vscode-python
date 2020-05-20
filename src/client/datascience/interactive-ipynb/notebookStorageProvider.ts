// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, CancellationTokenSource, EventEmitter, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { INotebookModel, INotebookStorage } from '../types';
import { isUntitled } from './nativeEditorStorage';

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
    public load(file: Uri, contents?: string | undefined): Promise<INotebookModel> {
        const key = file.toString();
        if (!this.storageAndModels.has(key)) {
            const promise = this.storage.load(file, contents);
            promise.then(this.trackModel.bind(this)).catch(noop);
            this.storageAndModels.set(key, promise);
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
        return this.load(uri, contents);
    }

    private async getNextNewNotebookUri(): Promise<Uri> {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: This will not work, if we close an untitled document.
        // See if we have any untitled storage already
        const untitledStorage = Array.from(this.models.values()).filter(isUntitled);
        // Just use the length (don't bother trying to fill in holes). We never remove storage objects from
        // our map, so we'll keep creating new untitled notebooks.
        const fileName = `${DataScience.untitledNotebookFileName()}-${untitledStorage.length + 1}.ipynb`;
        const fileUri = Uri.file(fileName);
        // Turn this back into an untitled
        return fileUri.with({ scheme: 'untitled', path: fileName });
    }

    private trackModel(model: INotebookModel) {
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

        // Ensure we save into back for hotexit, if it is not an untitled file.
        if (!model.isUntitled) {
            const fileSettings = this.workspaceService.getConfiguration('files', model.file);
            const saveToHotExitDebounced = debounce(() => this.autoSaveNotebookInHotExitFile(model, fileSettings), 250);
            this._autoSaveNotebookInHotExitFile.set(model, saveToHotExitDebounced);
        }
        model.changed((e) => {
            const debouncedHotExitSave = this._autoSaveNotebookInHotExitFile.get(model);
            if (e.newDirty && debouncedHotExitSave) {
                debouncedHotExitSave();
            }
        });
    }
    private async autoSaveNotebookInHotExitFile(model: INotebookModel, filesConfig: WorkspaceConfiguration) {
        // We need to backup, only if auto save if turned off.
        if (filesConfig.get('autoSave', 'off') !== 'off') {
            return;
        }
        await this.storage.backup(model, new CancellationTokenSource().token);
    }
}
