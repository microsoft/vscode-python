// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';

import { IInteractiveWindowMapping, InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { SyncPayload } from '../interactive-common/types';
import { IDataScienceFileSystem, INotebookEditor } from '../types';

// tslint:disable: no-any

type UserActionNotificationCallback = <M extends IInteractiveWindowMapping, T extends keyof M>(
    type: T,
    payload?: M[T]
) => void;

@injectable()
export class NativeEditorSynchronizer {
    private registeredNotebooks = new Map<INotebookEditor, UserActionNotificationCallback>();
    private enabled = true;
    constructor(@inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem) {}
    public notifyUserAction(message: SyncPayload, editor: INotebookEditor) {
        if (!this.enabled) {
            return;
        }
        this.registeredNotebooks.forEach((cb, item) => {
            if (item !== editor && this.fs.arePathsSame(item.file, editor.file)) {
                cb(InteractiveWindowMessages.Sync, message as any);
            }
        });
    }
    public subscribeToUserActions(editor: INotebookEditor, cb: UserActionNotificationCallback) {
        this.registeredNotebooks.set(editor, cb);
    }
    public disable() {
        this.enabled = false;
        this.registeredNotebooks.clear();
    }
}
