// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IAttachItem, IAttachProcess } from './types';

export class AttachProcess implements IAttachProcess {
    constructor(public name: string, public pid: string, public commandLine: string) { }

    public toAttachItem(): IAttachItem {
        return {
            label: this.name,
            description: this.pid,
            detail: this.commandLine,
            id: this.pid
        };
    }
}
