// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IDisposableRegistry } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { BaseNotebookProvider } from '../interactive-common/notebookProvider';
import { IInteractiveWindowProvider } from '../types';

@injectable()
export class InteractiveWindowNotebookProvider extends BaseNotebookProvider {
    constructor(
        @inject(IInteractiveWindowProvider) private readonly interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        super();
        disposables.push(
            interactiveWindowProvider.onDidChangeActiveInteractiveWindow(this.checkAndDisposeNotebook, this)
        );
    }

    /**
     * Interactive windows have just one window.
     * When that it closed, just close all of the notebooks associated with interactive windows.
     */
    protected checkAndDisposeNotebook() {
        if (this.interactiveWindowProvider.getActive()) {
            return;
        }

        Array.from(this.notebooks.values()).forEach(promise => {
            promise.then(notebook => notebook.dispose()).catch(noop);
        });

        this.notebooks.clear();
    }
}
