// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { assert, expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { IHttpClient } from '../../client/activation/types';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { CryptoUtils } from '../../client/common/crypto';
import { downloadedExperimentStorageKey, ExperimentsManager, experimentStorageKey, isDownloadedStorageValidKey } from '../../client/common/experiments';
import { HttpClient } from '../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import { ABExperiments, ICryptoUtils, IOutputChannel, IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { createDeferred, createDeferredFromPromise } from '../../client/common/utils/async';
import { sleep } from '../common';

// tslint:disable-next-line: max-func-body-length
suite('A/B experiments', () => {
    let workspaceService: IWorkspaceService;
    let httpClient: IHttpClient;
    let crypto: ICryptoUtils;
    let appEnvironment: IApplicationEnvironment;
    let persistentStateFactory: IPersistentStateFactory;
    let isStorageValid: TypeMoq.IMock<IPersistentState<boolean>>;
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
        isStorageValid = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        downloadedExperimentsStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
        fs = mock(FileSystem);
        when(persistentStateFactory.createGlobalPersistentState(isDownloadedStorageValidKey, false, anything())).thenReturn(isStorageValid.object);
        when(persistentStateFactory.createGlobalPersistentState(experimentStorageKey, undefined as any)).thenReturn(experimentStorage.object);
        when(persistentStateFactory.createGlobalPersistentState(downloadedExperimentStorageKey, undefined as any)).thenReturn(downloadedExperimentsStorage.object);
        expManager = new ExperimentsManager(instance(persistentStateFactory), instance(workspaceService), instance(httpClient), instance(crypto), instance(appEnvironment), output.object, instance(fs));
    });

    async function testInitialization(
        settings: { globalValue?: boolean } = {},
        downloadError: boolean = false
    ) {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        if (downloadError) {
            when(httpClient.getJSON(anything(), false)).thenReject(new Error('Kaboom'));
        } else {
            when(httpClient.getJSON(anything(), false)).thenResolve([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]);
        }

        try {
            await expManager.initializeInBackground();
            // tslint:disable-next-line:no-empty
        } catch { }

        verify(workspaceService.getConfiguration('telemetry')).once();
        workspaceConfig.verifyAll();
        isStorageValid.verifyAll();
        experimentStorage.verifyAll();
    }

    test('If the users have opted out of telemetry, then they are opted out of AB testing ', async () => {
        isStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.never());

        // settings = { globalValue: false }
        await testInitialization({ globalValue: false });
    });

    test('Initializing experiments does not download experiments if storage is valid and contains experiments', async () => {
        isStorageValid.setup(n => n.value).returns(() => true).verifiable(TypeMoq.Times.once());

        await testInitialization();

        verify(httpClient.getJSON(anything(), false)).never();
    });

    test('Initializing experiments downloads and stores the experiments if storage has expired', async () => {
        isStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.once());
        isStorageValid.setup(n => n.updateValue(true)).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage.setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }])).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());

        await testInitialization();

        verify(httpClient.getJSON(anything(), false)).once();
    });

    test('If downloading experiments fails with error, the storage is left as it is', async () => {
        isStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.once());
        isStorageValid.setup(n => n.updateValue(true)).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());
        downloadedExperimentsStorage.setup(n => n.updateValue(anything())).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());

        // settings = {}, error = true
        await testInitialization({}, true);

        verify(httpClient.getJSON(anything(), false)).once();
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
        isStorageValid
            .setup(n => n.value)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any);

        // First activation
        await expManager.activate();

        verify(fs.fileExists(anything())).once();
        isStorageValid.verifyAll();
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();

        downloadedExperimentsStorage.reset();
        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.never());

        // Second activation
        await expManager.activate();

        downloadedExperimentsStorage.verifyAll();
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

    test('Experiment storage is updated using local experiments file if no downloaded experiments are available', async () => {
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

        when(fs.fileExists(anything())).thenResolve(true);
        when(fs.readFile(anything())).thenResolve(fileContent);

        experimentStorage
            .setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]))
            .returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());

        await expManager.updateExperimentStorage();

        verify(fs.fileExists(anything())).once();
        verify(fs.readFile(anything())).once();
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    test('Ensure experiments are reliably initialized in the background', async () => {
        const experimentsDeferred = createDeferred<ABExperiments>();
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};

        downloadedExperimentsStorage.setup(n => n.value).returns(() => undefined).verifiable(TypeMoq.Times.once());
        experimentStorage.setup(n => n.value).returns(() => undefined).verifiable(TypeMoq.Times.once());
        isStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.once());
        isStorageValid.setup(n => n.updateValue(true)).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage.setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }])).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());
        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(httpClient.getJSON(anything(), false)).thenReturn(experimentsDeferred.promise);

        const promise = expManager.activate();
        const deferred = createDeferredFromPromise(promise);
        await sleep(1);

        // Ensure activate() function has completed while initialization is still running
        assert.equal(deferred.completed, true);

        experimentsDeferred.resolve([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]);
        await sleep(1);

        verify(workspaceService.getConfiguration('telemetry')).once();
        workspaceConfig.verifyAll();
        isStorageValid.verifyAll();
        downloadedExperimentsStorage.verifyAll();
        verify(httpClient.getJSON(anything(), false)).once();
    });

    const testsForInExperiment =
        [
            {
                testName: 'If experiment\'s name is not in experiment list, user is not in experiment',
                experimentName: 'imaginary experiment',
                hash: 223,
                expectedResult: false
            },
            {
                testName: 'If experiment\'s name is in experiment list and hash modulo output is in range, user is in experiment',
                experimentName: 'experiment1',
                hash: 1181,
                expectedResult: true
            },
            {
                testName: 'If experiment\'s name is in experiment list and hash modulo is less than min, user is not in experiment',
                experimentName: 'experiment1',
                hash: 967,
                expectedResult: false
            },
            {
                testName: 'If experiment\'s name is in experiment list and hash modulo is more than max, user is not in experiment',
                experimentName: 'experiment1',
                hash: 3297,
                expectedResult: false
            },
            {
                testName: 'If checking if user is in experiment fails with error, user is not in experiment and inExperiment returns undefined',
                experimentName: 'experiment1',
                hash: 1181,
                expectedResult: undefined,
                error: true
            }
        ];

    testsForInExperiment.forEach(testParams => {
        test(testParams.testName, async () => {
            experimentStorage.setup(n => n.value).returns(() => [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }]);
            when(appEnvironment.machineId).thenReturn('101');
            if (testParams.error) {
                when(crypto.createHash(anything(), 'hex', 'number')).thenThrow(new Error('Kaboom'));
            } else {
                when(crypto.createHash(anything(), 'hex', 'number')).thenReturn(testParams.hash);
            }

            verify(httpClient.getJSON(anything(), false)).never();
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
            }
        ];

    suite('Function IsUserInRange()', () => {
        testsForIsUserInRange.forEach(testParams => {
            test(testParams.testName, async () => {
                when(appEnvironment.machineId).thenReturn('101');
                when(crypto.createHash(anything(), 'hex', 'number')).thenReturn(testParams.hash);

                expect(expManager.isUserInRange(79, 94, 'salt')).to.equal(testParams.expectedResult, 'Incorrectly identified');
            });
        });
    });

    const testsForLogExperimentGroups =
        [
            {
                testName: 'Does not log anything if experiment storage value is not an array',
                experimentStorageValue: undefined,
                logged: false
            },
            {
                testName: 'Does not log anything if experiment storage value is an empty array',
                experimentStorageValue: [],
                logged: false
            },
            {
                testName: 'Does not log anything if user is not in experiment range',
                experimentStorageValue: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }],
                hash: 612,
                logged: false
            },
            {
                testName: 'Logs experiment group if user is in experiment range',
                experimentStorageValue: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }],
                hash: 8187,
                logged: true
            }
        ];

    testsForLogExperimentGroups.forEach(testParams => {
        test(testParams.testName, async () => {
            experimentStorage
                .setup(n => n.value)
                .returns(() => testParams.experimentStorageValue);
            when(appEnvironment.machineId).thenReturn('101');
            if (testParams.hash) {
                when(crypto.createHash(anything(), 'hex', 'number')).thenReturn(testParams.hash);
            }
            if (testParams.logged) {
                output
                    .setup(o => o.appendLine(TypeMoq.It.isAny()))
                    .verifiable(TypeMoq.Times.once());
            } else {
                output
                    .setup(o => o.appendLine(TypeMoq.It.isAny()))
                    .verifiable(TypeMoq.Times.never());
            }
            expManager.logExperimentGroups();
            output.verifyAll();
        });
    });
});
