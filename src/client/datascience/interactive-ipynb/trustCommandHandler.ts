// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { EnableTrustedNotebooks } from '../../common/experiments/groups';
import '../../common/extensions';
import { IDisposableRegistry, IExperimentService } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { Commands } from '../constants';
import { INotebookStorageProvider } from '../interactive-ipynb/notebookStorageProvider';
import { INotebookEditorProvider, ITrustService } from '../types';

@injectable()
export class TrustCommandHandler implements IExtensionSingleActivationService {
    constructor(
        @inject(ITrustService) private readonly trustService: ITrustService,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(INotebookStorageProvider) private readonly storageProvider: INotebookStorageProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IExperimentService) private readonly experiments: IExperimentService
    ) {}
    public async activate(): Promise<void> {
        this.activateInBackground().ignoreErrors();
    }
    public async activateInBackground(): Promise<void> {
        if (!(await this.experiments.inExperiment(EnableTrustedNotebooks.experiment))) {
            return;
        }
        const context = new ContextKey('python.datascience.trustfeatureenabled', this.commandManager);
        context.set(true).ignoreErrors();
        this.disposables.push(this.commandManager.registerCommand(Commands.TrustNotebook, this.onTrustNotebook, this));
        this.disposables.push(this.commandManager.registerCommand(Commands.TrustedNotebook, noop));
    }
    @swallowExceptions('Trusting notebook')
    private async onTrustNotebook(uri?: Uri) {
        uri = uri ?? this.editorProvider.activeEditor?.file;
        if (!uri) {
            return;
        }

        const model = await this.storageProvider.get(uri);
        if (model.isTrusted) {
            return;
        }

        const selection = await this.applicationShell.showErrorMessage(
            DataScience.launchNotebookTrustPrompt(),
            DataScience.trustNotebook(),
            DataScience.doNotTrustNotebook(),
            DataScience.trustAllNotebooks()
        );
        if (selection !== DataScience.trustNotebook() || model.isTrusted) {
            return;
        }
        // Update model trust
        model.update({
            source: 'user',
            kind: 'updateTrust',
            oldDirty: model.isDirty,
            newDirty: model.isDirty,
            isNotebookTrusted: true
        });
        const contents = model.getContent();
        await this.trustService.trustNotebook(model.file, contents);
    }
}
