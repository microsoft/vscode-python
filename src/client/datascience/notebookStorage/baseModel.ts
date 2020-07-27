// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { Event, EventEmitter, Memento, Uri } from 'vscode';
import { ICryptoUtils } from '../../common/types';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { pruneCell } from '../common';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { ICell, IJupyterKernelSpec, INotebookMetadataLive, INotebookModel } from '../types';
import { isUntitled } from './nativeEditorStorage';

export const ActiveKernelIdList = `Active_Kernel_Id_List`;
// This is the number of kernel ids that will be remembered between opening and closing VS code
export const MaximumKernelIdListSize = 40;
type KernelIdListEntry = {
    fileHash: string;
    kernelId: string | undefined;
};

export abstract class BaseNotebookModel implements INotebookModel {
    public get onDidDispose() {
        return this._disposed.event;
    }
    public get isDisposed() {
        return this._isDisposed === true;
    }
    public get isDirty(): boolean {
        return false;
    }
    public get changed(): Event<NotebookModelChange> {
        return this._changedEmitter.event;
    }
    public get file(): Uri {
        return this._file;
    }

    public get isUntitled(): boolean {
        return isUntitled(this);
    }
    public get cells(): ICell[] {
        return this._cells;
    }
    public get onDidEdit(): Event<NotebookModelChange> {
        return this._editEventEmitter.event;
    }
    public get metadata(): INotebookMetadataLive | undefined {
        return this.kernelId && this.notebookJson.metadata
            ? {
                  ...this.notebookJson.metadata,
                  id: this.kernelId
              }
            : this.notebookJson.metadata;
    }
    public get isTrusted() {
        return this._isTrusted;
    }

    protected _disposed = new EventEmitter<void>();
    protected _isDisposed?: boolean;
    protected _changedEmitter = new EventEmitter<NotebookModelChange>();
    protected _editEventEmitter = new EventEmitter<NotebookModelChange>();
    private kernelId: string | undefined;
    constructor(
        protected _isTrusted: boolean,
        protected _file: Uri,
        protected _cells: ICell[],
        protected globalMemento: Memento,
        private crypto: ICryptoUtils,
        protected notebookJson: Partial<nbformat.INotebookContent> = {},
        public readonly indentAmount: string = ' ',
        private readonly pythonNumber: number = 3
    ) {
        this.ensureNotebookJson();
        this.kernelId = this.getStoredKernelId();
    }
    public dispose() {
        this._isDisposed = true;
        this._disposed.fire();
    }
    public update(change: NotebookModelChange): void {
        this.handleModelChange(change);
    }

    public getContent(): string {
        return this.generateNotebookContent();
    }
    protected handleUndo(_change: NotebookModelChange): boolean {
        return false;
    }

    protected handleRedo(change: NotebookModelChange): boolean {
        let changed = false;
        switch (change.kind) {
            case 'version':
                changed = this.updateVersionInfo(change.interpreter, change.kernelSpec);
                break;
            case 'updateTrust':
                this._isTrusted = change.isNotebookTrusted;
                break;
            default:
                break;
        }

        return changed;
    }

    private handleModelChange(change: NotebookModelChange) {
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
        if ((changed || this.isDirty !== oldDirty) && change.kind !== 'updateTrust') {
            this._changedEmitter.fire({ ...change, newDirty: this.isDirty, oldDirty, model: this });
        }
        // Slightly different for the event we send to VS code. Skip version and file changes. Only send user events.
        if (
            (changed || this.isDirty !== oldDirty) &&
            change.kind !== 'version' &&
            change.source === 'user' &&
            change.kind !== 'updateTrust'
        ) {
            this._editEventEmitter.fire(change);
        }
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
            this.notebookJson.metadata &&
            this.notebookJson.metadata.language_info &&
            this.notebookJson.metadata.language_info.version !== interpreter.version.raw
        ) {
            this.notebookJson.metadata.language_info.version = interpreter.version.raw;
            changed = true;
        }

        if (kernelSpec && this.notebookJson.metadata && !this.notebookJson.metadata.kernelspec) {
            // Add a new spec in this case
            this.notebookJson.metadata.kernelspec = {
                name: kernelSpec.name || kernelSpec.display_name || '',
                display_name: kernelSpec.display_name || kernelSpec.name || ''
            };
            this.kernelId = kernelSpec.id;
            changed = true;
        } else if (kernelSpec && this.notebookJson.metadata && this.notebookJson.metadata.kernelspec) {
            // Spec exists, just update name and display_name
            const name = kernelSpec.name || kernelSpec.display_name || '';
            const displayName = kernelSpec.display_name || kernelSpec.name || '';
            if (
                this.notebookJson.metadata.kernelspec.name !== name ||
                this.notebookJson.metadata.kernelspec.display_name !== displayName ||
                this.kernelId !== kernelSpec.id
            ) {
                changed = true;
                this.notebookJson.metadata.kernelspec.name = name;
                this.notebookJson.metadata.kernelspec.display_name = displayName;
                this.kernelId = kernelSpec.id;
            }
        }

        // Update our kernel id in our global storage too
        this.setStoredKernelId(kernelSpec?.id);

        return changed;
    }

    private ensureNotebookJson() {
        if (!this.notebookJson || !this.notebookJson.metadata) {
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
            this.notebookJson = {
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
        const json = { ...this.notebookJson };
        json.cells = this.cells.map((c) => pruneCell(c.data));
        return JSON.stringify(json, null, this.indentAmount);
    }

    private getStoredKernelId(): string | undefined {
        // Stored as a list so we don't take up too much space
        const list: KernelIdListEntry[] = this.globalMemento.get<KernelIdListEntry[]>(ActiveKernelIdList, []);
        if (list) {
            // Not using a map as we're only going to store the last 40 items.
            const fileHash = this.crypto.createHash(this._file.toString(), 'string');
            const entry = list.find((l) => l.fileHash === fileHash);
            return entry?.kernelId;
        }
    }
    private setStoredKernelId(id: string | undefined) {
        const list: KernelIdListEntry[] = this.globalMemento.get<KernelIdListEntry[]>(ActiveKernelIdList, []);
        const fileHash = this.crypto.createHash(this._file.toString(), 'string');
        const index = list.findIndex((l) => l.fileHash === fileHash);
        // Always remove old spot (we'll push on the back for new ones)
        if (index >= 0) {
            list.splice(index, 1);
        }

        // If adding a new one, push
        if (id) {
            list.push({ fileHash, kernelId: id });
        }

        // Prune list if too big
        while (list.length > MaximumKernelIdListSize) {
            list.shift();
        }
        return this.globalMemento.update(ActiveKernelIdList, list);
    }
}
