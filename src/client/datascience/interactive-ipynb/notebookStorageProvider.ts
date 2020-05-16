// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, CancellationTokenSource, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { INotebookModel, INotebookStorage } from '../types';

// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');

export const INotebookStorageProvider = Symbol.for('INotebookStorageProvider');
export interface INotebookStorageProvider extends INotebookStorage {}
@injectable()
export class NotebookStorageProvider implements INotebookStorageProvider {
    private readonly storageAndModels = new Map<string, Promise<INotebookModel>>();
    private readonly disposables: IDisposable[] = [];
    private readonly _autoSaveNotebookInHotExitFile = new WeakMap<INotebookModel, Function>();
    constructor(
        @inject(INotebookStorage) private readonly storage: INotebookStorage,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {
        disposables.push(this);
    }
    public save(model: INotebookModel, cancellation: CancellationToken) {
        return this.storage.save(model, cancellation);
    }
    public async saveAs(model: INotebookModel, targetResource: Uri) {
        await this.storage.saveAs(model, targetResource);
        this.trackModel(model);
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
    private trackModel(model: INotebookModel) {
        this.disposables.push(model);
        // When a model is no longer used, ensure we remove it from the cache.
        model.onDidDispose(
            () => {
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
