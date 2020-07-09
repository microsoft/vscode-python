// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, ICommandManager, IVSCodeNotebook } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';
import { DataScience } from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { Commands } from '../constants';
import { INotebookStorageProvider } from '../interactive-ipynb/notebookStorageProvider';
import { INotebookEditorProvider, ITrustService } from '../types';
import { updateVSCNotebookAfterTrustingNotebook } from './helpers/cellUpdateHelpers';
import { isJupyterNotebook } from './helpers/helpers';

@injectable()
export class NotebookTrustHandler implements IExtensionSingleActivationService {
    constructor(
        @inject(ITrustService) private readonly trustService: ITrustService,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(INotebookStorageProvider) private readonly storageProvider: INotebookStorageProvider,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async activate(): Promise<void> {
        this.disposables.push(this.commandManager.registerCommand(Commands.TrustNotebook, this.onTrustNotebook, this));
        this.disposables.push(this.commandManager.registerCommand(Commands.TrustedNotebook, noop));
        this.trustService.onDidSetNotebookTrust(this.onDidTrustNotebook, this, this.disposables);
    }
    private onDidTrustNotebook() {
        this.vscNotebook.notebookDocuments.forEach((doc) => {
            if (!isJupyterNotebook(doc)) {
                return;
            }
            const editor = this.editorProvider.editors.find((e) => this.fs.arePathsSame(e.file.fsPath, doc.uri.fsPath));
            if (editor && editor.model?.isTrusted) {
                updateVSCNotebookAfterTrustingNotebook(doc, editor.model);
            }
        });
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

        const prompts = [DataScience.trustNotebook(), DataScience.doNotTrustNotebook()];
        const selection = await this.applicationShell.showErrorMessage(
            DataScience.launchNotebookTrustPrompt(),
            ...prompts
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
