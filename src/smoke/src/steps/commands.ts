// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Then, When } from 'cucumber';
import { context } from '../application';
import { sleep } from '../helpers';

When('I select the command {string}', launchCommand);
Then('select the command {string}', launchCommand);

async function launchCommand(command: string) {
    if (command === 'Debug: Stop') {
        // Wait for some time before we send the actual command.
        // Delay is to ensure debugger has actually started (i.e. debug adapter has started).
        // The steps might be:
        // 1. Start debugging
        // 2. Confifrm debugger has started
        // 3. Stop debugging
        // Between 2 & 3 we might need a delay, just because VSC displays the UI doesn't mean the debugger is ready to receive a stop command.
        // VSC displays this UI even beter debug adapter has started and received initialization scripts.
        // In which case, attempting to stop debugger could be a little premature.
        // Or at least thats what seems to be happing in UI tests (remember - things happen very fast, < 1s)
        await sleep(1000);
    }

    await context.app.workbench.quickopen.runCommand(command);
}
