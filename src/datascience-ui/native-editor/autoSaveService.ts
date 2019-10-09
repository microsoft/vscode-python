// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IDisposable } from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMessageHandler } from '../react-common/postOffice';
import { NativeEditorStateController } from './nativeEditorStateController';

export class AutoSaveService implements IDisposable, IMessageHandler {
    constructor(private readonly controller: NativeEditorStateController) {}
    public dispose() {
        noop();
    }
    // tslint:disable-next-line: no-any
    public handleMessage(type: string, _payload?: any): boolean {
        if (type === InteractiveWindowMessages.DoSave) {
            this.controller.save();
            return true;
        }
        return false;
    }
}
