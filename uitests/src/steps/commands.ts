// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import { Then, When } from 'cucumber';

When('I select the command {string}', async function(command: string) {
    await this.app.quickopen.runCommand(command);
});

Then('select the command {string}', async function(command: string) {
    await this.app.quickopen.runCommand(command);
});
