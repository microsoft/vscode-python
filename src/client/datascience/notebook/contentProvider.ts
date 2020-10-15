// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, EventEmitter, Uri } from 'vscode';
import type {
    NotebookCommunication,
    NotebookContentProvider as VSCNotebookContentProvider,
    NotebookData,
    NotebookDocument,
    NotebookDocumentBackup,
    NotebookDocumentBackupContext,
    NotebookDocumentContentChangeEvent,
    NotebookDocumentOpenContext
} from 'vscode-proposed';
import { MARKDOWN_LANGUAGE } from '../../common/constants';
import { createDeferred, Deferred } from '../../common/utils/async';
import { DataScience } from '../../common/utils/localize';
import { captureTelemetry, sendTelemetryEvent, setSharedProperty } from '../../telemetry';
import { Telemetry } from '../constants';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { VSCodeNotebookModel } from '../notebookStorage/vscNotebookModel';
import { INotebookModel } from '../types';
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
export class NotebookContentProvider implements VSCNotebookContentProvider {
    public get onDidChangeNotebook() {
        return this.notebookChanged.event;
    }
    private notebookChanged = new EventEmitter<NotebookDocumentContentChangeEvent>();
    private readonly nativeNotebookModelsWaitingToGetReloaded = new WeakMap<INotebookModel, Deferred<void>>();
    constructor(
        @inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider,
        @inject(NotebookEditorCompatibilitySupport)
        private readonly compatibilitySupport: NotebookEditorCompatibilitySupport
    ) {}
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
        // If the model already exists & it has been trusted.
        const existingModel = this.notebookStorage.get(uri);
        // If there's no backup id, then skip loading dirty contents.
        const model = await this.notebookStorage.getOrCreateModel({
            file: uri,
            backupId: openContext.backupId,
            isNative: true,
            skipLoadingDirtyContents: openContext.backupId === undefined
        });
        if (!(model instanceof VSCodeNotebookModel)) {
            throw new Error('Incorrect NotebookModel, expected VSCodeNotebookModel');
        }
        setSharedProperty('ds_notebookeditor', 'native');
        sendTelemetryEvent(Telemetry.CellCount, undefined, { count: model.cellCount });
        try {
            return model.getNotebookData();
        } finally {
            // Check if we're waiting in `saveNoteBook` method for document to get re-loaded after reverting it.
            if (existingModel && existingModel instanceof VSCodeNotebookModel) {
                const deferred = this.nativeNotebookModelsWaitingToGetReloaded.get(existingModel);
                if (deferred) {
                    // Notify `saveNotebook` method that we have loaded the document.
                    deferred.resolve();
                }
                // Reset the flag (if user hits revert, then we don't treat it as though we're reloading to handle trust).
                existingModel.markAsReloadedAfterTrusting();
            }
        }
    }
    @captureTelemetry(Telemetry.Save, undefined, true)
    public async saveNotebook(document: NotebookDocument, cancellation: CancellationToken) {
        const model = await this.notebookStorage.getOrCreateModel({ file: document.uri, isNative: true });

        // If we this is a model associated with a native notebook
        // & it was trusted after the user opened the notebook, then we cannot save it.
        // We cannot save it until we have reloaded the notebook so that we can display all the output.
        // Save can get invoked automatically if `autoSave` is enabled.
        // Solution, wait for document to get loaded, once loaded, we can ignore this save.
        // If we save here, then document could end up being marked as non-dirty & reverting will not work.
        // Reverting only works for dirty files.
        // This code is to ensure we do not run into issues due to auto save (the VSCode tests should catch any issues).
        if (model instanceof VSCodeNotebookModel && model.trustedAfterOpeningNotebook) {
            const deferred = createDeferred<void>();
            this.nativeNotebookModelsWaitingToGetReloaded.set(model, deferred);
            await deferred.promise;
            return;
        }
        if (cancellation.isCancellationRequested) {
            return;
        }
        await this.notebookStorage.save(model, cancellation);
    }

    public async saveNotebookAs(
        targetResource: Uri,
        document: NotebookDocument,
        cancellation: CancellationToken
    ): Promise<void> {
        const model = await this.notebookStorage.getOrCreateModel({ file: document.uri, isNative: true });
        if (!cancellation.isCancellationRequested) {
            await this.notebookStorage.saveAs(model, targetResource);
        }
    }
    public async backupNotebook(
        document: NotebookDocument,
        _context: NotebookDocumentBackupContext,
        cancellation: CancellationToken
    ): Promise<NotebookDocumentBackup> {
        const model = await this.notebookStorage.getOrCreateModel({ file: document.uri, isNative: true });
        const id = this.notebookStorage.generateBackupId(model);
        await this.notebookStorage.backup(model, cancellation, id);
        return {
            id,
            delete: () => this.notebookStorage.deleteBackup(model, id).ignoreErrors()
        };
    }
}
