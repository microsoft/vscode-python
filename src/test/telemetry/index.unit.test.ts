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
import {
    _resetSharedProperties,
    clearTelemetryReporter,
    isTelemetryDisabled,
    sendTelemetryEvent,
    setSharedProperty
} from '../../client/telemetry';

suite('Telemetry', () => {
    let workspaceService: IWorkspaceService;
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;

    class Reporter {
        public static eventName: string[] = [];
        public static properties: Record<string, string>[] = [];
        public static measures: {}[] = [];
        public static errorProps: string[] | undefined;
        public static exception: Error | undefined;

        public static clear() {
            Reporter.eventName = [];
            Reporter.properties = [];
            Reporter.measures = [];
            Reporter.errorProps = undefined;
        }
        public sendTelemetryEvent(eventName: string, properties?: {}, measures?: {}) {
            Reporter.eventName.push(eventName);
            Reporter.properties.push(properties!);
            Reporter.measures.push(measures!);
        }
        public sendTelemetryErrorEvent(eventName: string, properties?: {}, measures?: {}, errorProps?: string[]) {
            this.sendTelemetryEvent(eventName, properties, measures);
            Reporter.errorProps = errorProps;
        }
        public sendTelemetryException(error: Error, properties?: {}, measures?: {}): void {
            this.sendTelemetryEvent('Exception', properties, measures);
            Reporter.exception = error;
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
        _resetSharedProperties();
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
        testsForisTelemetryDisabled.forEach((testParams) => {
            test(testParams.testName, async () => {
                const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
                workspaceConfig
                    .setup((c) => c.inspect<string>('enableTelemetry'))
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
    test('Send Telemetry with no properties', () => {
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';

        sendTelemetryEvent(eventName as any);

        expect(Reporter.eventName).to.deep.equal([eventName]);
        expect(Reporter.measures).to.deep.equal([undefined], 'Measures should be empty');
        expect(Reporter.properties).to.deep.equal([{}], 'Properties should be empty');
    });
    test('Send Telemetry with shared properties', () => {
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measures = { start: 123, end: 987 };
        const expectedProperties = { ...properties, one: 'two' };

        setSharedProperty('one' as any, 'two' as any);

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measures, properties as any);

        expect(Reporter.eventName).to.deep.equal([eventName]);
        expect(Reporter.measures).to.deep.equal([measures]);
        expect(Reporter.properties).to.deep.equal([expectedProperties]);
    });
    test('Shared properties will replace existing ones', () => {
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };
        const measures = { start: 123, end: 987 };
        const expectedProperties = { ...properties, foo: 'baz' };

        setSharedProperty('foo' as any, 'baz' as any);

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, measures, properties as any);

        expect(Reporter.eventName).to.deep.equal([eventName]);
        expect(Reporter.measures).to.deep.equal([measures]);
        expect(Reporter.properties).to.deep.equal([expectedProperties]);
    });
    test('Send Exception Telemetry', () => {
        rewiremock.enable();
        const error = new Error('Boo');
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const eventName = 'Testing';
        const properties = { hello: 'world', foo: 'bar' };

        // tslint:disable-next-line:no-any
        sendTelemetryEvent(eventName as any, {}, properties as any, error);

        const expectedErrorProperties = {
            originalEventName: eventName
        };

        expect(Reporter.properties).to.deep.equal([expectedErrorProperties]);
        expect(Reporter.exception).to.deep.equal(error);
    });
});
