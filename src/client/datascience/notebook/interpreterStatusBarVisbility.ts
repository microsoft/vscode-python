// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { IVSCodeNotebook } from '../../common/application/types';
import { IDisposableRegistry } from '../../common/types';
import { IInterpreterStatusbarVisibilityFilter } from '../../interpreter/contracts';
import { isJupyterNotebook } from './helpers/helpers';

@injectable()
export class InterpreterStatusBarVisibility implements IInterpreterStatusbarVisibilityFilter {
    private _changed = new EventEmitter<void>();

    constructor(
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        vscNotebook.onDidChangeActiveNotebookEditor(
            () => {
                this._changed.fire();
            },
            this,
            disposables
        );
    }
    public get changed(): Event<void> {
        return this._changed.event;
    }
    public get hidden() {
        return this.vscNotebook.activeNotebookEditor &&
            isJupyterNotebook(this.vscNotebook.activeNotebookEditor.document)
            ? true
            : false;
    }
}
