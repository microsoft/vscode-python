// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { Then } from 'cucumber';
import { context } from '../application';

Then('there are no problems in the problems panel', async () => {
    const count = await context.app.workbench.problems.getProblemCount();
    assert.equal(count, 0);
});

Then('there is at least one problem in the problems panel', async () => {
    const count = await context.app.workbench.problems.getProblemCount();
    expect(count).to.greaterThan(0);
});

Then('there are at least {int} problems in the problems panel', async (expectedMinimumCount: number) => {
    const count = await context.app.workbench.problems.getProblemCount();
    expect(count).to.greaterThan(expectedMinimumCount - 1);
});

Then('there is a problem with the message {string}', async (message: string) => {
    const messages = await context.app.workbench.problems.getProblemMessages();
    expect(messages.join(', ').toLowerCase()).to.include(message.toLowerCase());
});

Then('there is a problem with the file named {string}', async (fileName: string) => {
    const messages = await context.app.workbench.problems.getProblemFiles();
    expect(messages.join(', ').toLowerCase()).to.include(fileName.toLowerCase());
});
