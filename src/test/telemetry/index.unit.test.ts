// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

//tslint:disable:max-func-body-length match-default-export-name no-any
import { expect } from 'chai';
import rewiremock from 'rewiremock';
import * as TypeMoq from 'typemoq';

import { instance, mock, verify, when } from 'ts-mockito';
import { WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { clearTelemetryReporter, isTelemetryDisabled, sendTelemetryEvent } from '../../client/telemetry';

suite('Telemetry', () => {
    let workspaceService: IWorkspaceService;
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;

    class Reporter {
        public static eventName: string[] = [];
        public static properties: Record<string, string>[] = [];
        public static measures: {}[] = [];
        public static clear() {
            Reporter.eventName = [];
            Reporter.properties = [];
            Reporter.measures = [];
        }
        public sendTelemetryEvent(eventName: string, properties?: {}, measures?: {}) {
            Reporter.eventName.push(eventName);
            Reporter.properties.push(properties!);
            Reporter.measures.push(measures!);
        }
    }

    setup(() => {
        workspaceService = mock(WorkspaceService);
        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;
        clearTelemetryReporter();
        Reporter.clear();
    });
    teardown(() => {
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
        rewiremock.disable();
    });

    const testsForisTelemetryDisabled = [
        {
            testName: 'Returns true when globalValue is set to false',
            settings: { globalValue: false },
            expectedResult: true
        },
        {
            testName: 'Returns false otherwise',
            settings: {},
            expectedResult: false
        }
    ];

    suite('Function isTelemetryDisabled()', () => {
        testsForisTelemetryDisabled.forEach(testParams => {
            test(testParams.testName, async () => {
                const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
                workspaceConfig
                    .setup(c => c.inspect<string>('enableTelemetry'))
                    .returns(() => testParams.settings as any)
                    .verifiable(TypeMoq.Times.once());

                expect(isTelemetryDisabled(instance(workspaceService))).to.equal(testParams.expectedResult);

                verify(workspaceService.getConfiguration('telemetry')).once();
                workspaceConfig.verifyAll();
            });
        });
    });

    test('Send Telemetry', () => {
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measures = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measures, properties as any);

        expect(Reporter.eventName).to.deep.equal([eventName]);
        expect(Reporter.measures).to.deep.equal([measures]);
        expect(Reporter.properties).to.deep.equal([properties]);
    });
    test('Send Telemetry', () => {
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';

        sendTelemetryEvent(eventName as any);

        expect(Reporter.eventName).to.deep.equal([eventName]);
        expect(Reporter.measures).to.deep.equal([undefined], 'Measures should be empty');
        expect(Reporter.properties).to.deep.equal([{}], 'Properties should be empty');
    });
    test('Send Error Telemetry', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measures = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measures, properties as any, error);

        const expectedErrorProperties = {
            originalEventName: eventName
        };

        expect(Reporter.eventName).to.deep.equal(['ERROR', eventName]);
        expect(Reporter.measures).to.deep.equal([measures, measures]);
        expect(Reporter.properties[0].stackTrace).to.be.length.greaterThan(1);
        delete Reporter.properties[0].stackTrace;
        expect(Reporter.properties).to.deep.equal([expectedErrorProperties, properties]);
    });
    test('Send Error Telemetry', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        error.stack = [
            'Error: Boo',
            `at Context.test (${EXTENSION_ROOT_DIR}/src/test/telemetry/index.unit.test.ts:50:23)`,
            `at callFn (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:372:21)`,
            `at Test.Runnable.run (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:364:7)`,
            `at Runner.runTest (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:455:10)`,
            `at ${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:573:12`,
            `at next (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:369:14)`,
            `at ${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:379:7`,
            `at next (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:303:14)`,
            `at ${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:342:7`,
            `at done (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:319:5)`,
            `at callFn (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:395:7)`,
            `at Hook.Runnable.run (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:364:7)`,
            `at next (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:317:10)`,
            `at Immediate.<anonymous> (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:347:5)`,
            'at runCallback (timers.js:789:20)',
            'at tryOnImmediate (timers.js:751:5)',
            'at processImmediate [as _immediateCallback] (timers.js:722:5)'
        ].join('\n\t');
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measures = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measures, properties as any, error);

        const expectedErrorProperties = {
            originalEventName: eventName
        };

        const stackTrace = Reporter.properties[0].stackTrace;
        delete Reporter.properties[0].stackTrace;

        expect(Reporter.eventName).to.deep.equal(['ERROR', eventName]);
        expect(Reporter.measures).to.deep.equal([measures, measures]);
        expect(Reporter.properties).to.deep.equal([expectedErrorProperties, properties]);
        expect(stackTrace).to.be.length.greaterThan(1);

        const expectedStack = [
            'at Context.test <pvsc>/src/test/telemetry/index.unit.test.ts:50:23\n\tat callFn <pvsc>/node_modules/mocha/lib/runnable.js:372:21',
            'at Test.Runnable.run <pvsc>/node_modules/mocha/lib/runnable.js:364:7',
            'at Runner.runTest <pvsc>/node_modules/mocha/lib/runner.js:455:10',
            'at  <pvsc>/node_modules/mocha/lib/runner.js:573:12',
            'at next <pvsc>/node_modules/mocha/lib/runner.js:369:14',
            'at  <pvsc>/node_modules/mocha/lib/runner.js:379:7',
            'at next <pvsc>/node_modules/mocha/lib/runner.js:303:14',
            'at  <pvsc>/node_modules/mocha/lib/runner.js:342:7',
            'at done <pvsc>/node_modules/mocha/lib/runnable.js:319:5',
            'at callFn <pvsc>/node_modules/mocha/lib/runnable.js:395:7',
            'at Hook.Runnable.run <pvsc>/node_modules/mocha/lib/runnable.js:364:7',
            'at next <pvsc>/node_modules/mocha/lib/runner.js:317:10',
            'at Immediate <pvsc>/node_modules/mocha/lib/runner.js:347:5',
            'at runCallback <hidden>/timers.js:789:20',
            'at tryOnImmediate <hidden>/timers.js:751:5',
            'at processImmediate [as _immediateCallback] <hidden>/timers.js:722:5'
        ].join('\n\t');

        expect(stackTrace).to.be.equal(expectedStack);
    });
    test('Ensure non extension file paths are stripped from stack trace', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        error.stack = [
            'Error: Boo',
            `at Context.test (${EXTENSION_ROOT_DIR}/src/test/telemetry/index.unit.test.ts:50:23)`,
            'at callFn (c:/one/two/user/node_modules/mocha/lib/runnable.js:372:21)',
            'at Test.Runnable.run (/usr/Paul/Homer/desktop/node_modules/mocha/lib/runnable.js:364:7)',
            'at Runner.runTest (\\wowwee/node_modules/mocha/lib/runner.js:455:10)',
            `at Immediate.<anonymous> (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:347:5)`
        ].join('\n\t');
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measures = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measures, properties as any, error);

        const expectedErrorProperties = {
            originalEventName: eventName
        };

        const stackTrace = Reporter.properties[0].stackTrace;
        delete Reporter.properties[0].stackTrace;

        expect(Reporter.eventName).to.deep.equal(['ERROR', eventName]);
        expect(Reporter.measures).to.deep.equal([measures, measures]);
        expect(Reporter.properties).to.deep.equal([expectedErrorProperties, properties]);
        expect(stackTrace).to.be.length.greaterThan(1);

        const expectedStack = [
            'at Context.test <pvsc>/src/test/telemetry/index.unit.test.ts:50:23',
            'at callFn <hidden>/runnable.js:372:21',
            'at Test.Runnable.run <hidden>/runnable.js:364:7',
            'at Runner.runTest <hidden>/runner.js:455:10',
            'at Immediate <pvsc>/node_modules/mocha/lib/runner.js:347:5'
        ].join('\n\t');

        expect(stackTrace).to.be.equal(expectedStack);
    });
    test('Ensure non function names containing file names (unlikely, but for sake of completeness) are stripped from stack trace', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        error.stack = [
            'Error: Boo',
            `at Context.test (${EXTENSION_ROOT_DIR}/src/test/telemetry/index.unit.test.ts:50:23)`,
            'at callFn (c:/one/two/user/node_modules/mocha/lib/runnable.js:372:21)',
            'at Test./usr/Paul/Homer/desktop/node_modules/mocha/lib/runnable.run (/usr/Paul/Homer/desktop/node_modules/mocha/lib/runnable.js:364:7)',
            'at Runner.runTest (\\wowwee/node_modules/mocha/lib/runner.js:455:10)',
            `at Immediate.<anonymous> (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:347:5)`
        ].join('\n\t');
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measures = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measures, properties as any, error);

        const expectedErrorProperties = {
            originalEventName: eventName
        };

        const stackTrace = Reporter.properties[0].stackTrace;
        delete Reporter.properties[0].stackTrace;

        expect(Reporter.eventName).to.deep.equal(['ERROR', eventName]);
        expect(Reporter.measures).to.deep.equal([measures, measures]);
        expect(Reporter.properties).to.deep.equal([expectedErrorProperties, properties]);
        expect(stackTrace).to.be.length.greaterThan(1);

        const expectedStack = [
            'at Context.test <pvsc>/src/test/telemetry/index.unit.test.ts:50:23',
            'at callFn <hidden>/runnable.js:372:21',
            'at <hidden>.run <hidden>/runnable.js:364:7',
            'at Runner.runTest <hidden>/runner.js:455:10',
            'at Immediate <pvsc>/node_modules/mocha/lib/runner.js:347:5'
        ].join('\n\t');

        expect(stackTrace).to.be.equal(expectedStack);
    });
});
