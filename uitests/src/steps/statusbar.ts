// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import { expect } from 'chai';
import { Then } from 'cucumber';
import { CucumberRetryMax5Seconds } from '../constants';
import '../helpers/extensions';

// Add a delay, as this can take around 1s (from the time something was selected).
Then('the python the status bar contains the text {string}', CucumberRetryMax5Seconds, async function(text: string) {
    const statubarText = await this.app.statusbar.getPythonStatusBarText();
    expect(statubarText).contains(text);
});

// Add a delay, as this can take around 1s (from the time something was selected).
Then('the python the status bar does not contain the text {string}', CucumberRetryMax5Seconds, async function(text: string) {
    const statubarText = await this.app.statusbar.getPythonStatusBarText();
    expect(statubarText).not.contains(text);
});

// Then('the python the status bar is not visible', async () => {
//     await context.app.workbench.statusbar.pythonStatusBarElementIsNotVisible();
// });
