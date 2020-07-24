import type { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationToken, Event, EventEmitter, Memento, Uri } from 'vscode';
import { createCodeCell } from '../../../datascience-ui/common/cellFactory';
import { traceError } from '../../common/logger';
import { isFileNotFoundError } from '../../common/platform/errors';

import { GLOBAL_MEMENTO, ICryptoUtils, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { isUntitledFile, noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { Identifiers, KnownNotebookLanguages, Telemetry } from '../constants';
import { InvalidNotebookFileError } from '../jupyter/invalidNotebookFileError';
import { INotebookModelFactory } from '../notebookStorage/types';
import {
    CellState,
    IDataScienceFileSystem,
    IJupyterExecution,
    INotebookModel,
    INotebookStorage,
    ITrustService
} from '../types';

// tslint:disable-next-line:no-require-imports no-var-requires
import detectIndent = require('detect-indent');

const KeyPrefix = 'notebook-storage-';
const NotebookTransferKey = 'notebook-transfered';

export function isUntitled(model?: INotebookModel): boolean {
    return isUntitledFile(model?.file);
}

export function getNextUntitledCounter(file: Uri | undefined, currentValue: number): number {
    if (file && isUntitledFile(file)) {
        const basename = path.basename(file.fsPath, 'ipynb');
        const extname = path.extname(file.fsPath);
        if (extname.toLowerCase() === '.ipynb') {
            // See if ends with -<n>
            const match = /.*-(\d+)/.exec(basename);
            if (match && match[1]) {
                const fileValue = parseInt(match[1], 10);
                if (fileValue) {
                    return Math.max(currentValue, fileValue + 1);
                }
            }
        }
    }

    return currentValue;
}

@injectable()
export class NativeEditorStorage implements INotebookStorage {
    public get onSavedAs(): Event<{ new: Uri; old: Uri }> {
        return this.savedAs.event;
    }
    private readonly savedAs = new EventEmitter<{ new: Uri; old: Uri }>();

    // Keep track of if we are backing up our file already
    private backingUp = false;
    // If backup requests come in while we are already backing up save the most recent one here
    private backupRequested: { model: INotebookModel; cancellation: CancellationToken } | undefined;

    constructor(
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IDataScienceFileSystem) private fs: IDataScienceFileSystem,
        @inject(ICryptoUtils) private crypto: ICryptoUtils,
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalStorage: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private localStorage: Memento,
        @inject(ITrustService) private trustService: ITrustService,
        @inject(INotebookModelFactory) private readonly factory: INotebookModelFactory
    ) {}
    private static isUntitledFile(file: Uri) {
        return isUntitledFile(file);
    }

    public generateBackupId(model: INotebookModel): string {
        return `${path.basename(model.file.fsPath)}-${uuid()}`;
    }

    public get(
        file: Uri,
        possibleContents?: string,
        backupId?: string,
        forVSCodeNotebook?: boolean
    ): Promise<INotebookModel>;
    public get(
        file: Uri,
        possibleContents?: string,
        // tslint:disable-next-line: unified-signatures
        skipDirtyContents?: boolean,
        forVSCodeNotebook?: boolean
    ): Promise<INotebookModel>;
    public get(
        file: Uri,
        possibleContents?: string,
        // tslint:disable-next-line: no-any
        options?: any,
        forVSCodeNotebook?: boolean
    ): Promise<INotebookModel> {
        return this.loadFromFile(file, possibleContents, options, forVSCodeNotebook);
    }
    public async save(model: INotebookModel, _cancellation: CancellationToken): Promise<void> {
        const contents = model.getContent();
        const parallelize = [this.fs.writeFile(model.file, contents)];
        if (model.isTrusted) {
            parallelize.push(this.trustService.trustNotebook(model.file, contents));
        }
        await Promise.all(parallelize);
        model.update({
            source: 'user',
            kind: 'save',
            oldDirty: model.isDirty,
            newDirty: false
        });
    }

    public async saveAs(model: INotebookModel, file: Uri): Promise<void> {
        const old = model.file;
        const contents = model.getContent();
        const parallelize = [this.fs.writeFile(file, contents)];
        if (model.isTrusted) {
            parallelize.push(this.trustService.trustNotebook(file, contents));
        }
        await Promise.all(parallelize);
        model.update({
            source: 'user',
            kind: 'saveAs',
            oldDirty: model.isDirty,
            newDirty: false,
            target: file,
            sourceUri: model.file
        });
        this.savedAs.fire({ new: file, old });
    }
    public async backup(model: INotebookModel, cancellation: CancellationToken, backupId?: string): Promise<void> {
        // If we are already backing up, save this request replacing any other previous requests
        if (this.backingUp) {
            this.backupRequested = { model, cancellation };
            return;
        }
        this.backingUp = true;
        // Should send to extension context storage path
        return this.storeContentsInHotExitFile(model, cancellation, backupId).finally(() => {
            this.backingUp = false;

            // If there is a backup request waiting, then clear and start it
            if (this.backupRequested) {
                const requested = this.backupRequested;
                this.backupRequested = undefined;
                this.backup(requested.model, requested.cancellation).catch((error) => {
                    traceError(`Error in backing up NativeEditor Storage: ${error}`);
                });
            }
        });
    }

    public async revert(model: INotebookModel, _cancellation: CancellationToken): Promise<void> {
        // Revert to what is in the hot exit file
        await this.loadFromFile(model.file);
    }

    public async deleteBackup(model: INotebookModel, backupId: string): Promise<void> {
        return this.clearHotExit(model.file, backupId);
    }
    /**
     * Stores the uncommitted notebook changes into a temporary location.
     * Also keep track of the current time. This way we can check whether changes were
     * made to the file since the last time uncommitted changes were stored.
     */
    private async storeContentsInHotExitFile(
        model: INotebookModel,
        cancelToken?: CancellationToken,
        backupId?: string
    ): Promise<void> {
        const contents = model.getContent();
        const key = backupId || this.getStaticStorageKey(model.file);
        const filePath = this.getHashedFileName(key);

        // Keep track of the time when this data was saved.
        // This way when we retrieve the data we can compare it against last modified date of the file.
        const specialContents = contents ? JSON.stringify({ contents, lastModifiedTimeMs: Date.now() }) : undefined;
        return this.writeToStorage(filePath, specialContents, cancelToken);
    }

    private async clearHotExit(file: Uri, backupId?: string): Promise<void> {
        const key = backupId || this.getStaticStorageKey(file);
        const filePath = this.getHashedFileName(key);
        await this.writeToStorage(filePath, undefined);
    }

    private async writeToStorage(filePath: string, contents?: string, cancelToken?: CancellationToken): Promise<void> {
        try {
            if (!cancelToken?.isCancellationRequested) {
                if (contents) {
                    await this.fs.createLocalDirectory(path.dirname(filePath));
                    if (!cancelToken?.isCancellationRequested) {
                        await this.fs.writeLocalFile(filePath, contents);
                    }
                } else {
                    await this.fs.deleteLocalFile(filePath).catch((ex) => {
                        // No need to log error if file doesn't exist.
                        if (!isFileNotFoundError(ex)) {
                            traceError('Failed to delete hotExit file. Possible it does not exist', ex);
                        }
                    });
                }
            }
        } catch (exc) {
            traceError(`Error writing storage for ${filePath}: `, exc);
        }
    }
    private async extractPythonMainVersion(notebookData: Partial<nbformat.INotebookContent>): Promise<number> {
        if (
            notebookData &&
            notebookData.metadata &&
            notebookData.metadata.language_info &&
            notebookData.metadata.language_info.codemirror_mode &&
            // tslint:disable-next-line: no-any
            typeof (notebookData.metadata.language_info.codemirror_mode as any).version === 'number'
        ) {
            // tslint:disable-next-line: no-any
            return (notebookData.metadata.language_info.codemirror_mode as any).version;
        }
        // Use the active interpreter
        const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
        return usableInterpreter && usableInterpreter.version ? usableInterpreter.version.major : 3;
    }

    private sendLanguageTelemetry(notebookJson: Partial<nbformat.INotebookContent>) {
        try {
            // See if we have a language
            let language = '';
            if (notebookJson.metadata?.language_info?.name) {
                language = notebookJson.metadata?.language_info?.name;
            } else if (notebookJson.metadata?.kernelspec?.language) {
                language = notebookJson.metadata?.kernelspec?.language.toString();
            }
            if (language && !KnownNotebookLanguages.includes(language.toLowerCase())) {
                language = 'unknown';
            }
            if (language) {
                sendTelemetryEvent(Telemetry.NotebookLanguage, undefined, { language });
            }
        } catch {
            // If this fails, doesn't really matter
            noop();
        }
    }
    private loadFromFile(
        file: Uri,
        possibleContents?: string,
        backupId?: string,
        forVSCodeNotebook?: boolean
    ): Promise<INotebookModel>;
    private loadFromFile(
        file: Uri,
        possibleContents?: string,
        // tslint:disable-next-line: unified-signatures
        skipDirtyContents?: boolean,
        forVSCodeNotebook?: boolean
    ): Promise<INotebookModel>;
    private async loadFromFile(
        file: Uri,
        possibleContents?: string,
        options?: boolean | string,
        forVSCodeNotebook?: boolean
    ): Promise<INotebookModel> {
        try {
            // Attempt to read the contents if a viable file
            const contents = NativeEditorStorage.isUntitledFile(file) ? possibleContents : await this.fs.readFile(file);

            const skipDirtyContents = typeof options === 'boolean' ? options : !!options;
            // Use backupId provided, else use static storage key.
            const backupId =
                typeof options === 'string' ? options : skipDirtyContents ? undefined : this.getStaticStorageKey(file);

            // If skipping dirty contents, delete the dirty hot exit file now
            if (skipDirtyContents) {
                await this.clearHotExit(file, backupId);
            }

            // See if this file was stored in storage prior to shutdown
            const dirtyContents = skipDirtyContents ? undefined : await this.getStoredContents(file, backupId);
            if (dirtyContents) {
                // This means we're dirty. Indicate dirty and load from this content
                return this.loadContents(file, dirtyContents, true, forVSCodeNotebook);
            } else {
                // Load without setting dirty
                return this.loadContents(file, contents, undefined, forVSCodeNotebook);
            }
        } catch (ex) {
            // May not exist at this time. Should always have a single cell though
            traceError(`Failed to load notebook file ${file.toString()}`, ex);
            return this.factory.createModel(
                { trusted: true, file, cells: [], crypto: this.crypto, globalMemento: this.globalStorage },
                forVSCodeNotebook
            );
        }
    }

    private createEmptyCell(id: string) {
        return {
            id,
            line: 0,
            file: Identifiers.EmptyFileName,
            state: CellState.finished,
            data: createCodeCell()
        };
    }

    private async loadContents(
        file: Uri,
        contents: string | undefined,
        isInitiallyDirty = false,
        forVSCodeNotebook?: boolean
    ) {
        // tslint:disable-next-line: no-any
        const json = contents ? (JSON.parse(contents) as Partial<nbformat.INotebookContent>) : undefined;

        // Double check json (if we have any)
        if (json && !json.cells) {
            throw new InvalidNotebookFileError(file.fsPath);
        }

        // Then compute indent. It's computed from the contents
        const indentAmount = contents ? detectIndent(contents).indent : undefined;

        // Then save the contents. We'll stick our cells back into this format when we save
        if (json) {
            // Log language or kernel telemetry
            this.sendLanguageTelemetry(json);
        }

        // Extract cells from the json
        const cells = json ? (json.cells as (nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell)[]) : [];

        // Remap the ids
        const remapped = cells.map((c, index) => {
            return {
                id: `NotebookImport#${index}`,
                file: Identifiers.EmptyFileName,
                line: 0,
                state: CellState.finished,
                data: c
            };
        });

        // Make sure at least one
        if (remapped.length === 0) {
            remapped.splice(0, 0, this.createEmptyCell(uuid()));
        }
        const pythonNumber = json ? await this.extractPythonMainVersion(json) : 3;

        const model = this.factory.createModel(
            {
                trusted: true,
                file,
                cells: remapped,
                notebookJson: json,
                indentAmount,
                pythonNumber,
                initiallyDirty: isInitiallyDirty,
                crypto: this.crypto,
                globalMemento: this.globalStorage
            },
            forVSCodeNotebook
        );

        // If no contents or untitled, this is a newly created file
        // If dirty, that means it's been edited before in our extension
        if (contents !== undefined && !isUntitledFile(file) && !isInitiallyDirty) {
            const isNotebookTrusted = await this.trustService.isNotebookTrusted(file, model.getContent());
            if (isNotebookTrusted !== model.isTrusted) {
                model.update({
                    source: 'user',
                    kind: 'updateTrust',
                    oldDirty: model.isDirty,
                    newDirty: model.isDirty,
                    isNotebookTrusted
                });
            }
        }

        return model;
    }

    private getStaticStorageKey(file: Uri): string {
        return `${KeyPrefix}${file.toString()}`;
    }

    /**
     * Gets any unsaved changes to the notebook file from the old locations.
     * If the file has been modified since the uncommitted changes were stored, then ignore the uncommitted changes.
     *
     * @private
     * @returns {(Promise<string | undefined>)}
     * @memberof NativeEditor
     */
    private async getStoredContents(file: Uri, backupId?: string): Promise<string | undefined> {
        const key = backupId || this.getStaticStorageKey(file);

        // First look in the global storage file location
        let result = await this.getStoredContentsFromFile(file, key);
        if (!result) {
            result = await this.getStoredContentsFromGlobalStorage(file, key);
            if (!result) {
                result = await this.getStoredContentsFromLocalStorage(file, key);
            }
        }

        return result;
    }

    private async getStoredContentsFromFile(file: Uri, key: string): Promise<string | undefined> {
        try {
            // Use this to read from the extension global location
            const contents = await this.fs.readLocalFile(file.fsPath);
            const data = JSON.parse(contents);
            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && file.scheme === 'file') {
                const stat = await this.fs.stat(file);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && data.contents) {
                return data.contents;
            }
        } catch (exc) {
            // No need to log error if file doesn't exist.
            if (!isFileNotFoundError(exc)) {
                traceError(`Exception reading from temporary storage for ${key}`, exc);
            }
        }
    }

    private async getStoredContentsFromGlobalStorage(file: Uri, key: string): Promise<string | undefined> {
        try {
            const data = this.globalStorage.get<{ contents?: string; lastModifiedTimeMs?: number }>(key);

            // If we have data here, make sure we eliminate any remnants of storage
            if (data) {
                await this.transferStorage();
            }

            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && file.scheme === 'file') {
                const stat = await this.fs.stat(file);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && data.contents) {
                return data.contents;
            }
        } catch {
            noop();
        }
    }

    private async getStoredContentsFromLocalStorage(_file: Uri, key: string): Promise<string | undefined> {
        const workspaceData = this.localStorage.get<string>(key);
        if (workspaceData) {
            // Make sure to clear so we don't use this again.
            this.localStorage.update(key, undefined);

            return workspaceData;
        }
    }

    // VS code recommended we use the hidden '_values' to iterate over all of the entries in
    // the global storage map and delete the ones we own.
    private async transferStorage(): Promise<void[]> {
        const promises: Thenable<void>[] = [];

        // Indicate we ran this function
        await this.globalStorage.update(NotebookTransferKey, true);

        try {
            // tslint:disable-next-line: no-any
            if ((this.globalStorage as any)._value) {
                // tslint:disable-next-line: no-any
                const keys = Object.keys((this.globalStorage as any)._value);
                [...keys].forEach((k: string) => {
                    if (k.startsWith(KeyPrefix)) {
                        // Remove from the map so that global storage does not have this anymore.
                        // Use the real API here as we don't know how the map really gets updated.
                        promises.push(this.globalStorage.update(k, undefined));
                    }
                });
            }
        } catch (e) {
            traceError('Exception eliminating global storage parts:', e);
        }

        return Promise.all(promises);
    }

    private getHashedFileName(key: string): string {
        const file = `${this.crypto.createHash(key, 'string')}.ipynb`;
        return path.join(this.context.globalStoragePath, file);
    }
}
