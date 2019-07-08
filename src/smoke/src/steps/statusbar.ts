// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Then } from 'cucumber';
import { context } from '../application';
import '../helpers/extensions';

use(chaiAsPromised);

Then('the python the status bar contains the text {string}', async (text: string) => {
    const ele = await context.app.workbench.statusbar.getPythonStatusBarElement();
    expect(ele.textContent.normalize()).contains(text);
});

Then('the python the status bar does not contain the text {string}', async (text: string) => {
    const ele = await context.app.workbench.statusbar.getPythonStatusBarElement();
    expect(ele.textContent.normalize()).not.contains(text);
});

Then('the python the status bar is not visible', async () => {
    await context.app.workbench.statusbar.pythonStatusBarElementIsNotVisible();
});
