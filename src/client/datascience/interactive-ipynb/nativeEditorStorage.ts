import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Memento, Uri } from 'vscode';
import { concatMultilineStringInput, splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell } from '../../../datascience-ui/common/cellFactory';
import { ICommandManager } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { GLOBAL_MEMENTO, ICryptoUtils, IDisposable, IDisposableRegistry, IExtensionContext, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { PythonInterpreter } from '../../interpreter/contracts';
import { Commands, Identifiers } from '../constants';
import { ICellContentChange, NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { InvalidNotebookFileError } from '../jupyter/invalidNotebookFileError';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { CellState, ICell, IJupyterExecution, IJupyterKernelSpec, INotebookModel, INotebookStorage } from '../types';

// tslint:disable-next-line:no-require-imports no-var-requires
import detectIndent = require('detect-indent');

const KeyPrefix = 'notebook-storage-';
const NotebookTransferKey = 'notebook-transfered';

interface INativeEditorStorageState {
    file: Uri;
    cells: ICell[];
    isDirty: boolean;
    notebookJson: Partial<nbformat.INotebookContent>;
}

@injectable()
export class NativeEditorStorage implements INotebookModel, INotebookStorage, IDisposable {
    public get isDirty(): boolean {
        return this._state.isDirty;
    }
    public get changed(): Event<NotebookModelChange> {
        return this._changedEmitter.event;
    }
    public get file(): Uri {
        return this._state.file;
    }

    public get isUntitled(): boolean {
        return this.file.scheme === 'untitled';
    }
    public get cells(): ICell[] {
        return this._state.cells;
    }
    private static signedUpForCommands = false;

    private static storageMap = new Map<string, NativeEditorStorage>();
    private _changedEmitter = new EventEmitter<NotebookModelChange>();
    private _state: INativeEditorStorageState = { file: Uri.file(''), isDirty: false, cells: [], notebookJson: {} };
    private _loadPromise: Promise<ICell[]> | undefined;
    private indentAmount: string = ' ';

    constructor(
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(ICryptoUtils) private crypto: ICryptoUtils,
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalStorage: Memento,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private localStorage: Memento,
        @inject(ICommandManager) cmdManager: ICommandManager
    ) {
        // Sign up for commands if this is the first storage created.
        if (!NativeEditorStorage.signedUpForCommands) {
            this.registerCommands(cmdManager, disposables);
        }
        disposables.push(this);
    }

    private static async getStorage(resource: Uri): Promise<NativeEditorStorage | undefined> {
        const storage = NativeEditorStorage.storageMap.get(resource.toString());
        if (storage && storage._loadPromise) {
            await storage._loadPromise;
            return storage;
        }
        return undefined;
    }

    public dispose(): void {
        NativeEditorStorage.storageMap.delete(this.file.toString());
    }

    public async load(file: Uri, possibleContents?: string): Promise<INotebookModel> {
        // Reset the load promise and reload our cells
        this._loadPromise = this.loadFromFile(file, possibleContents);
        await this._loadPromise;
        return this;
    }

    public update(change: NotebookModelChange): void {
        this.handleModelChange(change);
    }

    public save(): Promise<INotebookModel> {
        return this.saveAs(this.file);
    }

    public async saveAs(file: Uri): Promise<INotebookModel> {
        const contents = await this.getContent();
        await this.fileSystem.writeFile(file.fsPath, contents, 'utf-8');
        if (this.isDirty || file.fsPath !== this.file.fsPath) {
            this.handleModelChange({ source: 'user', kind: 'file', newFile: file, oldFile: this.file, newDirty: false, oldDirty: this.isDirty });
        }
        return this;
    }

    public async getJson(): Promise<Partial<nbformat.INotebookContent>> {
        await this.ensureNotebookJson();
        return this._state.notebookJson;
    }

    public getContent(cells?: ICell[]): Promise<string> {
        return this.generateNotebookContent(cells ? cells : this.cells);
    }

    private handleModelChange(change: NotebookModelChange) {
        const oldDirty = this.isDirty;

        switch (change.source) {
            case 'redo':
            case 'user':
                this.handleRedo(change);
                break;
            case 'undo':
                this.handleUndo(change);
                break;
            default:
                break;
        }

        // Forward onto our listeners (modifying dirty)
        this._changedEmitter.fire({ ...change, newDirty: this.isDirty, oldDirty });
    }

    private handleRedo(change: NotebookModelChange) {
        switch (change.kind) {
            case 'clear':
                this.clearOutputs();
                break;
            case 'edit':
                this.editCell(change.changes, change.cell.id);
                break;
            case 'insert':
                this.insertCell(change.cell, change.index);
                break;
            case 'modify':
                this.updateCellState(change.newCells);
                break;
            case 'remove':
                this.removeCell(change.cell);
                break;
            case 'remove_all':
                this.removeAllCells(change.newCellId);
                break;
            case 'swap':
                this.swapCells(change.firstCellId, change.secondCellId);
                break;
            case 'version':
                this.updateVersionInfo(change.interpreter, change.kernelSpec);
                break;
            case 'file':
                this._state.file = change.newFile;
                NativeEditorStorage.storageMap.delete(change.oldFile.toString());
                NativeEditorStorage.storageMap.set(change.newFile.toString(), this);
                break;
            default:
                break;
        }
        this._state.isDirty = change.kind !== 'version';
    }

    private handleUndo(change: NotebookModelChange) {
        switch (change.kind) {
            case 'clear':
                this._state.cells = change.oldCells;
                break;
            case 'edit':
                this.replaceCell(change.cell);
                break;
            case 'insert':
                this.removeCell(change.cell);
                break;
            case 'modify':
                this.updateCellState(change.oldCells);
                break;
            case 'remove':
                this.insertCell(change.cell, change.index);
                break;
            case 'remove_all':
                this._state.cells = change.oldCells;
                break;
            case 'swap':
                this.swapCells(change.firstCellId, change.secondCellId);
                break;
            case 'version':
                // Not supporting undo
                break;
            default:
                break;
        }

        // Dirty state comes from undo
        this._state.isDirty = change.oldDirty;
    }

    private removeAllCells(newCellId: string) {
        this._state.cells = [];
        this._state.cells.push(this.createEmptyCell(newCellId));
    }

    private editCell(changes: ICellContentChange[], id: string) {
        // Apply the changes to the visible cell list. We won't get an update until
        // submission otherwise
        if (changes && changes.length) {
            const change = changes[0];
            const normalized = change.text.replace(/\r/g, '');

            // Figure out which cell we're editing.
            const index = this.cells.findIndex(c => c.id === id);
            if (index >= 0) {
                // This is an actual edit.
                const contents = concatMultilineStringInput(this.cells[index].data.source);
                const before = contents.substr(0, change.rangeOffset);
                const after = contents.substr(change.rangeOffset + change.rangeLength);
                const newContents = `${before}${normalized}${after}`;
                if (contents !== newContents) {
                    const newCell = { ...this.cells[index], data: { ...this.cells[index].data, source: newContents } };
                    this._state.cells[index] = this.asCell(newCell);
                }
            }
        }
    }

    private swapCells(firstCellId: string, secondCellId: string) {
        const first = this.cells.findIndex(v => v.id === firstCellId);
        const second = this.cells.findIndex(v => v.id === secondCellId);
        if (first >= 0 && second >= 0) {
            const temp = { ...this.cells[first] };
            this._state.cells[first] = this.asCell(this.cells[second]);
            this._state.cells[second] = this.asCell(temp);
        }
    }

    private updateCellState(cells: ICell[]) {
        // Update these cells in our list
        cells.forEach(c => {
            const index = this.cells.findIndex(v => v.id === c.id);
            this._state.cells[index] = this.asCell(c);
        });
    }

    private removeCell(cell: ICell) {
        this._state.cells = this.cells.filter(c => c.id !== cell.id);
    }

    private replaceCell(cell: ICell) {
        const index = this.cells.findIndex(c => c.id === cell.id);
        if (index >= 0) {
            this._state.cells[index] = cell;
        }
    }

    private clearOutputs() {
        this._state.cells = this.cells.map(c => this.asCell({ ...c, data: { ...c.data, execution_count: null, outputs: [] } }));
    }

    private insertCell(cell: ICell, index: number) {
        // Insert a cell into our visible list based on the index. They should be in sync
        this._state.cells.splice(index, 0, cell);
    }

    private updateVersionInfo(interpreter: PythonInterpreter | undefined, kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined) {
        // Get our kernel_info and language_info from the current notebook
        if (interpreter && interpreter.version && this._state.notebookJson.metadata && this._state.notebookJson.metadata.language_info) {
            this._state.notebookJson.metadata.language_info.version = interpreter.version.raw;
        }

        if (kernelSpec && this._state.notebookJson.metadata && !this._state.notebookJson.metadata.kernelspec) {
            // Add a new spec in this case
            this._state.notebookJson.metadata.kernelspec = {
                name: kernelSpec.name || kernelSpec.display_name || '',
                display_name: kernelSpec.display_name || kernelSpec.name || ''
            };
        } else if (kernelSpec && this._state.notebookJson.metadata && this._state.notebookJson.metadata.kernelspec) {
            // Spec exists, just update name and display_name
            this._state.notebookJson.metadata.kernelspec.name = kernelSpec.name || kernelSpec.display_name || '';
            this._state.notebookJson.metadata.kernelspec.display_name = kernelSpec.display_name || kernelSpec.name || '';
        }
    }

    // tslint:disable-next-line: no-any
    private asCell(cell: any): ICell {
        // Works around problems with setting a cell to another one in the nyc compiler.
        return cell as ICell;
    }

    private registerCommands(commandManager: ICommandManager, disposableRegistry: IDisposableRegistry): void {
        NativeEditorStorage.signedUpForCommands = true;
        disposableRegistry.push({
            dispose: () => {
                NativeEditorStorage.signedUpForCommands = false;
            }
        });
        disposableRegistry.push(
            commandManager.registerCommand(Commands.NotebookModel_Update, async (resource: Uri, change: NotebookModelChange) => {
                // Find the appropriate storage object and call into it
                const storage = await NativeEditorStorage.getStorage(resource);
                if (storage) {
                    return storage.handleModelChange(change);
                }
            })
        );
    }

    private async loadFromFile(file: Uri, possibleContents?: string): Promise<ICell[]> {
        // Save file
        this._state.file = file;
        NativeEditorStorage.storageMap.set(file.toString(), this);

        try {
            // Attempt to read the contents if a viable file
            const contents = file.scheme === 'untitled' ? possibleContents : await this.fileSystem.readFile(this.file.fsPath);

            // See if this file was stored in storage prior to shutdown
            const dirtyContents = await this.getStoredContents();
            if (dirtyContents) {
                // This means we're dirty. Indicate dirty and load from this content
                return this.loadContents(dirtyContents, true);
            } else {
                // Load without setting dirty
                return this.loadContents(contents, false);
            }
        } catch {
            // May not exist at this time. Should always have a single cell though
            return [this.createEmptyCell(uuid())];
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

    private async loadContents(contents: string | undefined, forceDirty: boolean): Promise<ICell[]> {
        // tslint:disable-next-line: no-any
        const json = contents ? (JSON.parse(contents) as Partial<nbformat.INotebookContent>) : undefined;

        // Double check json (if we have any)
        if (json && !json.cells) {
            throw new InvalidNotebookFileError(this.file.fsPath);
        }

        // Then compute indent. It's computed from the contents
        if (contents) {
            this.indentAmount = detectIndent(contents).indent;
        }

        // Then save the contents. We'll stick our cells back into this format when we save
        if (json) {
            this._state.notebookJson = json;
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
            forceDirty = true;
        }

        // Save as our visible list
        this._state.cells = remapped;
        this._state.isDirty = forceDirty;

        return this.cells;
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

    private async ensureNotebookJson(): Promise<void> {
        if (!this._state.notebookJson || !this._state.notebookJson.metadata) {
            const pythonNumber = await this.extractPythonMainVersion(this._state.notebookJson);
            // Use this to build our metadata object
            // Use these as the defaults unless we have been given some in the options.
            const metadata: nbformat.INotebookMetadata = {
                language_info: {
                    name: 'python',
                    codemirror_mode: {
                        name: 'ipython',
                        version: pythonNumber
                    }
                },
                orig_nbformat: 2,
                file_extension: '.py',
                mimetype: 'text/x-python',
                name: 'python',
                npconvert_exporter: 'python',
                pygments_lexer: `ipython${pythonNumber}`,
                version: pythonNumber
            };

            // Default notebook data.
            this._state.notebookJson = {
                nbformat: 4,
                nbformat_minor: 2,
                metadata: metadata
            };
        }
    }

    private async generateNotebookContent(cells: ICell[]): Promise<string> {
        // Make sure we have some
        await this.ensureNotebookJson();

        // Reuse our original json except for the cells.
        const json = {
            ...(this._state.notebookJson as nbformat.INotebookContent),
            cells: cells.map(c => this.fixupCell(c.data))
        };
        return JSON.stringify(json, null, this.indentAmount);
    }

    private fixupCell(cell: nbformat.ICell): nbformat.ICell {
        // Source is usually a single string on input. Convert back to an array
        return ({
            ...cell,
            source: splitMultilineString(cell.source)
            // tslint:disable-next-line: no-any
        } as any) as nbformat.ICell; // nyc (code coverage) barfs on this so just trick it.
    }

    private getStorageKey(): string {
        return `${KeyPrefix}${this.file.toString()}`;
    }

    /**
     * Gets any unsaved changes to the notebook file from the old locations.
     * If the file has been modified since the uncommitted changes were stored, then ignore the uncommitted changes.
     *
     * @private
     * @returns {(Promise<string | undefined>)}
     * @memberof NativeEditor
     */
    private async getStoredContents(): Promise<string | undefined> {
        const key = this.getStorageKey();

        // First look in the global storage file location
        let result = await this.getStoredContentsFromFile(key);
        if (!result) {
            result = await this.getStoredContentsFromGlobalStorage(key);
            if (!result) {
                result = await this.getStoredContentsFromLocalStorage(key);
            }
        }

        return result;
    }

    private async getStoredContentsFromFile(key: string): Promise<string | undefined> {
        const filePath = this.getHashedFileName(key);
        try {
            // Use this to read from the extension global location
            const contents = await this.fileSystem.readFile(filePath);
            const data = JSON.parse(contents);
            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && !this.isUntitled && this.file.scheme === 'file') {
                const stat = await this.fileSystem.stat(this.file.fsPath);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && !this.isUntitled && data.contents) {
                return data.contents;
            }
        } catch {
            noop();
        }
    }

    private async getStoredContentsFromGlobalStorage(key: string): Promise<string | undefined> {
        try {
            const data = this.globalStorage.get<{ contents?: string; lastModifiedTimeMs?: number }>(key);

            // If we have data here, make sure we eliminate any remnants of storage
            if (data) {
                await this.transferStorage();
            }

            // Check whether the file has been modified since the last time the contents were saved.
            if (data && data.lastModifiedTimeMs && !this.isUntitled && this.file.scheme === 'file') {
                const stat = await this.fileSystem.stat(this.file.fsPath);
                if (stat.mtime > data.lastModifiedTimeMs) {
                    return;
                }
            }
            if (data && !this.isUntitled && data.contents) {
                return data.contents;
            }
        } catch {
            noop();
        }
    }

    private async getStoredContentsFromLocalStorage(key: string): Promise<string | undefined> {
        const workspaceData = this.localStorage.get<string>(key);
        if (workspaceData && !this.isUntitled) {
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
