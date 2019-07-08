// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { context } from '../application';
import { sleep } from '../helpers';

export class Interpreters {

    public async selectInterpreter({ tooltip, name }: { tooltip?: string; name?: string }): Promise<void> {
        await context.app.workbench.quickopen.runCommand('Python: Select Interpreter');
        await context.app.captureScreenshot('Interpreter List');
        await context.app.workbench.quickinput.waitForQuickInputOpened();
        await context.app.workbench.quickinput.selectValue(name || tooltip || 'python');
        await context.app.captureScreenshot('Filtered Interpreter List');
        await context.app.code.dispatchKeybinding('enter');
        await context.app.workbench.quickinput.waitForQuickInputClosed();
        // Wait for 1s for ui to get updated.
        await sleep(1000);
    }
}
