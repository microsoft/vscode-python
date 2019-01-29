// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

//tslint:disable:max-func-body-length match-default-export-name no-any

import { expect } from 'chai';
import rewiremock from 'rewiremock';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { sendTelemetryEvent } from '../../client/telemetry';
import { correctPathForOsType } from '../common';

suite('Telemetry', () => {
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;
    setup(() => {
        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;
    });
    teardown(() => {
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
        rewiremock.disable();
    });

    class Reporter {
        public static eventName: string;
        public static properties: Record<string, string>;
        public static measures: {};
        public sendTelemetryEvent(eventName: string, properties?: {}, measures?: {}) {
            Reporter.eventName = eventName;
            Reporter.properties = properties!;
            Reporter.measures = measures!;
        }
    }
    test('Send Telemetry', () => {
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measuers = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measuers, properties as any);

        expect(Reporter.eventName).to.equal(eventName);
        expect(Reporter.measures).to.deep.equal(measuers);
        expect(Reporter.properties).to.deep.equal(properties);
    });
    test('Send Telemetry', () => {
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';

        sendTelemetryEvent(eventName as any);

        expect(Reporter.eventName).to.equal(eventName);
        expect(Reporter.measures).to.equal(undefined, 'Measures should be empty');
        expect(Reporter.properties).to.deep.equal({}, 'Properties should be empty');
    });
    test('Send Error Telemetry', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measuers = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measuers, properties as any, error);

        const stackTrace = Reporter.properties.stackTrace;
        delete Reporter.properties.stackTrace;

        expect(Reporter.eventName).to.equal(eventName);
        expect(Reporter.measures).to.deep.equal(measuers);
        expect(Reporter.properties).to.deep.equal({ ...properties, originalEventName: eventName });
        expect(stackTrace).to.be.length.greaterThan(1);
    });
    test('Send Error Telemetry', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        error.stack = correctPathForOsType(`Error: Boo
at Context.test (${EXTENSION_ROOT_DIR}/src/test/telemetry/index.unit.test.ts:50:23)
at callFn (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:372:21)
at Test.Runnable.run (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:364:7)
at Runner.runTest (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:455:10)
at ${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:573:12
at next (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:369:14)
at ${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:379:7
at next (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:303:14)
at ${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:342:7
at done (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:319:5)
at callFn (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:395:7)
at Hook.Runnable.run (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runnable.js:364:7)
at next (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:317:10)
at Immediate.<anonymous> (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:347:5)
at runCallback (timers.js:789:20)
at tryOnImmediate (timers.js:751:5)
at processImmediate [as _immediateCallback] (timers.js:722:5)`);
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measuers = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measuers, properties as any, error);

        const stackTrace = Reporter.properties.stackTrace;
        delete Reporter.properties.stackTrace;

        expect(Reporter.eventName).to.equal(eventName);
        expect(Reporter.measures).to.deep.equal(measuers);
        expect(Reporter.properties).to.deep.equal({ ...properties, originalEventName: eventName });
        expect(stackTrace).to.be.length.greaterThan(1);

        // tslint:disable-next-line:no-multiline-string
        const expectedStack = correctPathForOsType(`at Context.test <pvsc>/src/test/telemetry/index.unit.test.ts:50:23
\tat callFn <pvsc>/node_modules/mocha/lib/runnable.js:372:21
\tat Test.Runnable.run <pvsc>/node_modules/mocha/lib/runnable.js:364:7
\tat Runner.runTest <pvsc>/node_modules/mocha/lib/runner.js:455:10
\tat  <pvsc>/node_modules/mocha/lib/runner.js:573:12
\tat next <pvsc>/node_modules/mocha/lib/runner.js:369:14
\tat  <pvsc>/node_modules/mocha/lib/runner.js:379:7
\tat next <pvsc>/node_modules/mocha/lib/runner.js:303:14
\tat  <pvsc>/node_modules/mocha/lib/runner.js:342:7
\tat done <pvsc>/node_modules/mocha/lib/runnable.js:319:5
\tat callFn <pvsc>/node_modules/mocha/lib/runnable.js:395:7
\tat Hook.Runnable.run <pvsc>/node_modules/mocha/lib/runnable.js:364:7
\tat next <pvsc>/node_modules/mocha/lib/runner.js:317:10
\tat Immediate <pvsc>/node_modules/mocha/lib/runner.js:347:5
\tat runCallback <hidden>/timers.js:789:20
\tat tryOnImmediate <hidden>/timers.js:751:5
\tat processImmediate [as _immediateCallback] <hidden>/timers.js:722:5`);

        expect(stackTrace).to.be.equal(expectedStack);
    });
    test('Ensure non extension file paths are stripped from stack trace', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        error.stack = correctPathForOsType(`Error: Boo
at Context.test (${EXTENSION_ROOT_DIR}/src/test/telemetry/index.unit.test.ts:50:23)
at callFn (c:/one/two/user/node_modules/mocha/lib/runnable.js:372:21)
at Test.Runnable.run (/usr/Paul/Homer/desktop/node_modules/mocha/lib/runnable.js:364:7)
at Runner.runTest (\\wow\wee/node_modules/mocha/lib/runner.js:455:10)
at Immediate.<anonymous> (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:347:5)`);
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measuers = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measuers, properties as any, error);

        const stackTrace = Reporter.properties.stackTrace;
        delete Reporter.properties.stackTrace;

        expect(Reporter.eventName).to.equal(eventName);
        expect(Reporter.measures).to.deep.equal(measuers);
        expect(Reporter.properties).to.deep.equal({ ...properties, originalEventName: eventName });
        expect(stackTrace).to.be.length.greaterThan(1);

        // tslint:disable-next-line:no-multiline-string
        const expectedStack = correctPathForOsType(`at Context.test <pvsc>/src/test/telemetry/index.unit.test.ts:50:23
\tat callFn <hidden>/runnable.js:372:21
\tat Test.Runnable.run <hidden>/runnable.js:364:7
\tat Runner.runTest <hidden>/runner.js:455:10
\tat Immediate <pvsc>/node_modules/mocha/lib/runner.js:347:5`);

        expect(stackTrace).to.be.equal(expectedStack);
    });
    test('Ensure non function names containing file names (unlikely, but for sake of completeness) are stripped from stack trace', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        error.stack = correctPathForOsType(`Error: Boo
at Context.test (${EXTENSION_ROOT_DIR}/src/test/telemetry/index.unit.test.ts:50:23)
at callFn (c:/one/two/user/node_modules/mocha/lib/runnable.js:372:21)
at Test./usr/Paul/Homer/desktop/node_modules/mocha/lib/runnable.run (/usr/Paul/Homer/desktop/node_modules/mocha/lib/runnable.js:364:7)
at Runner.runTest (\\wow\wee/node_modules/mocha/lib/runner.js:455:10)
at Immediate.<anonymous> (${EXTENSION_ROOT_DIR}/node_modules/mocha/lib/runner.js:347:5)`);
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measuers = { start: 123, end: 987 };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measuers, properties as any, error);

        const stackTrace = Reporter.properties.stackTrace;
        delete Reporter.properties.stackTrace;

        expect(Reporter.eventName).to.equal(eventName);
        expect(Reporter.measures).to.deep.equal(measuers);
        expect(Reporter.properties).to.deep.equal({ ...properties, originalEventName: eventName });
        expect(stackTrace).to.be.length.greaterThan(1);

        // tslint:disable-next-line:no-multiline-string
        const expectedStack = correctPathForOsType(`at Context.test <pvsc>/src/test/telemetry/index.unit.test.ts:50:23
\tat callFn <hidden>/runnable.js:372:21
\tat <hidden>.run <hidden>/runnable.js:364:7
\tat Runner.runTest <hidden>/runner.js:455:10
\tat Immediate <pvsc>/node_modules/mocha/lib/runner.js:347:5`);

        expect(stackTrace).to.be.equal(expectedStack);
    });
});
