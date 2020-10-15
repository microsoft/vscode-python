// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { commands, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, ICommandManager, IVSCodeNotebook } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { swallowExceptions } from '../../common/utils/decorators';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { Commands, Telemetry } from '../constants';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { VSCodeNotebookModel } from '../notebookStorage/vscNotebookModel';
import { INotebookEditorProvider, INotebookModel, ITrustService } from '../types';

@injectable()
export class TrustCommandHandler implements IExtensionSingleActivationService {
    constructor(
        @inject(ITrustService) private readonly trustService: ITrustService,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(INotebookStorageProvider) private readonly storageProvider: INotebookStorageProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(IFileSystem) private readonly fs: IFileSystem
    ) {}
    public async activate(): Promise<void> {
        this.activateInBackground().ignoreErrors();
    }
    public async activateInBackground(): Promise<void> {
        const context = new ContextKey('python.datascience.trustfeatureenabled', this.commandManager);
        context.set(true).ignoreErrors();
        this.disposables.push(this.commandManager.registerCommand(Commands.TrustNotebook, this.onTrustNotebook, this));
    }
    @swallowExceptions('Trusting notebook')
    private async onTrustNotebook(uri?: Uri) {
        uri = uri ?? this.editorProvider.activeEditor?.file;
        if (!uri) {
            return;
        }

        const model = await this.storageProvider.getOrCreateModel({ file: uri });
        if (model.isTrusted) {
            return;
        }

        const selection = await this.applicationShell.showErrorMessage(
            DataScience.launchNotebookTrustPrompt(),
            DataScience.trustNotebook(),
            DataScience.doNotTrustNotebook(),
            DataScience.trustAllNotebooks()
        );
        sendTelemetryEvent(Telemetry.NotebookTrustPromptShown);

        switch (selection) {
            case DataScience.trustAllNotebooks():
                commands.executeCommand('workbench.action.openSettings', 'python.dataScience.alwaysTrustNotebooks');
                sendTelemetryEvent(Telemetry.TrustAllNotebooks);
                break;
            case DataScience.trustNotebook():
                if (model instanceof VSCodeNotebookModel) {
                    await this.trustNativeNotebook(model);
                } else {
                    await this.trustNotebook(model);
                }
                break;
            case DataScience.doNotTrustNotebook():
                sendTelemetryEvent(Telemetry.DoNotTrustNotebook);
                break;
            default:
                break;
        }
    }
    private async trustNotebook(model: INotebookModel) {
        // Update model trust
        model.trust();
        const contents = model.getContent();
        await this.trustService.trustNotebook(model.file, contents);
        sendTelemetryEvent(Telemetry.TrustNotebook);
    }
    private async trustNativeNotebook(model: VSCodeNotebookModel) {
        const trustedNotebookInTrustService = createDeferred<void>();
        const doc = this.vscNotebook.notebookDocuments.find((item) =>
            this.fs.arePathsSame(item.uri.fsPath, model.file.fsPath)
        );
        let fileReverted = false;
        const disposable = this.vscNotebook.onDidChangeNotebookDocument((e) => {
            if (e.document !== doc) {
                return;
            }
            trustedNotebookInTrustService.promise
                .then(() => {
                    // Notebook has been trusted, revert the changes in the document so that we re-load the cells.
                    // This is a hacky solution for trusting native notebooks.
                    if (!fileReverted) {
                        fileReverted = true;
                        return commands.executeCommand('workbench.action.files.revert');
                    }
                })
                .catch(noop);
            disposable.dispose();
        });
        this.disposables.push(disposable);

        try {
            // Update model trust
            await model.trustNotebook();
            // Trust the original contents & contents generated vy using the VSC Notebook model.
            // When generating JSON from VSC, sometimes contents can get auto formatted based on user settings (hence that JSON in ipynb could be different from original contents).
            // Thus trust both, the original content & the new content generated by VSC.
            const originalContents = model.getOriginalContentOnDisc();
            const contents = model.getContent();
            await Promise.all([
                this.trustService.trustNotebook(model.file, contents),
                this.trustService.trustNotebook(model.file, originalContents)
            ]);
            sendTelemetryEvent(Telemetry.TrustNotebook);
        } finally {
            trustedNotebookInTrustService.resolve();
        }
    }
}
