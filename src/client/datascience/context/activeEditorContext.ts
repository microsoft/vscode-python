// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { EditorContexts } from '../constants';
import { IInteractiveWindow, IInteractiveWindowProvider, INotebookEditor, INotebookEditorProvider } from '../types';

@injectable()
export class ActiveEditorContextService implements IExtensionSingleActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(IInteractiveWindowProvider) private readonly interactiveProvider: IInteractiveWindowProvider,
        @inject(INotebookEditorProvider) private readonly notebookProvider: INotebookEditorProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        disposables.push(this);
    }
    public dispose() {
        this.disposables.forEach(item => item.dispose());
    }
    public async activate(): Promise<void> {
        this.interactiveProvider.onDidChangeActiveInteractiveWindow(this.onDidChangeActiveInteractiveWindow, this, this.disposables);
        this.notebookProvider.onDidChangeActiveNotebookEditor(this.onDidChangeActiveNotebookEditor, this, this.disposables);
    }

    private onDidChangeActiveInteractiveWindow(e?: IInteractiveWindow) {
        const interactiveContext = new ContextKey(EditorContexts.IsInteractive, this.commandManager);
        interactiveContext.set(!!e).ignoreErrors();
    }
    private onDidChangeActiveNotebookEditor(e?: INotebookEditor) {
        const interactiveContext = new ContextKey(EditorContexts.IsNative, this.commandManager);
        interactiveContext.set(!!e).ignoreErrors();
    }
}
