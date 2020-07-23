// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IVSCodeNotebook } from '../../common/application/types';

import { IDisposableRegistry } from '../../common/types';
import { IDataScienceFileSystem, INotebookEditorProvider, ITrustService } from '../types';
import { updateVSCNotebookAfterTrustingNotebook } from './helpers/cellUpdateHelpers';
import { isJupyterNotebook } from './helpers/helpers';

@injectable()
export class NotebookTrustHandler implements IExtensionSingleActivationService {
    constructor(
        @inject(ITrustService) private readonly trustService: ITrustService,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async activate(): Promise<void> {
        this.trustService.onDidSetNotebookTrust(this.onDidTrustNotebook, this, this.disposables);
    }
    private onDidTrustNotebook() {
        this.vscNotebook.notebookDocuments.forEach((doc) => {
            if (!isJupyterNotebook(doc)) {
                return;
            }
            const editor = this.editorProvider.editors.find((e) =>
                this.fs.areLocalPathsSame(e.file.fsPath, doc.uri.fsPath)
            );
            if (editor && editor.model?.isTrusted) {
                updateVSCNotebookAfterTrustingNotebook(doc, editor.model);
            }
        });
    }
}
