// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length no-use-before-declare

import { expect } from 'chai';
import { DebugSession } from 'vscode-debugadapter';
import { StoppedEvent } from 'vscode-debugadapter/lib/debugSession';
import { DebugProtocol } from 'vscode-debugprotocol';
import { TelemetryEvent } from '../../client/debugger/Common/Contracts';
import {
    capturePerformanceTelemetry,
    PerformanceTelemetryCondition,
    sendPerformanceTelemetry
} from '../../client/debugger/Common/telemetry';
import { DebuggerPerformanceTelemetry } from '../../client/telemetry/types';
import { sleep } from '../common';
import { initialize } from '../initialize';

suite('Debugging - Performance Telemetry', () => {
    suiteSetup(initialize);
    setup(() => MockDebugSession.TelemetryEvents = []);

    function testTelemetryEvents(expectedActions: string[]) {
        expect(MockDebugSession.TelemetryEvents).lengthOf(expectedActions.length, 'Incorrect number of events');
        const actions = MockDebugSession.TelemetryEvents.map(item => (item.body.data as DebuggerPerformanceTelemetry).action);
        expect(actions).deep.equal(expectedActions, 'Incorrect actions');
    }

    test('Event = load', async () => {
        const session = new MockDebugSession();
        session.launchRequest();
        await sleep(501);
        session.onPythonProcessLoaded();
        testTelemetryEvents(['launch']);
        expect((MockDebugSession.TelemetryEvents[0].body.data as DebuggerPerformanceTelemetry).duration).greaterThan(500, 'incorrect duration');
    });

    test('Event = stopped for stepin', async () => {
        const session = new MockDebugSession();
        session.launchRequest();
        session.onPythonProcessLoaded();
        session.stepInRequest();
        session.sendEvent(new StoppedEvent('some reason', 0));

        testTelemetryEvents(['launch', 'stepIn']);
    });

    test('Event = stopped for stepout', async () => {
        const session = new MockDebugSession();
        session.launchRequest();
        session.onPythonProcessLoaded();
        session.stepOutRequest();
        session.sendEvent(new StoppedEvent('some reason', 0));

        testTelemetryEvents(['launch', 'stepOut']);
    });

    test('Event = stopped for continue', async () => {
        const session = new MockDebugSession();
        session.launchRequest();
        session.onPythonProcessLoaded();
        session.continueRequest();
        session.sendEvent(new StoppedEvent('some reason', 0));

        testTelemetryEvents(['launch', 'continue']);
    });

    test('Event = stopped for next', async () => {
        const session = new MockDebugSession();
        session.launchRequest();
        session.onPythonProcessLoaded();
        session.nextRequest();
        session.sendEvent(new StoppedEvent('some reason', 0));

        testTelemetryEvents(['launch', 'next']);
    });

    test('Event = stopped for stepout, next, stepin', async () => {
        const session = new MockDebugSession();
        session.launchRequest();
        session.onPythonProcessLoaded();
        session.stepOutRequest();
        session.sendEvent(new StoppedEvent('some reason', 0));
        session.nextRequest();
        session.sendEvent(new StoppedEvent('some reason', 0));
        session.stepInRequest();
        session.sendEvent(new StoppedEvent('some reason', 0));

        testTelemetryEvents(['launch', 'stepOut', 'next', 'stepIn']);
    });
});

class MockDebugSession extends DebugSession {
    public static TelemetryEvents: TelemetryEvent[] = [];
    constructor() {
        super();
    }

    @capturePerformanceTelemetry('launch')
    // tslint:disable-next-line:no-empty
    public launchRequest(): void {
    }
    // tslint:disable-next-line:no-unnecessary-override
    @sendPerformanceTelemetry(PerformanceTelemetryCondition.stoppedEvent)
    // tslint:disable-next-line:no-empty
    public sendEvent(event: DebugProtocol.Event): void {
        if (event instanceof TelemetryEvent) {
            MockDebugSession.TelemetryEvents.push(event);
        }
    }
    @sendPerformanceTelemetry(PerformanceTelemetryCondition.always)
    // tslint:disable-next-line:no-empty
    public onPythonProcessLoaded() {
    }
    @capturePerformanceTelemetry('stepIn')
    // tslint:disable-next-line:no-empty
    public stepInRequest(): void {
    }
    @capturePerformanceTelemetry('stepOut')
    // tslint:disable-next-line:no-empty
    public stepOutRequest(): void {
    }
    @capturePerformanceTelemetry('continue')
    // tslint:disable-next-line:no-empty
    public continueRequest(): void {
    }
    @capturePerformanceTelemetry('next')
    // tslint:disable-next-line:no-empty
    public nextRequest(): void {
    }
}
