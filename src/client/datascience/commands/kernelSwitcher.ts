// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ICommandManager } from '../../common/application/types';
import { IDisposable } from '../../common/types';
import { Commands } from '../constants';
import { IInteractiveWindowProvider, INotebookEditorProvider } from '../types';

@injectable()
export class KernelSwitcherCommand implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private interactiveWindowProvider: IInteractiveWindowProvider
    ) {}
    public register() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.SwitchJupyterKernel, this.switchKernel, this)
        );
    }
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    private switchKernel() {
        const activeBase = this.notebookEditorProvider.activeEditor
            ? this.notebookEditorProvider.activeEditor
            : this.interactiveWindowProvider.activeWindow;
        if (activeBase) {
            activeBase.selectNewKernel().ignoreErrors();
        }
    }
}
