// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, EventEmitter, Uri } from 'vscode';
import type {
    NotebookContentProvider as VSCodeNotebookContentProvider,
    NotebookData,
    NotebookDocument,
    NotebookDocumentBackup,
    NotebookDocumentBackupContext,
    NotebookDocumentEditEvent,
    NotebookDocumentOpenContext
} from 'vscode-proposed';
import { ICommandManager } from '../../common/application/types';
import { MARKDOWN_LANGUAGE } from '../../common/constants';
import { DataScience } from '../../common/utils/localize';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { INotebookStorageProvider } from '../interactive-ipynb/notebookStorageProvider';
import { notebookModelToVSCNotebookData } from './helpers/helpers';
import { NotebookEditorCompatibilitySupport } from './notebookEditorCompatibilitySupport';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

/**
 * This class is responsible for reading a notebook file (ipynb or other files) and returning VS Code with the NotebookData.
 * Its up to extension authors to read the files and return it in a format that VSCode understands.
 * Same with the cells and cell output.
 *
 * Also responsible for saving of notebooks.
 * When saving, VSC will provide their model and we need to take that and merge it with an existing ipynb json (if any, to preserve metadata).
 */
@injectable()
export class NotebookContentProvider implements VSCodeNotebookContentProvider {
    private notebookChanged = new EventEmitter<NotebookDocumentEditEvent>();
    public get onDidChangeNotebook() {
        return this.notebookChanged.event;
    }
    constructor(
        @inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(NotebookEditorCompatibilitySupport)
        private readonly compatibilitySupport: NotebookEditorCompatibilitySupport
    ) {}
    public async openNotebook(uri: Uri, openContext: NotebookDocumentOpenContext): Promise<NotebookData> {
        if (!this.compatibilitySupport.canOpenWithVSCodeNotebookEditor(uri)) {
            // If not supported, return a notebook with error displayed.
            // We cannot, not display a notebook.
            return {
                cells: [
                    {
                        cellKind: vscodeNotebookEnums.CellKind.Markdown,
                        language: MARKDOWN_LANGUAGE,
                        source: `# ${DataScience.usingPreviewNotebookWithOtherNotebookWarning()}`,
                        metadata: { editable: false, runnable: false },
                        outputs: []
                    }
                ],
                languages: [],
                metadata: { cellEditable: false, editable: false, runnable: false }
            };
        }
        // If there's no backup id, then skip loading dirty contents.
        const model = await (openContext.backupId
            ? this.notebookStorage.load(uri, undefined, openContext.backupId)
            : this.notebookStorage.load(uri, undefined, true));
        return notebookModelToVSCNotebookData(model);
    }
    @captureTelemetry(Telemetry.Save, undefined, true)
    public async saveNotebook(document: NotebookDocument, cancellation: CancellationToken) {
        const model = await this.notebookStorage.load(document.uri);
        if (cancellation.isCancellationRequested) {
            return;
        }
        if (model.isUntitled) {
            await this.commandManager.executeCommand('workbench.action.files.saveAs', document.uri);
        } else {
            await this.notebookStorage.save(model, cancellation);
        }
    }

    public async saveNotebookAs(
        targetResource: Uri,
        document: NotebookDocument,
        cancellation: CancellationToken
    ): Promise<void> {
        const model = await this.notebookStorage.load(document.uri);
        if (!cancellation.isCancellationRequested) {
            await this.notebookStorage.saveAs(model, targetResource);
        }
    }
    public async revertNotebook(_document: NotebookDocument, _cancellation: CancellationToken): Promise<void> {
        // Not implemented, waiting on VSCode API changes.
    }
    public async backupNotebook(
        document: NotebookDocument,
        _context: NotebookDocumentBackupContext,
        cancellation: CancellationToken
    ): Promise<NotebookDocumentBackup> {
        const model = await this.notebookStorage.load(document.uri);
        const id = this.notebookStorage.generateBackupId(model);
        await this.notebookStorage.backup(model, cancellation, id);
        return {
            id,
            delete: () => this.notebookStorage.deleteBackup(model, id).ignoreErrors()
        };
    }
}
