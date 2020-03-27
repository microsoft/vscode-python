// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
//tslint:disable:max-func-body-length match-default-export-name no-any no-multiline-string no-trailing-whitespace
import { expect } from 'chai';

import { DebugLocationTracker } from '../../client/datascience/debugLocationTracker';
import { IDebugLocation } from '../../client/datascience/types';

suite('Debug Location Tracker', () => {
    let debugTracker: DebugLocationTracker;

    setup(() => {
        debugTracker = new DebugLocationTracker('1');
    });

    test('Check debug location', async () => {
        expect(debugTracker.debugLocation).to.be.equal(undefined, 'Initial location is empty');

        debugTracker.onDidSendMessage(makeStopMessage());

        expect(debugTracker.debugLocation).to.be.equal(undefined, 'After stop location is empty');

        debugTracker.onDidSendMessage(makeStackTraceMessage());

        const testLocation: IDebugLocation = { lineNumber: 1, column: 1, fileName: 'testpath' };
        expect(debugTracker.debugLocation).to.be.deep.equal(testLocation, 'Source location is incorrect');

        debugTracker.onDidSendMessage(makeContinueMessage());

        expect(debugTracker.debugLocation).to.be.equal(undefined, 'After continue location is empty');
    });
});

function makeStopMessage(): any {
    return { type: 'event', event: 'stopped' };
}

function makeContinueMessage(): any {
    return { type: 'event', event: 'continue' };
}

function makeStackTraceMessage(): any {
    return {
        type: 'response',
        command: 'stackTrace',
        body: {
            stackFrames: [{ line: 1, column: 1, source: { path: 'testpath' } }]
        }
    };
}
