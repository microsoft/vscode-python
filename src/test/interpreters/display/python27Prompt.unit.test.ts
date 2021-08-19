// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../client/common/application/types';
import { PersistentState, PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentStateFactory } from '../../../client/common/types';
import { Python27Support, Common } from '../../../client/common/utils/localize';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { Python27SupportPrompt } from '../../../client/interpreter/display/python27Prompt';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import * as Telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';

suite('Python 2.7 support prompt', () => {
    let applicationShell: IApplicationShell;
    let interpreterService: IInterpreterService;
    let persistentStateFactory: IPersistentStateFactory;
    let state: PersistentState<boolean>;
    let sendTelemetryEventStub: sinon.SinonStub;
    let telemetryEvents: { eventName: string; properties: Record<string, unknown> }[] = [];

    setup(() => {
        applicationShell = mock(ApplicationShell);
        interpreterService = mock(InterpreterService);
        persistentStateFactory = mock(PersistentStateFactory);
        state = mock(PersistentState) as PersistentState<boolean>;

        when(persistentStateFactory.createGlobalPersistentState<boolean>(anything(), anything())).thenReturn(
            instance(state),
        );
        when(applicationShell.showInformationMessage(Python27Support.bannerMessage(), Common.gotIt())).thenResolve(
            undefined,
        );

        sendTelemetryEventStub = sinon
            .stub(Telemetry, 'sendTelemetryEvent')
            .callsFake((eventName: string, _, properties: Record<string, unknown>) => {
                const telemetry = { eventName, properties };
                telemetryEvents.push(telemetry);
            });
    });

    teardown(() => {
        sinon.restore();
        Telemetry._resetSharedProperties();
        telemetryEvents = [];
    });

    type TestCaseType = {
        doNotShow: boolean;
        interpreter: { version: { major: number; minor: number } };
        getActiveInterpreterCalled: boolean;
        expected: boolean;
    };

    const testCases: TestCaseType[] = [
        {
            doNotShow: false,
            interpreter: { version: { major: 2, minor: 7 } },
            getActiveInterpreterCalled: true,
            expected: true,
        },
        {
            doNotShow: false,
            interpreter: { version: { major: 3, minor: 9 } },
            getActiveInterpreterCalled: true,
            expected: false,
        },
        {
            doNotShow: true,
            interpreter: { version: { major: 2, minor: 7 } },
            getActiveInterpreterCalled: false,
            expected: false,
        },
        {
            doNotShow: true,
            interpreter: { version: { major: 3, minor: 9 } },
            getActiveInterpreterCalled: false,
            expected: false,
        },
    ];

    testCases.forEach(({ doNotShow, interpreter, getActiveInterpreterCalled, expected }) => {
        const testTitle = `Should${
            !expected ? ' not' : ''
        } show prompt if do not show is ${doNotShow} and interpreter is ${interpreter.version.major}.${
            interpreter.version.minor
        }`;

        test(testTitle, async () => {
            when(state.value).thenReturn(doNotShow);
            when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter as PythonEnvironment);

            const python27SupportPrompt = new Python27SupportPrompt(
                instance(applicationShell),
                instance(interpreterService),
                instance(persistentStateFactory),
            );

            const result = await python27SupportPrompt.shouldShowPrompt();

            assert.strictEqual(result, expected);
            if (getActiveInterpreterCalled) {
                verify(interpreterService.getActiveInterpreter(anything())).once();
            } else {
                verify(interpreterService.getActiveInterpreter(anything())).never();
            }
        });
    });

    test('Should not show prompt if it has been shown earlier in the session', async () => {
        const python27SupportPrompt = new Python27SupportPrompt(
            instance(applicationShell),
            instance(interpreterService),
            instance(persistentStateFactory),
        );

        await python27SupportPrompt.showPrompt();

        const result = await python27SupportPrompt.shouldShowPrompt();

        assert.strictEqual(result, false);
    });

    /*
     * showPrompt
     * if gotit -> should write in persistent state
     * if no got it -> should not write in persistent state
     * telemetry should be sent
     */

    suite('showPrompt', () => {
        test('If the prompt was closed with the button write in persistent state', async () => {
            const appShell = mock(ApplicationShell);

            when(appShell.showInformationMessage(Python27Support.bannerMessage(), Common.gotIt())).thenReturn(
                Promise.resolve(Common.gotIt()),
            );

            const python27SupportPrompt = new Python27SupportPrompt(
                instance(appShell),
                instance(interpreterService),
                instance(persistentStateFactory),
            );

            await python27SupportPrompt.showPrompt();

            verify(state.updateValue(true)).once();
        });

        test('If the prompt was not closed with the button do not write in persistent state', async () => {
            const appShell = mock(ApplicationShell);

            when(appShell.showInformationMessage(Python27Support.bannerMessage(), Common.gotIt())).thenResolve(
                undefined,
            );

            const python27SupportPrompt = new Python27SupportPrompt(
                instance(appShell),
                instance(interpreterService),
                instance(persistentStateFactory),
            );

            await python27SupportPrompt.showPrompt();

            verify(state.updateValue(true)).never();
        });

        test('Telemetry event should be sent when prompt is shown', async () => {
            const python27SupportPrompt = new Python27SupportPrompt(
                instance(applicationShell),
                instance(interpreterService),
                instance(persistentStateFactory),
            );

            await python27SupportPrompt.showPrompt();

            sinon.assert.calledOnce(sendTelemetryEventStub);
            assert.deepStrictEqual(telemetryEvents, [
                { eventName: EventName.PYTHON_27_SUPPORT_PROMPT, properties: undefined },
            ]);
        });
    });
});
