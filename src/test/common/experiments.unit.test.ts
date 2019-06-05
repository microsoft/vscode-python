// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { assert, expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IHttpClient } from '../../client/activation/types';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { CryptoUtils } from '../../client/common/crypto';
import { ExperimentsManager, experimentStorageKey, isStorageValidKey } from '../../client/common/experiments';
import { HttpClient } from '../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../client/common/persistentState';
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
    let output: TypeMoq.IMock<IOutputChannel>;
    let expManager: ExperimentsManager;
    setup(() => {
        workspaceService = mock(WorkspaceService);
        httpClient = mock(HttpClient);
        crypto = mock(CryptoUtils);
        appEnvironment = mock(ApplicationEnvironment);
        persistentStateFactory = mock(PersistentStateFactory);
        isStorageValid = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        output = TypeMoq.Mock.ofType<IOutputChannel>();
        when(persistentStateFactory.createGlobalPersistentState(isStorageValidKey, false, anything())).thenReturn(isStorageValid.object);
        when(persistentStateFactory.createGlobalPersistentState(experimentStorageKey, undefined as any)).thenReturn(experimentStorage.object);
        expManager = new ExperimentsManager(instance(persistentStateFactory), instance(workspaceService), instance(httpClient), instance(crypto), instance(appEnvironment), output.object);
    });

    async function testInitialization(
        settings: { globalValue?: boolean } = {},
        downloadError: boolean = false
    ) {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        when(workspaceService.getConfiguration('telemetry', anything())).thenReturn(workspaceConfig.object);
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

        verify(workspaceService.getConfiguration('telemetry', anything())).once();
        workspaceConfig.verifyAll();
        isStorageValid.verifyAll();
        experimentStorage.verifyAll();
    }

    test('If the users have opted out of telemetry, then they are opted out of AB testing ', async () => {
        isStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.never());

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
        experimentStorage.setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }])).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());

        await testInitialization();

        verify(httpClient.getJSON(anything(), false)).once();
    });

    test('If downloading experiments fails with error, the storage is left as it is', async () => {
        isStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.once());
        isStorageValid.setup(n => n.updateValue(true)).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());
        experimentStorage.setup(n => n.updateValue(anything())).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());

        await testInitialization({}, true);

        verify(httpClient.getJSON(anything(), false)).once();
    });

    test('Ensure experiments are reliably initialized in the background', async () => {
        const experimentsDeferred = createDeferred<ABExperiments>();
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};
        const resource = Uri.parse('one');

        experimentStorage.setup(n => n.value).returns(() => undefined).verifiable(TypeMoq.Times.once());
        isStorageValid.setup(n => n.value).returns(() => false).verifiable(TypeMoq.Times.once());
        isStorageValid.setup(n => n.updateValue(true)).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());
        experimentStorage.setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }])).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());
        when(workspaceService.getConfiguration('telemetry', anything())).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(httpClient.getJSON(anything(), false)).thenReturn(experimentsDeferred.promise);

        const promise = expManager.activate(resource);
        const deferred = createDeferredFromPromise(promise);
        await sleep(1);
        assert.equal(deferred.completed, true);

        experimentsDeferred.resolve([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]);
        await sleep(1);

        verify(workspaceService.getConfiguration('telemetry', anything())).once();
        workspaceConfig.verifyAll();
        isStorageValid.verifyAll();
        experimentStorage.verifyAll();
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
                testName: 'If checking if user is in experiment fails with error',
                experimentName: 'experiment1',
                hash: 1181,
                expectedResult: false,
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

    const testsForisTelemetryDisabled =
        [
            {
                testName: 'Returns true when workspaceFolder setting is false',
                settings: { workspaceFolderValue: false },
                expectedResult: true
            },
            {
                testName: 'Returns true when workspace setting is false and workspace folder setting is not true',
                settings: { workspaceValue: false },
                expectedResult: true
            },
            {
                testName: 'Returns true when global setting is false, and workspace & workspace folder setting is not true',
                settings: { globalValue: false },
                expectedResult: true
            },
            {
                testName: 'Returns true otherwise',
                settings: { workspaceValue: true, globalValue: false },
                expectedResult: false
            }
        ];

    suite('Function isTelemetryDisabled()', () => {
        testsForisTelemetryDisabled.forEach(testParams => {
            test(testParams.testName, async () => {
                const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                when(workspaceService.getConfiguration('telemetry', anything())).thenReturn(workspaceConfig.object);
                workspaceConfig.setup(c => c.inspect<string>('enableTelemetry'))
                    .returns(() => testParams.settings as any)
                    .verifiable(TypeMoq.Times.once());

                expect(expManager.isTelemetryDisabled()).to.equal(testParams.expectedResult);

                verify(workspaceService.getConfiguration('telemetry', anything())).once();
                workspaceConfig.verifyAll();
            });
        });
    });
});
