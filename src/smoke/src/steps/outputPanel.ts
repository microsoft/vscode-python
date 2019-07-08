// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Then } from 'cucumber';
import { context } from '../application';
import '../helpers/extensions';

Then('the {word} {string} will be displayed in the output panel', async (_textOrMessage: string, text: string) => {
    await context.app.workbench.panels.waitForContentInOutputPanel(text);
});

Then('the {word} {string} will be displayed in the output panel within {int} seconds', async (_textOrMessage: string, text: string, timeoutSeconds: number) => {
    await context.app.workbench.panels.waitForContentInOutputPanel(text, timeoutSeconds);
});
