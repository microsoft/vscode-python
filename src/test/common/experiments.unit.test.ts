// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, resetCalls, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PythonSettings } from '../../client/common/configSettings';
import { ConfigurationService } from '../../client/common/configuration/service';
import { CryptoUtils } from '../../client/common/crypto';
import {
    configUri,
    downloadedExperimentStorageKey,
    ExperimentsManager,
    experimentStorageKey,
    isDownloadedStorageValidKey,
    oldExperimentSalts
} from '../../client/common/experiments';
import { HttpClient } from '../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IFileSystem } from '../../client/common/platform/types';
import {
    ICryptoUtils,
    IExperiments,
    IHttpClient,
    IOutputChannel,
    IPersistentState,
    IPersistentStateFactory
} from '../../client/common/types';
import { createDeferred, createDeferredFromPromise } from '../../client/common/utils/async';
import { sleep } from '../common';
import { noop } from '../core';

// tslint:disable: max-func-body-length

suite('A/B experiments', () => {
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
    let configurationService: ConfigurationService;
    let experiments: TypeMoq.IMock<IExperiments>;
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
        configurationService = mock(ConfigurationService);
        experiments = TypeMoq.Mock.ofType<IExperiments>();
        const settings = mock(PythonSettings);
        when(settings.experiments).thenReturn(experiments.object);
        experiments.setup(e => e.optInto).returns(() => []);
        experiments.setup(e => e.optOutFrom).returns(() => []);
        when(configurationService.getSettings(undefined)).thenReturn(instance(settings));
        fs = mock(FileSystem);
        when(
            persistentStateFactory.createGlobalPersistentState(isDownloadedStorageValidKey, false, anything())
        ).thenReturn(isDownloadedStorageValid.object);
        when(persistentStateFactory.createGlobalPersistentState(experimentStorageKey, undefined as any)).thenReturn(
            experimentStorage.object
        );
        when(
            persistentStateFactory.createGlobalPersistentState(downloadedExperimentStorageKey, undefined as any)
        ).thenReturn(downloadedExperimentsStorage.object);
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );
    });

    teardown(() => {
        sinon.restore();
    });

    async function testInitialization(
        downloadError: boolean = false,
        experimentsDownloaded: any = [{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]
    ) {
        if (downloadError) {
            when(httpClient.getJSON(configUri, false)).thenReject(new Error('Kaboom'));
        } else {
            when(httpClient.getJSON(configUri, false)).thenResolve(experimentsDownloaded);
        }

        try {
            await expManager.initializeInBackground();
            // tslint:disable-next-line:no-empty
        } catch {}

        isDownloadedStorageValid.verifyAll();
    }

    test('Initializing experiments does not download experiments if storage is valid and contains experiments', async () => {
        isDownloadedStorageValid
            .setup(n => n.value)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());

        await testInitialization();

        verify(httpClient.getJSON(configUri, false)).never();
    });

    test('If storage has expired, initializing experiments downloads the experiments, but does not store them if they are invalid or incomplete', async () => {
        const abExperiments = [{ name: 'experiment1', salt: 'salt', max: 100 }];
        isDownloadedStorageValid
            .setup(n => n.value)
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid
            .setup(n => n.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(abExperiments))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        // downloadError = false, experimentsDownloaded = experiments
        await testInitialization(false, abExperiments);

        verify(httpClient.getJSON(configUri, false)).once();
    });

    test('If storage has expired, initializing experiments downloads the experiments, and stores them if they are valid', async () => {
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

        await testInitialization();

        verify(httpClient.getJSON(configUri, false)).once();
    });

    test('If downloading experiments fails with error, the storage is left as it is', async () => {
        isDownloadedStorageValid
            .setup(n => n.value)
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid
            .setup(n => n.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(anything()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        // downloadError = true
        await testInitialization(true);

        verify(httpClient.getJSON(configUri, false)).once();
    });

    test('If the users have opted out of telemetry, then they are opted out of AB testing ', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = { globalValue: false };

        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.never());

        await expManager.activate();

        verify(workspaceService.getConfiguration('telemetry')).once();
        workspaceConfig.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    async function testEnablingExperiments(enabled: boolean) {
        const updateExperimentStorage = sinon.stub(ExperimentsManager.prototype, 'updateExperimentStorage');
        updateExperimentStorage.callsFake(() => Promise.resolve());
        const populateUserExperiments = sinon.stub(ExperimentsManager.prototype, 'populateUserExperiments');
        populateUserExperiments.callsFake(() => Promise.resolve());
        const initializeInBackground = sinon.stub(ExperimentsManager.prototype, 'initializeInBackground');
        initializeInBackground.callsFake(() => Promise.resolve());
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};
        experiments
            .setup(e => e.enabled)
            .returns(() => enabled)
            .verifiable(TypeMoq.Times.atLeastOnce());

        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());

        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );
        await expManager.activate();

        // If experiments are disabled, then none of these methods will be invoked & vice versa.
        assert.equal(updateExperimentStorage.callCount, enabled ? 1 : 0);
        assert.equal(populateUserExperiments.callCount, enabled ? 1 : 0);
        assert.equal(initializeInBackground.callCount, enabled ? 1 : 0);

        workspaceConfig.verifyAll();
        experiments.verifyAll();
    }
    test('Ensure experiments are not initialized when it is disabled', async () => testEnablingExperiments(false));

    test('Ensure experiments are initialized when it is enabled', async () => testEnablingExperiments(true));

    async function testEnablingExperimentsToCheckIfInExperiment(enabled: boolean) {
        const sendTelemetry = sinon.stub(ExperimentsManager.prototype, 'sendTelemetryIfInExperiment');
        sendTelemetry.callsFake((_: string) => noop());
        experiments
            .setup(e => e.enabled)
            .returns(() => enabled)
            .verifiable(TypeMoq.Times.atLeastOnce());

        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );
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
        const initializeInBackground = sinon.stub(ExperimentsManager.prototype, 'initializeInBackground');
        initializeInBackground.callsFake(() => Promise.resolve());
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );
        // Activate it twice and check
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};

        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());

        // First activation
        await expManager.activate();

        resetCalls(workspaceService);

        // Second activation
        await expManager.activate();

        verify(workspaceService.getConfiguration(anything())).never();

        workspaceConfig.verifyAll();
    });

    test('Ensure experiments are reliably downloaded in the background', async () => {
        const experimentsDeferred = createDeferred<void>();
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};
        const updateExperimentStorage = sinon.stub(ExperimentsManager.prototype, 'updateExperimentStorage');
        updateExperimentStorage.callsFake(() => Promise.resolve());
        const populateUserExperiments = sinon.stub(ExperimentsManager.prototype, 'populateUserExperiments');
        populateUserExperiments.callsFake(() => Promise.resolve());
        const initializeInBackground = sinon.stub(ExperimentsManager.prototype, 'initializeInBackground');
        initializeInBackground.callsFake(() => experimentsDeferred.promise);
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );

        when(workspaceService.getConfiguration('telemetry')).thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());

        const promise = expManager.activate();
        const deferred = createDeferredFromPromise(promise);
        await sleep(1);

        // Ensure activate() function has completed while experiments are still being downloaded
        assert.equal(deferred.completed, true);

        experimentsDeferred.resolve();
        await sleep(1);

        verify(workspaceService.getConfiguration('telemetry')).once();
        workspaceConfig.verifyAll();
        assert.ok(initializeInBackground.calledOnce);
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
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());

        await expManager.updateExperimentStorage();

        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    test('When latest experiments are not available, but experiment storage contains experiments, then experiment storage is not updated', async () => {
        const doBestEffortToPopulateExperiments = sinon.stub(
            ExperimentsManager.prototype,
            'doBestEffortToPopulateExperiments'
        );
        doBestEffortToPopulateExperiments.callsFake(() => Promise.resolve(false));
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );

        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(undefined))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        experimentStorage
            .setup(n => n.value)
            .returns(() => [{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }])
            .verifiable(TypeMoq.Times.once());
        experimentStorage
            .setup(n => n.updateValue(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        await expManager.updateExperimentStorage();

        assert.ok(doBestEffortToPopulateExperiments.notCalled);
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    test('When best effort to populate experiments succeeds, function updateStorage() returns', async () => {
        const doBestEffortToPopulateExperiments = sinon.stub(
            ExperimentsManager.prototype,
            'doBestEffortToPopulateExperiments'
        );
        doBestEffortToPopulateExperiments.callsFake(() => Promise.resolve(true));
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );

        downloadedExperimentsStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        downloadedExperimentsStorage
            .setup(n => n.updateValue(undefined))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        experimentStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());

        await expManager.updateExperimentStorage();

        assert.ok(doBestEffortToPopulateExperiments.calledOnce);
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    test('When latest experiments are not available, experiment storage is empty, but if local experiments file is not valid, experiment storage is not updated', async () => {
        const doBestEffortToPopulateExperiments = sinon.stub(
            ExperimentsManager.prototype,
            'doBestEffortToPopulateExperiments'
        );
        doBestEffortToPopulateExperiments.callsFake(() => Promise.resolve(false));
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );
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

        when(fs.fileExists(anything())).thenResolve(true);
        when(fs.readFile(anything())).thenResolve(fileContent);

        experimentStorage
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        experimentStorage
            .setup(n => n.updateValue(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());

        await expManager.updateExperimentStorage();

        verify(fs.fileExists(anything())).once();
        verify(fs.readFile(anything())).once();
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    test('When latest experiments are not available, and experiment storage is empty, then experiment storage is updated using local experiments file given experiments are valid', async () => {
        const doBestEffortToPopulateExperiments = sinon.stub(
            ExperimentsManager.prototype,
            'doBestEffortToPopulateExperiments'
        );
        doBestEffortToPopulateExperiments.callsFake(() => Promise.resolve(false));
        expManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            output.object,
            instance(fs),
            instance(configurationService)
        );
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
            .setup(n => n.value)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        experimentStorage
            .setup(n => n.updateValue([{ name: 'experiment1', salt: 'salt', min: 90, max: 100 }]))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());

        await expManager.updateExperimentStorage();

        verify(fs.fileExists(anything())).once();
        verify(fs.readFile(anything())).once();
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });

    suite(
        'When latest experiments are not available, and experiment storage is empty, then function updateExperimentStorage() stops execution and returns',
        () => {
            setup(() => {
                const doBestEffortToPopulateExperiments = sinon.stub(
                    ExperimentsManager.prototype,
                    'doBestEffortToPopulateExperiments'
                );
                doBestEffortToPopulateExperiments.callsFake(() => Promise.resolve(false));
                expManager = new ExperimentsManager(
                    instance(persistentStateFactory),
                    instance(workspaceService),
                    instance(httpClient),
                    instance(crypto),
                    instance(appEnvironment),
                    output.object,
                    instance(fs),
                    instance(configurationService)
                );
            });
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
                when(fs.fileExists(anything())).thenThrow(error);
                when(fs.readFile(anything())).thenResolve('fileContent');

                experimentStorage
                    .setup(n => n.value)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.once());
                experimentStorage
                    .setup(n => n.updateValue(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.never());

                await expManager.updateExperimentStorage();

                verify(fs.fileExists(anything())).once();
                verify(fs.readFile(anything())).never();
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
                when(fs.fileExists(anything())).thenResolve(true);
                when(fs.readFile(anything())).thenThrow(error);

                experimentStorage
                    .setup(n => n.value)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.once());
                experimentStorage
                    .setup(n => n.updateValue(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.never());

                await expManager.updateExperimentStorage();

                verify(fs.fileExists(anything())).once();
                verify(fs.readFile(anything())).once();
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

                when(fs.fileExists(anything())).thenResolve(false);
                when(fs.readFile(anything())).thenResolve('fileContent');

                experimentStorage
                    .setup(n => n.value)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.once());
                experimentStorage
                    .setup(n => n.updateValue(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.never());

                await expManager.updateExperimentStorage();

                verify(fs.fileExists(anything())).once();
                verify(fs.readFile(anything())).never();
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
                when(fs.fileExists(anything())).thenResolve(true);
                when(fs.readFile(anything())).thenResolve(fileContent);

                experimentStorage
                    .setup(n => n.value)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.once());
                experimentStorage
                    .setup(n => n.updateValue(TypeMoq.It.isAny()))
                    .returns(() => Promise.reject(error))
                    .verifiable(TypeMoq.Times.once());

                await expManager.updateExperimentStorage();

                verify(fs.fileExists(anything())).once();
                verify(fs.readFile(anything())).once();
                experimentStorage.verifyAll();
                downloadedExperimentsStorage.verifyAll();
            });
        }
    );

    const testsForInExperiment = [
        {
            testName: "If experiment's name is not in user experiment list, user is not in experiment",
            experimentName: 'imaginary experiment',
            userExperiments: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            expectedResult: false
        },
        {
            testName:
                "If experiment's name is in user experiment list and hash modulo output is in range, user is in experiment",
            experimentName: 'experiment1',
            userExperiments: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            expectedResult: true
        }
    ];

    testsForInExperiment.forEach(testParams => {
        test(testParams.testName, async () => {
            expManager.userExperiments = testParams.userExperiments;
            expect(expManager.inExperiment(testParams.experimentName)).to.equal(
                testParams.expectedResult,
                'Incorrectly identified'
            );
        });
    });

    const testsForIsUserInRange = [
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
                    when(crypto.createHash(anything(), 'number', anything())).thenThrow(error);
                    expect(() => expManager.isUserInRange(79, 94, 'salt')).to.throw(error);
                } else {
                    when(crypto.createHash(anything(), 'number', anything())).thenReturn(testParams.hash);
                    expect(expManager.isUserInRange(79, 94, 'salt')).to.equal(
                        testParams.expectedResult,
                        'Incorrectly identified'
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
                'LS'
            ];
            assert.deepEqual(expectedOldExperimentSalts, oldExperimentSalts);
        });
    });

    const testsForPopulateUserExperiments = [
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
            testName:
                'User experiments list does not contain any experiments if user has requested to opt out of all experiments',
            experimentStorageValue: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 80, max: 90 }
            ],
            hash: 8187,
            experimentsOptedOutFrom: ['All'],
            expectedResult: []
        },
        {
            testName:
                'User experiments list contains all experiments if user has requested to opt into all experiments',
            experimentStorageValue: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 80, max: 90 }
            ],
            hash: 8187,
            experimentsOptedInto: ['All'],
            expectedResult: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 80, max: 90 }
            ]
        },
        {
            testName:
                'User experiments list contains the experiment if user has requested to opt in a control group but is not in experiment range',
            experimentStorageValue: [{ name: 'experiment2 - control', salt: 'salt', min: 19, max: 30 }],
            hash: 8187,
            experimentsOptedInto: ['experiment2 - control'],
            expectedResult: []
        },
        {
            testName:
                'User experiments list contains the experiment if user has requested to opt out of a control group but user is in experiment range',
            experimentStorageValue: [
                { name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2 - control', salt: 'salt', min: 19, max: 30 }
            ],
            hash: 8187,
            experimentsOptedOutFrom: ['experiment1 - control'],
            expectedResult: [{ name: 'experiment1 - control', salt: 'salt', min: 79, max: 94 }]
        },
        {
            testName:
                'User experiments list does not contains the experiment if user has opted out of experiment even though user is in experiment range',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            hash: 8187,
            experimentsOptedOutFrom: ['experiment1'],
            expectedResult: []
        },
        {
            testName:
                'User experiments list contains the experiment if user has opted into the experiment even though user is not in experiment range',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            hash: 8187,
            experimentsOptedInto: ['experiment1'],
            expectedResult: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }]
        },
        {
            testName:
                'User experiments list does not contain the experiment if user has both opted in and out of an experiment',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            hash: 8187,
            experimentsOptedInto: ['experiment1'],
            experimentsOptedOutFrom: ['experiment1'],
            expectedResult: []
        },
        {
            testName: 'Otherwise user experiments list contains the experiment if user is in experiment range',
            experimentStorageValue: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            hash: 8187,
            expectedResult: [{ name: 'experiment1', salt: 'salt', min: 79, max: 94 }]
        }
    ];

    suite('Function populateUserExperiments', async () => {
        testsForPopulateUserExperiments.forEach(testParams => {
            test(testParams.testName, async () => {
                experimentStorage.setup(n => n.value).returns(() => testParams.experimentStorageValue);
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
            expectedResult: false
        },
        {
            testName: 'If any experiment have `min` field missing, return false',
            experiments: [
                { name: 'experiment1', salt: 'salt', max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            expectedResult: false
        },
        {
            testName: 'If any experiment have `max` field missing, return false',
            experiments: [
                { name: 'experiment1', salt: 'salt', min: 79 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            expectedResult: false
        },
        {
            testName: 'If any experiment have `salt` field missing, return false',
            experiments: [
                { name: 'experiment1', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            expectedResult: false
        },
        {
            testName: 'If any experiment have `name` field missing, return false',
            experiments: [
                { salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            expectedResult: false
        },
        {
            testName: 'If all experiments contain all the fields in type `ABExperiment`, return true',
            experiments: [
                { name: 'experiment1', salt: 'salt', min: 79, max: 94 },
                { name: 'experiment2', salt: 'salt', min: 19, max: 30 }
            ],
            expectedResult: true
        }
    ];

    suite('Function areExperimentsValid()', () => {
        testsForAreExperimentsValid.forEach(testParams => {
            test(testParams.testName, () => {
                expect(expManager.areExperimentsValid(testParams.experiments as any)).to.equal(
                    testParams.expectedResult
                );
            });
        });
    });

    suite('Function doBestEffortToPopulateExperiments()', async () => {
        let downloadAndStoreExperiments: sinon.SinonStub<any>;

        test('If attempt to download experiments within timeout suceeds, return true', async () => {
            downloadAndStoreExperiments = sinon.stub(ExperimentsManager.prototype, 'downloadAndStoreExperiments');
            const timeout = 150;
            const downloadExperimentsDeferred = createDeferred<void>();
            downloadAndStoreExperiments.callsFake(() => downloadExperimentsDeferred.promise);
            expManager = new ExperimentsManager(
                instance(persistentStateFactory),
                instance(workspaceService),
                instance(httpClient),
                instance(crypto),
                instance(appEnvironment),
                output.object,
                instance(fs),
                instance(configurationService),
                timeout
            );

            // Download set to complete in 50 ms, timeout is of 150 ms, i.e download will complete within timeout
            const timer = setTimeout(() => downloadExperimentsDeferred.resolve(), 50);
            const result = await expManager.doBestEffortToPopulateExperiments();
            expect(result).to.equal(true, 'Expected value is true');
            assert.ok(downloadAndStoreExperiments.calledOnce);
            clearTimeout(timer);
        });

        test('If downloading experiments fails to complete within timeout, return false', async () => {
            downloadAndStoreExperiments = sinon.stub(ExperimentsManager.prototype, 'downloadAndStoreExperiments');
            const timeout = 100;
            const downloadExperimentsDeferred = createDeferred<void>();
            downloadAndStoreExperiments.callsFake(() => downloadExperimentsDeferred.promise);
            expManager = new ExperimentsManager(
                instance(persistentStateFactory),
                instance(workspaceService),
                instance(httpClient),
                instance(crypto),
                instance(appEnvironment),
                output.object,
                instance(fs),
                instance(configurationService),
                timeout
            );

            // Download set to complete in 200 ms, timeout is of 100 ms, i.e download will complete within timeout
            const timer = setTimeout(() => downloadExperimentsDeferred.resolve(), 200);
            const result = await expManager.doBestEffortToPopulateExperiments();
            expect(result).to.equal(false, 'Expected value is false');
            assert.ok(downloadAndStoreExperiments.calledOnce);
            clearTimeout(timer);
        });

        test('If downloading experiments fails with error, return false', async () => {
            downloadAndStoreExperiments = sinon.stub(ExperimentsManager.prototype, 'downloadAndStoreExperiments');
            downloadAndStoreExperiments.callsFake(() => Promise.reject('Kaboom'));
            expManager = new ExperimentsManager(
                instance(persistentStateFactory),
                instance(workspaceService),
                instance(httpClient),
                instance(crypto),
                instance(appEnvironment),
                output.object,
                instance(fs),
                instance(configurationService)
            );

            const result = await expManager.doBestEffortToPopulateExperiments();
            expect(result).to.equal(false, 'Expected value is false');
            assert.ok(downloadAndStoreExperiments.calledOnce);
        });
    });

    test('If storage as parameter is passed in as argument to function downloadAndStoreExperiments(), download experiments into that storage', async () => {
        downloadedExperimentsStorage
            .setup(n => n.updateValue(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        experimentStorage
            .setup(n => n.updateValue(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        isDownloadedStorageValid
            .setup(n => n.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        when(httpClient.getJSON(configUri, false)).thenResolve([
            { name: 'experiment1', salt: 'salt', min: 90, max: 100 }
        ]);

        await expManager.downloadAndStoreExperiments(experimentStorage.object);

        verify(httpClient.getJSON(configUri, false)).once();
        isDownloadedStorageValid.verifyAll();
        experimentStorage.verifyAll();
        downloadedExperimentsStorage.verifyAll();
    });
});
