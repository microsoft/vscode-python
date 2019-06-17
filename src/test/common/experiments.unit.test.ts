// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { assert, expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { CryptoUtils } from '../../client/common/crypto';
import { configUri, downloadedExperimentStorageKey, ExperimentsManager, experimentStorageKey, isDownloadedStorageValidKey } from '../../client/common/experiments';
import { HttpClient } from '../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import { ABExperiments, ICryptoUtils, IHttpClient, IOutputChannel, IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { createDeferred, createDeferredFromPromise } from '../../client/common/utils/async';
import { sleep } from '../common';

// tslint:disable-next-line: max-func-body-length
suite('xA/B experiments', () => {
    let workspaceService: IWorkspaceService;
    let httpClient: IHttpClient;
    let crypto: ICryptoUtils;
    let appEnvironment: IApplicationEnvironment;
    let persistentStateFactory: IPersistentStateFactory;
    let isDownloadedStorageValid: TypeMoq.IMock<IPersistentState<boolean>>;
    let experimentStorage: TypeMoq.IMock<IPersistentState<any>>;
    let downloadedExperimentsStorage: TypeMoq.IMock<IPersistentState<any>>;
    let output: TypeMoq.IMock<IOutputChannel>;
    let fs: IFileSystem;
    let expManager: ExperimentsManager;
    setup(() => {
        workspaceService = mock(WorkspaceService);
        httpClient = mock(HttpClient);
        crypto = mock(CryptoUtils);
        appEnvironment = mock(ApplicationEnvironment);
        persistentStateFactory = mock(PersistentStateFactory);
        isDownloadedStorageValid = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        downloadedExperimentsStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
        fs = mock(FileSystem);
        when(persistentStateFactory.createGlobalPersistentState(isDownloadedStorageValidKey, false, anything())).thenReturn(isDownloadedStorageValid.object);
        when(persistentStateFactory.createGlobalPersistentState(experimentStorageKey, undefined as any)).thenReturn(experimentStorage.object);
        when(persistentStateFactory.createGlobalPersistentState(downloadedExperimentStorageKey, undefined as any)).thenReturn(downloadedExperimentsStorage.object);
        expManager = new ExperimentsManager(instance(persistentStateFactory), instance(workspaceService), instance(httpClient), instance(crypto), instance(appEnvironment), output.object, instance(fs));
    });

    async function testInitialization(
        settings: { globalValue?: boolean } = {},
        downloadError: boolean = false,
        experimentsDownloaded?: any
    ) {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        if (downloadError) {
            when(httpClient.getJSON(configUri, false)).thenReject(new Error('Kaboom'));
        } else {
            if (experimentsDownloaded) {
                when(httpClient.getJSON(configUri, false)).thenResolve(experimentsDownloaded);
            } else {
                when(httpClient.getJSON(configUri, false)).thenResolve([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]);
            }
        }

        try {
            await expManager.initializeInBackground();
            // tslint:disable-next-line:no-empty
        } catch { }

        verify(workspaceService.getConfiguration('telemetry')).once();
        workspaceConfig.verifyAll();
        isDownloadedStorageValid.verifyAll();
        experimentStorage.verifyAll();
    }

    test('If the users have opted out of telemetry, then they are opted out of AB testing ', async () => {
        isDownloadedStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.never());

        // settings = { globalValue: false }
        await testInitialization({ globalValue: false });
    });

    test('Initializing experiments does not download experiments if storage is valid and contains experiments', async () => {
        isDownloadedStorageValid.setup(n => n.value).returns(() => true).verifiable(TypeMoq.Times.once());

        await testInitialization();

        verify(httpClient.getJSON(configUri, false)).never();
    });

    test('If storage has expired, initializing experiments downloads the experiments, but does not store them if they are invalid or incomplete', async () => {
        const experiments = [{ name: 'experiment1', salt: 'salt', max: 100 }];
        isDownloadedStorageValid
            .setup(n => n.value)
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid
            .setup(n => n.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(experiments))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        // settings = {}, downloadError = false, experimentsDownloaded = experiments
        await testInitialization({}, false, experiments);

        verify(httpClient.getJSON(configUri, false)).once();
    });

    test('If storage has expired, initializing experiments downloads the experiments, and stores them if they are valid', async () => {
        isDownloadedStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid.setup(n => n.updateValue(true)).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage.setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }])).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());

        await testInitialization();

        verify(httpClient.getJSON(configUri, false)).once();
    });

    test('If downloading experiments fails with error, the storage is left as it is', async () => {
        isDownloadedStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid.setup(n => n.updateValue(true)).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());
        downloadedExperimentsStorage.setup(n => n.updateValue(anything())).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());

        // settings = {}, downloadError = true
        await testInitialization({}, true);

        verify(httpClient.getJSON(configUri, false)).once();
    });

    test('Ensure experiments can only be activated once', async () => {
        // Activate it twice and check
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};

        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        when(fs.fileExists(anything())).thenResolve(false);
        experimentStorage.setup(n => n.value).returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid
            .setup(n => n.value)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any);

        // First activation
        await expManager.activate();

        downloadedExperimentsStorage.reset();
        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.never());

        // Second activation
        await expManager.activate();

        downloadedExperimentsStorage.verifyAll();

        verify(fs.fileExists(anything())).once();
        isDownloadedStorageValid.verifyAll();
        experimentStorage.verifyAll();
    });

    test('Ensure experiments are reliably initialized in the background', async () => {
        const experimentsDeferred = createDeferred<ABExperiments>();
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};

        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        experimentStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid
            .setup(n => n.value)
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid
            .setup(n => n.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage
            .setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        when(
            workspaceService.getConfiguration('telemetry')
        )
            .thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(
            httpClient.getJSON(configUri, false)
        )
            .thenReturn(experimentsDeferred.promise);

        const promise = expManager.activate();
        const deferred = createDeferredFromPromise(promise);
        await sleep(1);

        // Ensure activate() function has completed while initialization is still running
        assert.equal(deferred.completed, true);

        experimentsDeferred.resolve([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]);
        await sleep(1);

        verify(
            workspaceService.getConfiguration('telemetry')
        ).once();
        workspaceConfig.verifyAll();
        isDownloadedStorageValid.verifyAll();
        downloadedExperimentsStorage.verifyAll();
        verify(
            httpClient.getJSON(configUri, false)
        ).once();
    });

    test('Ensure experiment storage is updated to contain the latest downloaded experiments', async () => {
        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => [{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }])
            .verifiable(TypeMoq.Times.atLeastOnce());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(undefined))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        experimentStorage
            .setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]))
            .returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());

        await expManager.updateExperimentStorage();

        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    test('When no downloaded experiments are available, and if local experiments file is not valid, experiment storage is not updated', async () => {
        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(undefined))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        // tslint:disable-next-line:no-multiline-string
        const fileContent = `
        // Yo! I am a JSON file with comments as well as trailing commas!

        [{ "name": "experiment1", "salt": "salt", "min": 90, },]
        `;

        when(
            fs.fileExists(anything())
        ).thenResolve(true);
        when(
            fs.readFile(anything())
        ).thenResolve(fileContent);
        when(
            fs.deleteFile(anything())
        ).thenResolve(undefined);

        experimentStorage
            .setup(n => n.updateValue(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());

        await expManager.updateExperimentStorage();

        verify(fs.fileExists(anything())).once();
        verify(fs.readFile(anything())).once();
        verify(fs.deleteFile(anything())).never();
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    test('When no downloaded experiments are available, experiment storage is updated using local experiments file (which is then deleted) given experiments are valid', async () => {
        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(undefined))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        // tslint:disable-next-line:no-multiline-string
        const fileContent = `
        // Yo! I am a JSON file with comments as well as trailing commas!

        [{ "name": "experiment1", "salt": "salt", "min": 90, "max": 100, },]
        `;

        when(
            fs.fileExists(anything())
        ).thenResolve(true);
        when(
            fs.readFile(anything())
        ).thenResolve(fileContent);
        when(
            fs.deleteFile(anything())
        ).thenResolve(undefined);

        experimentStorage
            .setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]))
            .returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());

        await expManager.updateExperimentStorage();

        verify(fs.fileExists(anything())).once();
        verify(fs.readFile(anything())).once();
        verify(fs.deleteFile(anything())).once();
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    // tslint:disable-next-line:max-func-body-length
    suite('When no downloaded experiments are available, function updateExperimentStorage() stops execution and returns', () => {
        test('If checking the existence of config file fails', async () => {
            downloadedExperimentsStorage
                .setup(n => n.value)
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            downloadedExperimentsStorage
                .setup(n => n.updateValue(undefined))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());

            const error = new Error('Kaboom');
            when(
                fs.fileExists(anything())
            ).thenThrow(error);
            when(
                fs.readFile(anything())
            ).thenResolve('fileContent');
            when(
                fs.deleteFile(anything())
            ).thenResolve(undefined);

            experimentStorage
                .setup(n => n.updateValue(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());

            await expManager.updateExperimentStorage();

            verify(fs.fileExists(anything())).once();
            verify(fs.readFile(anything())).never();
            verify(fs.deleteFile(anything())).never();
            experimentStorage.verifyAll();
            downloadedExperimentsStorage.verifyAll();
        });

        test('If reading config file fails', async () => {
            downloadedExperimentsStorage
                .setup(n => n.value)
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            downloadedExperimentsStorage
                .setup(n => n.updateValue(undefined))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());

            const error = new Error('Kaboom');
            when(
                fs.fileExists(anything())
            ).thenResolve(true);
            when(
                fs.readFile(anything())
            ).thenThrow(error);
            when(
                fs.deleteFile(anything())
            ).thenResolve(undefined);

            experimentStorage
                .setup(n => n.updateValue(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());

            await expManager.updateExperimentStorage();

            verify(fs.fileExists(anything())).once();
            verify(fs.readFile(anything())).once();
            verify(fs.deleteFile(anything())).never();
            experimentStorage.verifyAll();
            downloadedExperimentsStorage.verifyAll();
        });

        test('If config file does not exist', async () => {
            downloadedExperimentsStorage
                .setup(n => n.value)
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            downloadedExperimentsStorage
                .setup(n => n.updateValue(undefined))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());

            when(
                fs.fileExists(anything())
            ).thenResolve(false);
            when(
                fs.readFile(anything())
            ).thenResolve('fileContent');
            when(
                fs.deleteFile(anything())
            ).thenResolve(undefined);

            experimentStorage
                .setup(n => n.updateValue(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());

            await expManager.updateExperimentStorage();

            verify(fs.fileExists(anything())).once();
            verify(fs.readFile(anything())).never();
            verify(fs.deleteFile(anything())).never();
            experimentStorage.verifyAll();
            downloadedExperimentsStorage.verifyAll();
        });

        test('If parsing file or updating storage fails', async () => {
            downloadedExperimentsStorage
                .setup(n => n.value)
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            downloadedExperimentsStorage
                .setup(n => n.updateValue(undefined))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());

            // tslint:disable-next-line:no-multiline-string
            const fileContent = `
            // Yo! I am a JSON file with comments as well as trailing commas!

            [{ "name": "experiment1", "salt": "salt", "min": 90, "max": 100 },]
            `;
            const error = new Error('Kaboom');
            when(
                fs.fileExists(anything())
            ).thenResolve(true);
            when(
                fs.readFile(anything())
            ).thenResolve(fileContent);
            when(
                fs.deleteFile(anything())
            ).thenResolve(undefined);

            experimentStorage
                .setup(n => n.updateValue(TypeMoq.It.isAny()))
                .returns(() => Promise.reject(error))
                .verifiable(TypeMoq.Times.once());

            await expManager.updateExperimentStorage();

            verify(fs.fileExists(anything())).once();
            verify(fs.readFile(anything())).once();
            verify(fs.deleteFile(anything())).never();
            experimentStorage.verifyAll();
            downloadedExperimentsStorage.verifyAll();
        });
    });

    const testsForInExperiment =
        [
            {
                testName: 'If experiment\'s name is not in user experiment list, user is not in experiment',
                experimentName: 'imaginary experiment',
                userExperiments: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                expectedResult: false
            },
            {
                testName: 'If experiment\'s name is in user experiment list and hash modulo output is in range, user is in experiment',
                experimentName: 'experiment1',
                userExperiments: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                expectedResult: true
            }
        ];

    testsForInExperiment.forEach(testParams => {
        test(testParams.testName, async () => {
            expManager.userExperiments = testParams.userExperiments;
            expect(expManager.inExperiment(testParams.experimentName)).to.equal(testParams.expectedResult, 'Incorrectly identified');
        });
    });

    const testsForIsUserInRange =
        [
            // Note min equals 79 and max equals 94
            {
                testName: 'Returns true if hash modulo output is in range',
                hash: 1181,
                expectedResult: true
            },
            {
                testName: 'Returns false if hash modulo is less than min',
                hash: 967,
                expectedResult: false
            },
            {
                testName: 'Returns false if hash modulo is more than max',
                hash: 3297,
                expectedResult: false
            },
            {
                testName: 'If checking if user is in range fails with error, throw error',
                hash: 3297,
                error: true,
                expectedResult: false
            },
            {
                testName: 'If machine ID is bogus, throw error',
                hash: 3297,
                machineIdError: true,
                expectedResult: false
            }
        ];

    suite('Function IsUserInRange()', () => {
        testsForIsUserInRange.forEach(testParams => {
            test(testParams.testName, async () => {
                when(appEnvironment.machineId).thenReturn('101');
                if (testParams.machineIdError) {
                    when(appEnvironment.machineId).thenReturn(undefined as any);
                    expect(() => expManager.isUserInRange(79, 94, 'salt')).to.throw();
                } else if (testParams.error) {
                    const error = new Error('Kaboom');
                    when(crypto.createHash(anything(), 'hex', 'number')).thenThrow(error);
                    expect(() => expManager.isUserInRange(79, 94, 'salt')).to.throw(error);
                } else {
                    when(crypto.createHash(anything(), 'hex', 'number')).thenReturn(testParams.hash);
                    expect(expManager.isUserInRange(79, 94, 'salt')).to.equal(testParams.expectedResult, 'Incorrectly identified');
                }
            });
        });
    });

    const testsForPopulateUserExperiments =
        [
            {
                testName: 'User experiments list is empty if experiment storage value is not an array',
                experimentStorageValue: undefined,
                expectedResult: []
            },
            {
                testName: 'User experiments list is empty if experiment storage value is an empty array',
                experimentStorageValue: [],
                expectedResult: []
            },
            {
                testName: 'User experiments list contains the experiment if and only if user is in experiment range',
                experimentStorageValue: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                hash: 8187,
                expectedResult: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }]
            }
        ];

    testsForPopulateUserExperiments.forEach(testParams => {
        test(testParams.testName, async () => {
            experimentStorage
                .setup(n => n.value)
                .returns(() => testParams.experimentStorageValue);
            when(appEnvironment.machineId).thenReturn('101');
            if (testParams.hash) {
                when(crypto.createHash(anything(), 'hex', 'number')).thenReturn(testParams.hash);
            }
            expManager.populateUserExperiments();
            assert.deepEqual(expManager.userExperiments, testParams.expectedResult);
        });
    });

    const testsForAreExperimentsValid =
        [
            {
                testName: 'If experiments are not an array, return false',
                experiments: undefined,
                expectedResult: false
            },
            {
                testName: 'If any experiment have `min` field missing, return false',
                experiments: [{ name: 'experiment1', salt: 'salt', max: 94 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                expectedResult: false
            },
            {
                testName: 'If any experiment have `max` field missing, return false',
                experiments: [{ name: 'experiment1', salt: 'salt', min: 79 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                expectedResult: false
            },
            {
                testName: 'If any experiment have `salt` field missing, return false',
                experiments: [{ name: 'experiment1', min: 79, max: 94 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                expectedResult: false
            },
            {
                testName: 'If any experiment have `name` field missing, return false',
                experiments: [{ salt: 'salt', min: 79, max: 94 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                expectedResult: false
            },
            {
                testName: 'If all experiments contain all the fields in type `ABExperiment`, return true',
                experiments: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }, { name: 'experiment2', salt: 'salt', min: 19, max: 30 }],
                expectedResult: true
            }
        ];

    suite('Function areExperimentsValid()', () => {
        testsForAreExperimentsValid.forEach(testParams => {
            test(testParams.testName, () => {
                expect(expManager.areExperimentsValid(testParams.experiments as any)).to.equal(testParams.expectedResult);
            });
        });
    });
});
