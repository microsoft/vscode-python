// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { sleep } from '../helpers';
import '../helpers/extensions';
import { IApplication, IInterpreters } from '../types';

export class Interpreters implements IInterpreters {
    constructor(private readonly app: IApplication) {}
    public async select(options: { name: string } | { tooltip: string }): Promise<void> {
        await this.app.quickopen.runCommand('Python: Select Interpreter');
        await this.app.quickinput.select({ value: 'name' in options ? options.name : options.tooltip });
        // Wait for 1s for ui to get updated.
        await sleep(1000);
    }
}
