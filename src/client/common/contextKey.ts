// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ICommandManager } from './application/types';

export class ContextKey {
    private lastValue?: boolean;

    constructor(private name: string, private commandManager: ICommandManager) { }

    public async set(value: boolean): Promise<void> {
        if (this.lastValue === value) {
            return;
        }
        this.lastValue = value;
        await this.commandManager.executeCommand('setContext', this.name, this.lastValue);
    }
}
