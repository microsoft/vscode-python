// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Memento } from 'vscode';
import { IDisposableRegistry, IMemento, WORKSPACE_MEMENTO } from '../common/types';
import {
    IInteractiveWindowProvider,
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditorProvider
} from './types';

const LastNotebookOpenedTimeKey = 'last-notebook-start-time';
const LastInteractiveWindowStartTimeKey = 'last-interactive-window-start-time';

@injectable()
export class NotebookAndInteractiveWindowUsageTracker implements INotebookAndInteractiveWindowUsageTracker {
    public get lastNotebookOpened() {
        const time = this.mementoStorage.get<number | undefined>(LastNotebookOpenedTimeKey);
        return time ? new Date(time) : undefined;
    }
    public get lastInteractiveWindowOpened() {
        const time = this.mementoStorage.get<number | undefined>(LastInteractiveWindowStartTimeKey);
        return time ? new Date(time) : undefined;
    }
    constructor(
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private mementoStorage: Memento,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private readonly interactiveWindowProvider: IInteractiveWindowProvider,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    public async startTracking(): Promise<void> {
        this.disposables.push(
            this.notebookEditorProvider.onDidOpenNotebookEditor(() =>
                this.mementoStorage.update(LastNotebookOpenedTimeKey, Date.now())
            )
        );
        this.disposables.push(
            this.interactiveWindowProvider.onDidChangeActiveInteractiveWindow(() =>
                this.mementoStorage.update(LastInteractiveWindowStartTimeKey, Date.now())
            )
        );
    }
}
