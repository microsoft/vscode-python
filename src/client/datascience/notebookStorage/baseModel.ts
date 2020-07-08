// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { Event, EventEmitter, Uri } from 'vscode';
import { PythonInterpreter } from '../../pythonEnvironments/info';
import { pruneCell } from '../common';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { isUntitled } from '../interactive-ipynb/nativeEditorStorage';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { ICell, IJupyterKernelSpec, INotebookModel } from '../types';

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
    public get metadata(): nbformat.INotebookMetadata | undefined {
        return this.notebookJson.metadata;
    }
    public get isTrusted() {
        return this._isTrusted;
    }

    protected _disposed = new EventEmitter<void>();
    protected _isDisposed?: boolean;
    protected _changedEmitter = new EventEmitter<NotebookModelChange>();
    protected _editEventEmitter = new EventEmitter<NotebookModelChange>();
    constructor(
        protected _isTrusted: boolean,
        protected _file: Uri,
        protected _cells: ICell[],
        protected notebookJson: Partial<nbformat.INotebookContent> = {},
        public readonly indentAmount: string = ' ',
        private readonly pythonNumber: number = 3
    ) {
        this.ensureNotebookJson();
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
            changed = true;
        } else if (kernelSpec && this.notebookJson.metadata && this.notebookJson.metadata.kernelspec) {
            // Spec exists, just update name and display_name
            const name = kernelSpec.name || kernelSpec.display_name || '';
            const displayName = kernelSpec.display_name || kernelSpec.name || '';
            if (
                this.notebookJson.metadata.kernelspec.name !== name ||
                this.notebookJson.metadata.kernelspec.display_name !== displayName
            ) {
                changed = true;
                this.notebookJson.metadata.kernelspec.name = name;
                this.notebookJson.metadata.kernelspec.display_name = displayName;
            }
        }
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
        const json = {
            cells: this.cells.map((c) => pruneCell(c.data)),
            metadata: this.notebookJson.metadata,
            nbformat: this.notebookJson.nbformat,
            nbformat_minor: this.notebookJson.nbformat_minor
        };
        return JSON.stringify(json, null, this.indentAmount);
    }
}
