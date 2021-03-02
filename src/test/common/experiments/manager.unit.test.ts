// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ApplicationEnvironment } from '../../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment } from '../../../client/common/application/types';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { CryptoUtils } from '../../../client/common/crypto';
import {
    ExperimentsManager,
    experimentStorageKey,
    oldExperimentSalts,
} from '../../../client/common/experiments/manager';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import {
    ICryptoUtils,
    IExperiments,
    IOutputChannel,
    IPersistentState,
    IPersistentStateFactory,
} from '../../../client/common/types';
import { noop } from '../../core';

suite('A/B experiments', () => {
    let crypto: ICryptoUtils;
    let appEnvironment: IApplicationEnvironment;
    let persistentStateFactory: IPersistentStateFactory;
    let experimentStorage: TypeMoq.IMock<IPersistentState<any>>;
    let output: TypeMoq.IMock<IOutputChannel>;
    let fs: IFileSystem;
    let expManager: ExperimentsManager;
    let configurationService: ConfigurationService;
    let experiments: TypeMoq.IMock<IExperiments>;
    setup(() => {
        crypto = mock(CryptoUtils);
        appEnvironment = mock(ApplicationEnvironment);
        persistentStateFactory = mock(PersistentStateFactory);
        experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
        configurationService = mock(ConfigurationService);
        experiments = TypeMoq.Mock.ofType<IExperiments>();
        const settings = mock(PythonSettings);
        when(settings.experiments).thenReturn(experiments.object);
        experiments.setup((e) => e.optInto).returns(() => []);
        experiments.setup((e) => e.optOutFrom).returns(() => []);
        when(configurationService.getSettings(undefined)).thenReturn(instance(settings));
        fs = mock(FileSystem);
        when(persistentStateFactory.createGlobalPersistentState(experimentStorageKey, undefined as any)).thenReturn(
            experimentStorage.object,
        );
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService),
        );
    });

    teardown(() => {
        sinon.restore();
    });

    async function testEnablingExperiments(enabled: boolean) {
        const updateExperimentStorage = sinon.stub(ExperimentsManager.prototype, 'updateExperimentStorage');
        updateExperimentStorage.callsFake(() => Promise.resolve());
        const populateUserExperiments = sinon.stub(ExperimentsManager.prototype, 'populateUserExperiments');
        populateUserExperiments.callsFake(() => Promise.resolve());
        experiments
            .setup((e) => e.enabled)
            .returns(() => enabled)
            .verifiable(TypeMoq.Times.atLeastOnce());

        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService),
        );
        await expManager.activate();

        // If experiments are disabled, then none of these methods will be invoked & vice versa.
        assert.equal(updateExperimentStorage.callCount, enabled ? 1 : 0);
        assert.equal(populateUserExperiments.callCount, enabled ? 1 : 0);

        experiments.verifyAll();
    }
    test('Ensure experiments are not initialized when it is disabled', async () => testEnablingExperiments(false));

    test('Ensure experiments are initialized when it is enabled', async () => testEnablingExperiments(true));

    async function testEnablingExperimentsToCheckIfInExperiment(enabled: boolean) {
        const sendTelemetry = sinon.stub(ExperimentsManager.prototype, 'sendTelemetryIfInExperiment');
        sendTelemetry.callsFake((_: string) => noop());

        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService),
        );

        expManager._enabled = enabled;
        expManager.userExperiments.push({ name: 'this should be in experiment', max: 0, min: 0, salt: '' });

        // If experiments are disabled, then `inExperiment` will return false & vice versa.
        assert.equal(expManager.inExperiment('this should be in experiment'), enabled);
        // This experiment does not exist, hence `inExperiment` will always be `false` for this.
        assert.equal(expManager.inExperiment('this should never be in experiment'), false);

        experiments.verifyAll();
    }
    test('Ensure inExperiment is true when experiments are enabled', async () =>
        testEnablingExperimentsToCheckIfInExperiment(true));

    test('Ensure inExperiment is false when experiments are disabled', async () =>
        testEnablingExperimentsToCheckIfInExperiment(false));

    test('Ensure experiments can only be activated once', async () => {
        const updateExperimentStorage = sinon.stub(ExperimentsManager.prototype, 'updateExperimentStorage');
        updateExperimentStorage.callsFake(() => Promise.resolve());
        const populateUserExperiments = sinon.stub(ExperimentsManager.prototype, 'populateUserExperiments');
        populateUserExperiments.callsFake(() => Promise.resolve());
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            // instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService),
        );

        assert.isFalse(expManager._activated());
        await expManager.activate();

        // Ensure activated flag is set
        assert.isTrue(expManager._activated());
    });

    const testsForInExperiment = [
        {
            testName: "If experiment's name is not in user experiment list, user is not in experiment",
            experimentName: 'imaginary experiment',
            userExperiments: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            expectedResult: false,
        },
        {
            testName:
                "If experiment's name is in user experiment list and hash modulo output is in range, user is in experiment",
            experimentName: 'experiment1',
            userExperiments: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            expectedResult: true,
        },
    ];

    testsForInExperiment.forEach((testParams) => {
        test(testParams.testName, async () => {
            expManager.userExperiments = testParams.userExperiments;
            expect(expManager.inExperiment(testParams.experimentName)).to.equal(
                testParams.expectedResult,
                'Incorrectly identified',
            );
        });
    });

    const testsForIsUserInRange = [
        // Note min equals 79 and max equals 94
        {
            testName: 'Returns true if hash modulo output is in range',
            hash: 1181,
            expectedResult: true,
        },
        {
            testName: 'Returns false if hash modulo is less than min',
            hash: 967,
            expectedResult: false,
        },
        {
            testName: 'Returns false if hash modulo is more than max',
            hash: 3297,
            expectedResult: false,
        },
        {
            testName: 'If checking if user is in range fails with error, throw error',
            hash: 3297,
            error: true,
            expectedResult: false,
        },
        {
            testName: 'If machine ID is bogus, throw error',
            hash: 3297,
            machineIdError: true,
            expectedResult: false,
        },
    ];

    suite('Function IsUserInRange()', () => {
        testsForIsUserInRange.forEach((testParams) => {
            test(testParams.testName, async () => {
                when(appEnvironment.machineId).thenReturn('101');
                if (testParams.machineIdError) {
                    when(appEnvironment.machineId).thenReturn(undefined as any);
                    expect(() => expManager.isUserInRange(79, 94, 'salt')).to.throw();
                } else if (testParams.error) {
                    const error = new Error('Kaboom');
                    when(crypto.createHash(anything(), 'number', anything())).thenThrow(error);
                    expect(() => expManager.isUserInRange(79, 94, 'salt')).to.throw(error);
                } else {
                    when(crypto.createHash(anything(), 'number', anything())).thenReturn(testParams.hash);
                    expect(expManager.isUserInRange(79, 94, 'salt')).to.equal(
                        testParams.expectedResult,
                        'Incorrectly identified',
                    );
                }
            });
        });
        test('If experiment salt belongs to an old experiment, keep using `SHA512` algorithm', async () => {
            when(appEnvironment.machineId).thenReturn('101');
            when(crypto.createHash(anything(), 'number', 'SHA512')).thenReturn(644);
            when(crypto.createHash(anything(), anything(), 'FNV')).thenReturn(1293);
            // 'ShowPlayIcon' is one of the old experiments
            expManager.isUserInRange(79, 94, 'ShowPlayIcon');
            verify(crypto.createHash(anything(), 'number', 'SHA512')).once();
            verify(crypto.createHash(anything(), anything(), 'FNV')).never();
        });
        test('If experiment salt does not belong to an old experiment, use `FNV` algorithm', async () => {
            when(appEnvironment.machineId).thenReturn('101');
            when(crypto.createHash(anything(), anything(), 'SHA512')).thenReturn(644);
            when(crypto.createHash(anything(), 'number', 'FNV')).thenReturn(1293);
            expManager.isUserInRange(79, 94, 'NewExperimentSalt');
            verify(crypto.createHash(anything(), anything(), 'SHA512')).never();
            verify(crypto.createHash(anything(), 'number', 'FNV')).once();
        });
        test('Use the expected list of old experiments', async () => {
            const expectedOldExperimentSalts = [
                'ShowExtensionSurveyPrompt',
                'ShowPlayIcon',
                'AlwaysDisplayTestExplorer',
                'LS',
            ];
            assert.deepEqual(expectedOldExperimentSalts, oldExperimentSalts);
        });
    });

    const testsForPopulateUserExperiments = [
        {
            testName: 'User experiments list is empty if experiment storage value is not an array',
            experimentStorageValue: undefined,
            expectedResult: [],
        },
        {
            testName: 'User experiments list is empty if experiment storage value is an empty array',
            experimentStorageValue: [],
            expectedResult: [],
        },
        {
            testName:
                'User experiments list does not contain any experiments if user has requested to opt out of all experiments',
            experimentStorageValue: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 80, max: 90 },
            ],
            hash: 8187,
            experimentsOptedOutFrom: ['All'],
            expectedResult: [],
        },
        {
            testName:
                'User experiments list contains all experiments if user has requested to opt into all experiments',
            experimentStorageValue: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 80, max: 90 },
            ],
            hash: 8187,
            experimentsOptedInto: ['All'],
            expectedResult: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 80, max: 90 },
            ],
        },
        {
            testName:
                'User experiments list contains the experiment if user has requested to opt in a control group but is not in experiment range',
            experimentStorageValue: [{ name: 'experiment2 - control', salt: 'salt', min: 19, max: 30 }],
            hash: 8187,
            experimentsOptedInto: ['experiment2 - control'],
            expectedResult: [],
        },
        {
            testName:
                'User experiments list contains the experiment if user has requested to opt out of a control group but user is in experiment range',
            experimentStorageValue: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 19, max: 30 },
            ],
            hash: 8187,
            experimentsOptedOutFrom: ['experiment1 - control'],
            expectedResult: [{ name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 }],
        },
        {
            testName:
                'User experiments list does not contains the experiment if user has opted out of experiment even though user is in experiment range',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            hash: 8187,
            experimentsOptedOutFrom: ['experiment1'],
            expectedResult: [],
        },
        {
            testName:
                'User experiments list contains the experiment if user has opted into the experiment even though user is not in experiment range',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            hash: 8187,
            experimentsOptedInto: ['experiment1'],
            expectedResult: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }],
        },
        {
            testName:
                'User experiments list contains the experiment user has opened into and not the control experiment even if user is in the control experiment range',
            experimentStorageValue: [
                { name: 'control', salt: 'salt', min: 0, max: 100 },
                { name: 'experiment', salt: 'salt', min: 0, max: 0 },
            ],
            hash: 8187,
            experimentsOptedInto: ['experiment'],
            expectedResult: [{ name: 'experiment', salt: 'salt', min: 0, max: 0 }],
        },
        {
            testName:
                'User experiments list does not contain the experiment if user has both opted in and out of an experiment',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            hash: 8187,
            experimentsOptedInto: ['experiment1'],
            experimentsOptedOutFrom: ['experiment1'],
            expectedResult: [],
        },
        {
            testName: 'Otherwise user experiments list contains the experiment if user is in experiment range',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            hash: 8187,
            expectedResult: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }],
        },
    ];

    suite('Function populateUserExperiments', async () => {
        testsForPopulateUserExperiments.forEach((testParams) => {
            test(testParams.testName, async () => {
                experimentStorage.setup((n) => n.value).returns(() => testParams.experimentStorageValue);
                when(appEnvironment.machineId).thenReturn('101');
                if (testParams.hash) {
                    when(crypto.createHash(anything(), 'number', anything())).thenReturn(testParams.hash);
                }
                if (testParams.experimentsOptedInto) {
                    expManager._experimentsOptedInto = testParams.experimentsOptedInto;
                }
                if (testParams.experimentsOptedOutFrom) {
                    expManager._experimentsOptedOutFrom = testParams.experimentsOptedOutFrom;
                }
                expManager.populateUserExperiments();
                assert.deepEqual(expManager.userExperiments, testParams.expectedResult);
            });
        });
    });

    const testsForAreExperimentsValid = [
        {
            testName: 'If experiments are not an array, return false',
            experiments: undefined,
            expectedResult: false,
        },
        {
            testName: 'If any experiment have `min` field missing, return false',
            experiments: [
                { name: 'experiment1', salt: 'salt', max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            expectedResult: false,
        },
        {
            testName: 'If any experiment have `max` field missing, return false',
            experiments: [
                { name: 'experiment1', salt: 'salt', min: 79 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            expectedResult: false,
        },
        {
            testName: 'If any experiment have `salt` field missing, return false',
            experiments: [
                { name: 'experiment1', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            expectedResult: false,
        },
        {
            testName: 'If any experiment have `name` field missing, return false',
            experiments: [
                { salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            expectedResult: false,
        },
        {
            testName: 'If all experiments contain all the fields in type `ABExperiment`, return true',
            experiments: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 },
            ],
            expectedResult: true,
        },
    ];

    suite('Function areExperimentsValid()', () => {
        testsForAreExperimentsValid.forEach((testParams) => {
            test(testParams.testName, () => {
                expect(expManager.areExperimentsValid(testParams.experiments as any)).to.equal(
                    testParams.expectedResult,
                );
            });
        });
    });
});
