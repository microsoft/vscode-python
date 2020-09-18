// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { commands, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import '../../common/extensions';
import { IDisposableRegistry } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import { DataScience } from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { Commands, Telemetry } from '../constants';
import { INotebookStorageProvider } from '../notebookStorage/notebookStorageProvider';
import { INotebookEditorProvider, ITrustService } from '../types';

@injectable()
export class TrustCommandHandler implements IExtensionSingleActivationService {
    constructor(
        @inject(ITrustService) private readonly trustService: ITrustService,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(INotebookStorageProvider) private readonly storageProvider: INotebookStorageProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
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
                // Update model trust
                model.trust();
                const contents = model.getContent();
                await this.trustService.trustNotebook(model.file, contents);
                sendTelemetryEvent(Telemetry.TrustNotebook);
                break;
            case DataScience.doNotTrustNotebook():
                sendTelemetryEvent(Telemetry.DoNotTrustNotebook);
                break;
            default:
                break;
        }
    }
}
