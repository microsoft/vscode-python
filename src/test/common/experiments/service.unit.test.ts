// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as sinon from 'sinon';
import { instance, mock, when } from 'ts-mockito';
import * as tasClient from 'vscode-tas-client';
import { ApplicationEnvironment } from '../../../client/common/application/applicationEnvironment';
import { Channel, IApplicationEnvironment } from '../../../client/common/application/types';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { ExperimentService } from '../../../client/common/experiments/service';
import { IConfigurationService } from '../../../client/common/types';
import * as Telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';
import { PVSC_EXTENSION_ID_FOR_TESTS } from '../../constants';
import { MockMemento } from '../../mocks/mementos';

suite('Experimentation service', () => {
    const extensionVersion = '1.2.3';

    let configurationService: IConfigurationService;
    let appEnvironment: IApplicationEnvironment;
    let globalMemento: MockMemento;

    setup(() => {
        configurationService = mock(ConfigurationService);
        appEnvironment = mock(ApplicationEnvironment);
        globalMemento = new MockMemento();
    });

    teardown(() => {
        sinon.restore();
    });

    function configureSettings(enabled: boolean, optInto: string[], optOutFrom: string[]) {
        when(configurationService.getSettings(undefined)).thenReturn({
            experiments: {
                enabled,
                optInto,
                optOutFrom
            }
            // tslint:disable-next-line: no-any
        } as any);
    }

    function configureApplicationEnvironment(channel: Channel, version: string) {
        when(appEnvironment.channel).thenReturn(channel);
        when(appEnvironment.extensionName).thenReturn(PVSC_EXTENSION_ID_FOR_TESTS);
        when(appEnvironment.packageJson).thenReturn({ version });
    }

    suite('Initialization', () => {
        test('Users with a release version of the extension should be in the Public target population', () => {
            const getExperimentationServiceStub = sinon.stub(tasClient, 'getExperimentationService');

            configureSettings(true, [], []);
            configureApplicationEnvironment('stable', extensionVersion);

            // tslint:disable-next-line: no-unused-expression
            new ExperimentService(instance(configurationService), instance(appEnvironment), globalMemento);

            sinon.assert.calledWithExactly(
                getExperimentationServiceStub,
                PVSC_EXTENSION_ID_FOR_TESTS,
                extensionVersion,
                tasClient.TargetPopulation.Public,
                sinon.match.any,
                globalMemento
            );
        });

        test('Users with an Insiders version of the extension should be the Insiders target population', () => {
            const getExperimentationServiceStub = sinon.stub(tasClient, 'getExperimentationService');

            configureSettings(true, [], []);
            configureApplicationEnvironment('insiders', extensionVersion);

            // tslint:disable-next-line: no-unused-expression
            new ExperimentService(instance(configurationService), instance(appEnvironment), globalMemento);

            sinon.assert.calledWithExactly(
                getExperimentationServiceStub,
                PVSC_EXTENSION_ID_FOR_TESTS,
                extensionVersion,
                tasClient.TargetPopulation.Insiders,
                sinon.match.any,
                globalMemento
            );
        });

        test('Users can only opt into experiment groups', () => {
            sinon.stub(tasClient, 'getExperimentationService');

            configureSettings(true, ['Foo - experiment', 'Bar - control'], []);
            configureApplicationEnvironment('stable', extensionVersion);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );

            assert.deepEqual(experimentService._optInto, ['Foo - experiment']);
        });

        test('Users can only opt out of experiment groups', () => {
            sinon.stub(tasClient, 'getExperimentationService');
            configureSettings(true, [], ['Foo - experiment', 'Bar - control']);
            configureApplicationEnvironment('stable', extensionVersion);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );

            assert.deepEqual(experimentService._optOutFrom, ['Foo - experiment']);
        });
    });

    suite('In-experiment check', () => {
        const experiment = 'Test Experiment - experiment';
        let telemetryEvents: { eventName: string; properties: object }[] = [];
        let isCachedFlightEnabledStub: sinon.SinonStub;
        let sendTelemetryEventStub: sinon.SinonStub;

        setup(() => {
            sendTelemetryEventStub = sinon
                .stub(Telemetry, 'sendTelemetryEvent')
                .callsFake((eventName: string, _, properties: object) => {
                    const telemetry = { eventName, properties };
                    telemetryEvents.push(telemetry);
                });

            isCachedFlightEnabledStub = sinon.stub().returns(Promise.resolve(true));
            sinon.stub(tasClient, 'getExperimentationService').returns({
                isCachedFlightEnabled: isCachedFlightEnabledStub
                // tslint:disable-next-line: no-any
            } as any);

            configureApplicationEnvironment('stable', extensionVersion);
        });

        teardown(() => {
            telemetryEvents = [];
        });

        test('If the opt-in and opt-out arrays are empty, return the value from the experimentation framework for a given experiment', async () => {
            configureSettings(true, [], []);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );
            const result = await experimentService.inExperiment(experiment);

            assert.isTrue(result);
            sinon.assert.notCalled(sendTelemetryEventStub);
            sinon.assert.calledOnce(isCachedFlightEnabledStub);
        });

        test('If the experiment setting is disabled, inExperiment should return false', async () => {
            configureSettings(false, [], []);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );
            const result = await experimentService.inExperiment(experiment);

            assert.isFalse(result);
            sinon.assert.notCalled(sendTelemetryEventStub);
            sinon.assert.notCalled(isCachedFlightEnabledStub);
        });

        test('If the opt-in setting contains "All", inExperiment should return true', async () => {
            configureSettings(true, ['All'], []);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );
            const result = await experimentService.inExperiment(experiment);

            assert.isTrue(result);
            assert.equal(telemetryEvents.length, 1);
            assert.deepEqual(telemetryEvents[0], {
                eventName: EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT,
                properties: { expNameOptedInto: experiment }
            });
            sinon.assert.notCalled(isCachedFlightEnabledStub);
        });

        test('If the opt-in setting contains the experiment name, inExperiment should return true', async () => {
            configureSettings(true, [experiment], []);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );
            const result = await experimentService.inExperiment(experiment);

            assert.isTrue(result);
            assert.equal(telemetryEvents.length, 1);
            assert.deepEqual(telemetryEvents[0], {
                eventName: EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT,
                properties: { expNameOptedInto: experiment }
            });
            sinon.assert.notCalled(isCachedFlightEnabledStub);
        });

        test('If the opt-out setting contains "All", inExperiment should return false', async () => {
            configureSettings(true, [], ['All']);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );
            const result = await experimentService.inExperiment(experiment);

            assert.isFalse(result);
            assert.equal(telemetryEvents.length, 1);
            assert.deepEqual(telemetryEvents[0], {
                eventName: EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT,
                properties: { expNameOptedOutOf: experiment }
            });
            sinon.assert.notCalled(isCachedFlightEnabledStub);
        });

        test('If the opt-out setting contains the experiment name, inExperiment should return false', async () => {
            configureSettings(true, [], [experiment]);

            const experimentService = new ExperimentService(
                instance(configurationService),
                instance(appEnvironment),
                globalMemento
            );
            const result = await experimentService.inExperiment(experiment);

            assert.isFalse(result);
            assert.equal(telemetryEvents.length, 1);
            assert.deepEqual(telemetryEvents[0], {
                eventName: EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT,
                properties: { expNameOptedOutOf: experiment }
            });
            sinon.assert.notCalled(isCachedFlightEnabledStub);
        });
    });
});
