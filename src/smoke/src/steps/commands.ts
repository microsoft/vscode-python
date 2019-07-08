// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Then, When } from 'cucumber';
import { context } from '../application';

When('I select the command {string}', async (command: string) => {
    await context.app.workbench.quickopen.runCommand(command);
});
Then('select the command {string}', async (command: string) => {
    await context.app.workbench.quickopen.runCommand(command);
});
