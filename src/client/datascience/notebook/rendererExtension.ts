// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationEnvironment, IVSCodeNotebook } from '../../common/application/types';
import { IDisposableRegistry, IExtensions } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { RendererExtensionId } from './constants';
import { isJupyterNotebook } from './helpers/helpers';
import { RendererExtensionDownloader } from './rendererExtensionDownloader';

@injectable()
export class RendererExtension implements IExtensionSingleActivationService {
    constructor(
        @inject(IVSCodeNotebook) private readonly notebook: IVSCodeNotebook,
        @inject(RendererExtensionDownloader) private readonly downloader: RendererExtensionDownloader,
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IApplicationEnvironment) private readonly env: IApplicationEnvironment,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async activate() {
        if (this.env.channel === 'stable') {
            return;
        }
        this.notebook.onDidOpenNotebookDocument(this.onDidOpenNotebook, this, this.disposables);
        this.notebook.notebookDocuments.forEach((doc) => this.onDidOpenNotebook(doc));
    }

    private onDidOpenNotebook(e: NotebookDocument) {
        if (!isJupyterNotebook(e)) {
            return;
        }

        // Download and install the extension if not already found.
        if (!this.extensions.getExtension(RendererExtensionId)) {
            this.downloader.downloadAndInstall().catch(noop);
        }
    }
}
