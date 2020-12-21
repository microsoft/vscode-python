// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Event, EventEmitter, TextEditor } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDocumentManager } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { IDisposableRegistry } from '../common/types';
import { getDocumentLines } from '../telemetry/importTracker';
import { containsTensorBoardImport } from './helpers';
import { ITensorBoardImportTracker } from './types';

const testExecution = isTestExecution();
@injectable()
export class TensorBoardImportTracker implements ITensorBoardImportTracker, IExtensionSingleActivationService {
    private pendingChecks = new Map<string, NodeJS.Timer | number>();

    private _onDidImportTensorBoard = new EventEmitter<void>();

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
    ) {}

    // Fires when the active text editor contains a tensorboard import.
    public get onDidImportTensorBoard(): Event<void> {
        return this._onDidImportTensorBoard.event;
    }

    public dispose(): void {
        this.pendingChecks.clear();
    }

    public async activate(): Promise<void> {
        if (testExecution) {
            await this.activateInternal();
        } else {
            this.activateInternal().ignoreErrors();
        }
    }

    private async activateInternal() {
        // Process currently active text editor
        this.onChangedActiveTextEditor(this.documentManager.activeTextEditor);
        // Process changes to active text editor as well
        this.documentManager.onDidChangeActiveTextEditor(
            (e) => this.onChangedActiveTextEditor(e),
            this,
            this.disposables,
        );
    }

    private onChangedActiveTextEditor(editor: TextEditor | undefined) {
        if (!editor || !editor.document) {
            return;
        }
        const { document } = editor;
        if (
            (path.extname(document.fileName) === '.ipynb' && document.languageId === 'python') ||
            path.extname(document.fileName) === '.py'
        ) {
            const lines = getDocumentLines(document);
            if (containsTensorBoardImport(lines)) {
                this._onDidImportTensorBoard.fire();
            }
        }
    }
}
