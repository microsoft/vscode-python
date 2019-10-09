// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, TextEditor, WindowState } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import '../../common/extensions';
import { IDisposable } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { IInteractiveWindowListener } from '../types';

// tslint:disable: no-any

/**
 * Sends notifications to Notebooks related to auto saving of files.
 * If window state changes, then notify notebooks.
 * If active editor changes, then notify notebooks.
 * This information is necessary for the implementation of automatically saving notebooks.
 *
 * @export
 * @class AutoSaveService
 * @implements {IInteractiveWindowListener}
 */
@injectable()
export class AutoSaveService implements IInteractiveWindowListener {
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();
    private disposables: IDisposable[] = [];
    constructor(@inject(IApplicationShell) appShell: IApplicationShell, @inject(IDocumentManager) documentManager: IDocumentManager) {
        this.disposables.push(appShell.onDidChangeWindowState(this.onDidChangeWindowState.bind(this)));
        this.disposables.push(documentManager.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this)));
    }

    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    public onMessage(_message: string, _payload?: any): void {
        noop();
    }
    public dispose(): void | undefined {
        this.disposables.filter(item => !!item).forEach(item => item.dispose());
    }

    private onDidChangeWindowState(e: WindowState) {
        this.postEmitter.fire({ message: InteractiveWindowMessages.WindowStateChanged, payload: e });
    }
    private onDidChangeActiveTextEditor(_e?: TextEditor) {
        this.postEmitter.fire({ message: InteractiveWindowMessages.ActiveTextEditorChanged, payload: undefined });
    }
}
