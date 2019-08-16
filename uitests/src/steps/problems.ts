// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-invalid-this

import * as assert from 'assert';
import { expect } from 'chai';
import { Then } from 'cucumber';
import { CucumberRetryMax5Seconds } from '../constants';

// Wait for some time as it take take at least 1s to appear.
// Surely problems won't take more than 5 seconds to appear.
// Why 5? Well, needs to be > 1, but most certainly not more than 5.

Then('there are no problems in the problems panel', CucumberRetryMax5Seconds, async function() {
    const count = await this.app.problems.getProblemCount();
    assert.equal(count, 0);
});

Then('there is at least one problem in the problems panel', CucumberRetryMax5Seconds, async function() {
    const count = await this.app.problems.getProblemCount();
    expect(count).to.greaterThan(0);
});

Then('there are at least {int} problems in the problems panel', CucumberRetryMax5Seconds, async function(expectedMinimumCount: number) {
    const count = await this.app.problems.getProblemCount();
    expect(count).to.greaterThan(expectedMinimumCount - 1);
});

Then('there is a problem with the message {string}', CucumberRetryMax5Seconds, async function(message: string) {
    const messages = await this.app.problems.getProblemMessages();
    expect(messages.join(', ').toLowerCase()).to.include(message.toLowerCase());
});

Then('there is a problem with the file named {string}', CucumberRetryMax5Seconds, async function(fileName: string) {
    const messages = await this.app.problems.getProblemFiles();
    expect(messages.join(', ').toLowerCase()).to.include(fileName.toLowerCase());
});
