// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import {
    Event, EventEmitter, TextEditor, window,
} from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import { IDisposableRegistry } from '../common/types';
import { getDocumentLines } from '../telemetry/importTracker';
import { containsTensorBoardImport } from './helpers';
import { ITensorBoardImportTracker } from './types';

@injectable()
export class TensorBoardImportTracker implements ITensorBoardImportTracker, IExtensionSingleActivationService {
    private pendingChecks = new Map<string, NodeJS.Timer | number>();

    private _onDidImportTensorBoard = new EventEmitter<void>();

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
    ) {
        this.documentManager.onDidChangeActiveTextEditor(
            (e) => this.onChangedActiveTextEditor(e),
            this,
            this.disposables,
        );
    }

    // Fires when the active text editor contains a tensorboard import.
    public get onDidImportTensorBoard(): Event<void> {
        return this._onDidImportTensorBoard.event;
    }

    public dispose(): void {
        this.pendingChecks.clear();
    }

    public async activate(): Promise<void> {
        // Process active text editor with a timeout delay
        this.onChangedActiveTextEditor(window.activeTextEditor);
    }

    private onChangedActiveTextEditor(editor: TextEditor | undefined) {
        if (!editor || !editor.document) {
            return;
        }
        const { document } = editor;
        if (
            (path.extname(document.fileName) === '.ipynb' && document.languageId === 'python')
            || path.extname(document.fileName) === '.py'
        ) {
            const lines = getDocumentLines(document);
            if (containsTensorBoardImport(lines)) {
                this._onDidImportTensorBoard.fire();
            }
        }
    }
}
