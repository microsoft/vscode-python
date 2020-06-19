import type { nbformat } from '@jupyterlab/coreutils';
import * as fastDeepEqual from 'fast-deep-equal';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationToken, Event, EventEmitter, Memento, Uri } from 'vscode';
import { concatMultilineStringInput, splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell } from '../../../datascience-ui/common/cellFactory';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { GLOBAL_MEMENTO, ICryptoUtils, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { isUntitledFile, noop } from '../../common/utils/misc';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { Identifiers, KnownNotebookLanguages, Telemetry } from '../constants';
import { IEditorContentChange, NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { InvalidNotebookFileError } from '../jupyter/invalidNotebookFileError';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { CellState, ICell, IJupyterExecution, IJupyterKernelSpec, INotebookModel, INotebookStorage } from '../types';

// tslint:disable-next-line:no-require-imports no-var-requires
import detectIndent = require('detect-indent');
import { UseVSCodeNotebookEditorApi } from '../../common/constants';
import { isFileNotFoundError } from '../../common/platform/errors';
import { sendTelemetryEvent } from '../../telemetry';
import { pruneCell } from '../common';

const KeyPrefix = 'notebook-storage-';
const NotebookTransferKey = 'notebook-transfered';
interface INativeEditorStorageState {
    file: Uri;
    cells: ICell[];
    changeCount: number;
    saveChangeCount: number;
    notebookJson: Partial<nbformat.INotebookContent>;
}

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

// Exported for test mocks
export class NativeEditorNotebookModel implements INotebookModel {
    public get onDidDispose() {
        return this._disposed.event;
    }
    public get isDisposed() {
        return this._isDisposed === true;
    }
    public get isDirty(): boolean {
        return this._state.changeCount !== this._state.saveChangeCount;
    }
    public get changed(): Event<NotebookModelChange> {
        return this._changedEmitter.event;
    }
    public get file(): Uri {
        return this._state.file;
    }

    public get isUntitled(): boolean {
        return isUntitled(this);
    }
    public get cells(): ICell[] {
        return this._state.cells;
    }
    public get onDidEdit(): Event<NotebookModelChange> {
        return this._editEventEmitter.event;
    }
    public get metadata(): nbformat.INotebookMetadata | undefined {
        return this._state.notebookJson.metadata;
    }
    public get id() {
        return this._id;
    }
    private _disposed = new EventEmitter<void>();
    private _isDisposed?: boolean;
    private _changedEmitter = new EventEmitter<NotebookModelChange>();
    private _editEventEmitter = new EventEmitter<NotebookModelChange>();
    private _state: INativeEditorStorageState = {
        file: Uri.file(''),
        changeCount: 0,
        saveChangeCount: 0,
        cells: [],
        notebookJson: {}
    };

    private _id = uuid();

    constructor(
        public useNativeEditorApi: boolean,
        file: Uri,
        cells: ICell[],
        json: Partial<nbformat.INotebookContent> = {},
        public readonly indentAmount: string = ' ',
        private readonly pythonNumber: number = 3,
        isInitiallyDirty: boolean = false
    ) {
        this._state.file = file;
        this._state.cells = cells;
        this._state.notebookJson = json;
        this.ensureNotebookJson();
        if (isInitiallyDirty) {
            // This means we're dirty. Indicate dirty and load from this content
            this._state.saveChangeCount = -1;
        }
    }
    // public static fromJson(json:nbformat.INotebookContent){

    // }
    public dispose() {
        this._isDisposed = true;
        this._disposed.fire();
    }
    public update(change: NotebookModelChange): void {
        this.handleModelChange(change);
    }

    public async applyEdits(edits: readonly NotebookModelChange[]): Promise<void> {
        edits.forEach((e) => this.update({ ...e, source: 'redo' }));
    }
    public async undoEdits(edits: readonly NotebookModelChange[]): Promise<void> {
        edits.forEach((e) => this.update({ ...e, source: 'undo' }));
    }

    public getContent(): string {
        return this.generateNotebookContent();
    }

    public handleModelChange(change: NotebookModelChange) {
        const oldDirty = this.isDirty;
        let changed = false;

        switch (change.source) {
            case 'redo':
            case 'user':
                changed = this.handleRedo(change);
                break;
            case 'undo':
                changed = this.handleUndo(change);
                break;
            default:
                break;
        }

        // Forward onto our listeners if necessary
        if (changed || this.isDirty !== oldDirty) {
            this._changedEmitter.fire({ ...change, newDirty: this.isDirty, oldDirty, model: this });
        }
        // Slightly different for the event we send to VS code. Skip version and file changes. Only send user events.
        if ((changed || this.isDirty !== oldDirty) && change.kind !== 'version' && change.source === 'user') {
            this._editEventEmitter.fire(change);
        }
    }

    private handleRedo(change: NotebookModelChange): boolean {
        let changed = false;
        switch (change.kind) {
            case 'clear':
                changed = this.clearOutputs();
                break;
            case 'edit':
                changed = this.editCell(change.forward, change.id);
                break;
            case 'insert':
                changed = this.insertCell(change.cell, change.index);
                break;
            case 'changeCellType':
                changed = this.changeCellType(change.cell);
                break;
            case 'modify':
                changed = this.modifyCells(change.newCells);
                break;
            case 'remove':
                changed = this.removeCell(change.cell);
                break;
            case 'remove_all':
                changed = this.removeAllCells(change.newCellId);
                break;
            case 'swap':
                changed = this.swapCells(change.firstCellId, change.secondCellId);
                break;
            case 'updateCellExecutionCount':
                changed = this.updateCellExecutionCount(change.cellId, change.executionCount);
                break;
            case 'version':
                changed = this.updateVersionInfo(change.interpreter, change.kernelSpec);
                break;
            case 'save':
                this._state.saveChangeCount = this._state.changeCount;
                // Trigger event.
                if (this.useNativeEditorApi) {
                    changed = true;
                }
                break;
            case 'saveAs':
                this._state.saveChangeCount = this._state.changeCount;
                this._state.changeCount = this._state.saveChangeCount = 0;
                this._state.file = change.target;
                // Trigger event.
                if (this.useNativeEditorApi) {
                    changed = true;
                }
                break;
            default:
                break;
        }

        // Dirty state comes from undo. At least VS code will track it that way. However
        // skip file changes as we don't forward those to VS code
        if (change.kind !== 'save' && change.kind !== 'saveAs') {
            this._state.changeCount += 1;
        }

        return changed;
    }

    private handleUndo(change: NotebookModelChange): boolean {
        let changed = false;
        switch (change.kind) {
            case 'clear':
                changed = !fastDeepEqual(this._state.cells, change.oldCells);
                this._state.cells = change.oldCells;
                break;
            case 'edit':
                this.editCell(change.reverse, change.id);
                changed = true;
                break;
            case 'changeCellType':
                this.changeCellType(change.cell);
                changed = true;
                break;
            case 'insert':
                changed = this.removeCell(change.cell);
                break;
            case 'modify':
                changed = this.modifyCells(change.oldCells);
                break;
            case 'remove':
                changed = this.insertCell(change.cell, change.index);
                break;
            case 'remove_all':
                this._state.cells = change.oldCells;
                changed = true;
                break;
            case 'swap':
                changed = this.swapCells(change.firstCellId, change.secondCellId);
                break;
            default:
                break;
        }

        // Dirty state comes from undo. At least VS code will track it that way.
        // Note unlike redo, 'file' and 'version' are not possible on undo as
        // we don't send them to VS code.
        this._state.changeCount -= 1;

        return changed;
    }

    private removeAllCells(newCellId: string) {
        this._state.cells = [];
        this._state.cells.push(this.createEmptyCell(newCellId));
        return true;
    }

    private applyCellContentChange(change: IEditorContentChange, id: string): boolean {
        const normalized = change.text.replace(/\r/g, '');

        // Figure out which cell we're editing.
        const index = this.cells.findIndex((c) => c.id === id);
        if (index >= 0) {
            // This is an actual edit.
            const contents = concatMultilineStringInput(this.cells[index].data.source);
            const before = contents.substr(0, change.rangeOffset);
            const after = contents.substr(change.rangeOffset + change.rangeLength);
            const newContents = `${before}${normalized}${after}`;
            if (contents !== newContents) {
                const newCell = {
                    ...this.cells[index],
                    data: { ...this.cells[index].data, source: splitMultilineString(newContents) }
                };
                this._state.cells[index] = this.asCell(newCell);
                return true;
            }
        }
        return false;
    }

    private editCell(changes: IEditorContentChange[], id: string): boolean {
        // Apply the changes to the visible cell list
        if (changes && changes.length) {
            return changes.map((c) => this.applyCellContentChange(c, id)).reduce((p, c) => p || c, false);
        }

        return false;
    }

    private swapCells(firstCellId: string, secondCellId: string) {
        const first = this.cells.findIndex((v) => v.id === firstCellId);
        const second = this.cells.findIndex((v) => v.id === secondCellId);
        if (first >= 0 && second >= 0 && first !== second) {
            const temp = { ...this.cells[first] };
            this._state.cells[first] = this.asCell(this.cells[second]);
            this._state.cells[second] = this.asCell(temp);
            return true;
        }
        return false;
    }

    private updateCellExecutionCount(cellId: string, executionCount?: number) {
        const index = this.cells.findIndex((v) => v.id === cellId);
        if (index >= 0) {
            this._state.cells[index].data.execution_count =
                typeof executionCount === 'number' && executionCount > 0 ? executionCount : null;
            return true;
        }
        return false;
    }

    private modifyCells(cells: ICell[]): boolean {
        // Update these cells in our list
        cells.forEach((c) => {
            const index = this.cells.findIndex((v) => v.id === c.id);
            this._state.cells[index] = this.asCell(c);
        });
        return true;
    }

    private changeCellType(cell: ICell): boolean {
        // Update the cell in our list.
        const index = this.cells.findIndex((v) => v.id === cell.id);
        this._state.cells[index] = this.asCell(cell);
        return true;
    }

    private removeCell(cell: ICell): boolean {
        const index = this.cells.findIndex((c) => c.id === cell.id);
        if (index >= 0) {
            this._state.cells.splice(index, 1);
            return true;
        }
        return false;
    }

    private clearOutputs(): boolean {
        if (this.useNativeEditorApi) {
            // Do not create new cells when using native editor.
            // We'll update the cells in place (cuz undo/redo is handled by VS Code).
            return true;
        }
        const newCells = this.cells.map((c) =>
            this.asCell({ ...c, data: { ...c.data, execution_count: null, outputs: [] } })
        );
        const result = !fastDeepEqual(newCells, this.cells);
        this._state.cells = newCells;
        return result;
    }

    private insertCell(cell: ICell, index: number): boolean {
        // Insert a cell into our visible list based on the index. They should be in sync
        this._state.cells.splice(index, 0, cell);
        return true;
    }

    // tslint:disable-next-line: cyclomatic-complexity
    private updateVersionInfo(
        interpreter: PythonInterpreter | undefined,
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined
    ): boolean {
        let changed = false;
        // Get our kernel_info and language_info from the current notebook
        if (
            interpreter &&
            interpreter.version &&
            this._state.notebookJson.metadata &&
            this._state.notebookJson.metadata.language_info &&
            this._state.notebookJson.metadata.language_info.version !== interpreter.version.raw
        ) {
            this._state.notebookJson.metadata.language_info.version = interpreter.version.raw;
            changed = true;
        }

        if (kernelSpec && this._state.notebookJson.metadata && !this._state.notebookJson.metadata.kernelspec) {
            // Add a new spec in this case
            this._state.notebookJson.metadata.kernelspec = {
                name: kernelSpec.name || kernelSpec.display_name || '',
                display_name: kernelSpec.display_name || kernelSpec.name || ''
            };
            changed = true;
        } else if (kernelSpec && this._state.notebookJson.metadata && this._state.notebookJson.metadata.kernelspec) {
            // Spec exists, just update name and display_name
            const name = kernelSpec.name || kernelSpec.display_name || '';
            const displayName = kernelSpec.display_name || kernelSpec.name || '';
            if (
                this._state.notebookJson.metadata.kernelspec.name !== name ||
                this._state.notebookJson.metadata.kernelspec.display_name !== displayName
            ) {
                changed = true;
                this._state.notebookJson.metadata.kernelspec.name = name;
                this._state.notebookJson.metadata.kernelspec.display_name = displayName;
            }
        }
        return changed;
    }

    // tslint:disable-next-line: no-any
    private asCell(cell: any): ICell {
        // Works around problems with setting a cell to another one in the nyc compiler.
        return cell as ICell;
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

    private ensureNotebookJson() {
        if (!this._state.notebookJson || !this._state.notebookJson.metadata) {
            // const pythonNumber = await this.extractPythonMainVersion(this._state.notebookJson);
            const pythonNumber = this.pythonNumber;
            // Use this to build our metadata object
            // Use these as the defaults unless we have been given some in the options.
            const metadata: nbformat.INotebookMetadata = {
                language_info: {
                    codemirror_mode: {
                        name: 'ipython',
                        version: pythonNumber
                    },
                    file_extension: '.py',
                    mimetype: 'text/x-python',
                    name: 'python',
                    nbconvert_exporter: 'python',
                    pygments_lexer: `ipython${pythonNumber}`,
                    version: pythonNumber
                },
                orig_nbformat: 2
            };

            // Default notebook data.
            this._state.notebookJson = {
                metadata: metadata,
                nbformat: 4,
                nbformat_minor: 2
            };
        }
    }

    private generateNotebookContent(): string {
        // Make sure we have some
        this.ensureNotebookJson();

        // Reuse our original json except for the cells.
        const json = {
            cells: this.cells.map((c) => pruneCell(c.data)),
            metadata: this._state.notebookJson.metadata,
            nbformat: this._state.notebookJson.nbformat,
            nbformat_minor: this._state.notebookJson.nbformat_minor
        };
        return JSON.stringify(json, null, this.indentAmount);
    }
}

/**
 * Marks a model as being used solely by VS Code Notebooks editor.
 * (this is required, because at the time of loading a notebook its not always possible to know what editor will use it).
 */
export function updateModelForUseWithVSCodeNotebook(model: INotebookModel) {
    if (!(model instanceof NativeEditorNotebookModel)) {
        throw new Error('Unsupported NotebookModel');
    }
    const rawModel = model as NativeEditorNotebookModel;
    rawModel.useNativeEditorApi = true;
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
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(ICryptoUtils) private crypto: ICryptoUtils,
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalStorage: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private localStorage: Memento,
        @inject(UseVSCodeNotebookEditorApi) private readonly useNativeEditorApi: boolean
    ) {}
    private static isUntitledFile(file: Uri) {
        return isUntitledFile(file);
    }

    public generateBackupId(model: INotebookModel): string {
        return `${path.basename(model.file.fsPath)}-${uuid()}`;
    }

    public load(file: Uri, possibleContents?: string, backupId?: string): Promise<INotebookModel>;
    // tslint:disable-next-line: unified-signatures
    public load(file: Uri, possibleContents?: string, skipDirtyContents?: boolean): Promise<INotebookModel>;
    // tslint:disable-next-line: no-any
    public load(file: Uri, possibleContents?: string, options?: any): Promise<INotebookModel> {
        return this.loadFromFile(file, possibleContents, options);
    }
    public async save(model: INotebookModel, _cancellation: CancellationToken): Promise<void> {
        const contents = model.getContent();
        await this.fileSystem.writeFile(model.file.fsPath, contents, 'utf-8');
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
        await this.fileSystem.writeFile(file.fsPath, contents, 'utf-8');
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
                    await this.fileSystem.createDirectory(path.dirname(filePath));
                    if (!cancelToken?.isCancellationRequested) {
                        await this.fileSystem.writeFile(filePath, contents);
                    }
                } else {
                    await this.fileSystem.deleteFile(filePath).catch((ex) => {
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
    private loadFromFile(file: Uri, possibleContents?: string, backupId?: string): Promise<INotebookModel>;
    // tslint:disable-next-line: unified-signatures
    private loadFromFile(file: Uri, possibleContents?: string, skipDirtyContents?: boolean): Promise<INotebookModel>;
    private async loadFromFile(
        file: Uri,
        possibleContents?: string,
        options?: boolean | string
    ): Promise<INotebookModel> {
        try {
            // Attempt to read the contents if a viable file
            const contents = NativeEditorStorage.isUntitledFile(file)
                ? possibleContents
                : await this.fileSystem.readFile(file.fsPath);

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
                return this.loadContents(file, dirtyContents, true);
            } else {
                // Load without setting dirty
                return this.loadContents(file, contents);
            }
        } catch (ex) {
            // May not exist at this time. Should always have a single cell though
            traceError(`Failed to load notebook file ${file.toString()}`, ex);
            return new NativeEditorNotebookModel(this.useNativeEditorApi, file, []);
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

    private async loadContents(file: Uri, contents: string | undefined, isInitiallyDirty = false) {
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
        return new NativeEditorNotebookModel(
            this.useNativeEditorApi,
            file,
            remapped,
            json,
            indentAmount,
            pythonNumber,
            isInitiallyDirty
        );
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
        const filePath = this.getHashedFileName(key);
        try {
            // Use this to read from the extension global location
            const contents = await this.fileSystem.readFile(filePath);
            const data = JSON.parse(contents);
            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && file.scheme === 'file') {
                const stat = await this.fileSystem.stat(file.fsPath);
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
                const stat = await this.fileSystem.stat(file.fsPath);
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
