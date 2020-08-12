// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { NotebookDocument } from '../../../../typings/vscode-proposed';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationEnvironment, IVSCodeNotebook } from '../../common/application/types';
import { IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IKernelProvider } from '../jupyter/kernels/types';
import { INotebookProvider } from '../types';

@injectable()
export class NotebookDisposeService implements IExtensionSingleActivationService {
    constructor(
        @inject(IApplicationEnvironment) private readonly env: IApplicationEnvironment,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(IKernelProvider) private readonly kernelProvider: IKernelProvider
    ) {}
    public async activate(): Promise<void> {
        if (this.env.channel !== 'insiders') {
            return;
        }

        this.vscNotebook.onDidCloseNotebookDocument(this.onDidCloseNotebookDocument, this, this.disposables);
    }
    private onDidCloseNotebookDocument(document: NotebookDocument) {
        const kernel = this.kernelProvider.get(document.uri);
        if (kernel) {
            kernel.dispose().catch(noop);
        }
        this.notebookProvider.disposeAssociatedNotebook({ identity: document.uri });
    }
}
