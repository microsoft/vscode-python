// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, EventEmitter, Uri } from 'vscode';
import type {
    NotebookCommunication,
    NotebookData,
    NotebookDocument,
    NotebookDocumentBackup,
    NotebookDocumentBackupContext,
    NotebookDocumentContentChangeEvent,
    NotebookDocumentOpenContext
} from 'vscode-proposed';
import { ICommandManager } from '../../common/application/types';
import { MARKDOWN_LANGUAGE } from '../../common/constants';
import { DataScience } from '../../common/utils/localize';
import { captureTelemetry, sendTelemetryEvent, setSharedProperty } from '../../telemetry';
import { Telemetry } from '../constants';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { notebookModelToVSCNotebookData } from './helpers/helpers';
import { NotebookEditorCompatibilitySupport } from './notebookEditorCompatibilitySupport';
import { INotebookContentProvider } from './types';
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
export class NotebookContentProvider implements INotebookContentProvider {
    private notebookChanged = new EventEmitter<NotebookDocumentContentChangeEvent>();
    public get onDidChangeNotebook() {
        return this.notebookChanged.event;
    }
    constructor(
        @inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(NotebookEditorCompatibilitySupport)
        private readonly compatibilitySupport: NotebookEditorCompatibilitySupport
    ) {}
    public notifyChangesToDocument(document: NotebookDocument) {
        this.notebookChanged.fire({ document });
    }
    public async resolveNotebook(_document: NotebookDocument, _webview: NotebookCommunication): Promise<void> {
        // Later
    }
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
            ? this.notebookStorage.get(uri, undefined, openContext.backupId, true)
            : this.notebookStorage.get(uri, undefined, true, true));

        setSharedProperty('ds_notebookeditor', 'native');
        sendTelemetryEvent(Telemetry.CellCount, undefined, { count: model.cells.length });
        return notebookModelToVSCNotebookData(model);
    }
    @captureTelemetry(Telemetry.Save, undefined, true)
    public async saveNotebook(document: NotebookDocument, cancellation: CancellationToken) {
        const model = await this.notebookStorage.get(document.uri, undefined, undefined, true);
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
        const model = await this.notebookStorage.get(document.uri, undefined, undefined, true);
        if (!cancellation.isCancellationRequested) {
            await this.notebookStorage.saveAs(model, targetResource);
        }
    }
    public async backupNotebook(
        document: NotebookDocument,
        _context: NotebookDocumentBackupContext,
        cancellation: CancellationToken
    ): Promise<NotebookDocumentBackup> {
        const model = await this.notebookStorage.get(document.uri, undefined, undefined, true);
        const id = this.notebookStorage.generateBackupId(model);
        await this.notebookStorage.backup(model, cancellation, id);
        return {
            id,
            delete: () => this.notebookStorage.deleteBackup(model, id).ignoreErrors()
        };
    }
}
