// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { IHttpClient } from '../../client/activation/types';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { CryptoUtils } from '../../client/common/crypto';
import { ExperimentsManager } from '../../client/common/experiments';
import { HttpClient } from '../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { ICryptoUtils, IPersistentState, IPersistentStateFactory } from '../../client/common/types';

// tslint:disable-next-line: max-func-body-length
suite('xA/B experiments', () => {
    let workspaceService: IWorkspaceService;
    let httpClient: IHttpClient;
    let crypto: ICryptoUtils;
    let appEnvironment: IApplicationEnvironment;
    let persistentStateFactory: IPersistentStateFactory;
    let expManager: ExperimentsManager;
    setup(() => {
        workspaceService = mock(WorkspaceService);
        httpClient = mock(HttpClient);
        crypto = mock(CryptoUtils);
        appEnvironment = mock(ApplicationEnvironment);
        persistentStateFactory = mock(PersistentStateFactory);
        expManager = new ExperimentsManager(instance(persistentStateFactory), instance(workspaceService), instance(httpClient), instance(crypto), instance(appEnvironment));
    });

    test('If the users have opted out of telemetry, then they are opted out of AB testing ', async () => {
        const settings = { globalValue: false };
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        when(workspaceService.getConfiguration('telemetry', anything())).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).thenReturn(experimentStorage.object);

        await expManager.initializeInBackground();

        verify(workspaceService.getConfiguration('telemetry', anything())).once();
        workspaceConfig.verifyAll();
        verify(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).never();
    });

    test('Initializing experiments does not download experiments if storage is valid and contains experiments', async () => {
        const settings = {};
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        when(workspaceService.getConfiguration('telemetry', anything())).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).thenReturn(experimentStorage.object);
        experimentStorage.setup(n => n.value).returns(() => [{ name: 'exp', salt: 'salt', min: 90, max: 100 }]).verifiable(TypeMoq.Times.exactly(2));
        when(httpClient.getJSONC(anything(), { allowTrailingComma: true, disallowComments: false })).thenResolve([{ name: 'exp', salt: 'salt', min: 90, max: 100 }]);

        await expManager.initializeInBackground();

        verify(workspaceService.getConfiguration('telemetry', anything())).once();
        workspaceConfig.verifyAll();
        verify(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).once();
        experimentStorage.verifyAll();
        verify(httpClient.getJSONC(anything(), { allowTrailingComma: true, disallowComments: false })).never();
    });

    test('Initializing experiments downloads and stores the experiments if storage does not contain experiments', async () => {
        const settings = {};
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        when(workspaceService.getConfiguration('telemetry', anything())).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).thenReturn(experimentStorage.object);
        experimentStorage.setup(n => n.value).returns(() => undefined).verifiable(TypeMoq.Times.once());
        when(httpClient.getJSONC(anything(), anything())).thenResolve([{ name: 'exp', salt: 'salt', min: 90, max: 100 }]);
        experimentStorage.setup(n => n.updateValue([{ name: 'exp', salt: 'salt', min: 90, max: 100 }])).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.once());

        await expManager.initializeInBackground();

        verify(workspaceService.getConfiguration('telemetry', anything())).once();
        workspaceConfig.verifyAll();
        verify(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).once();
        experimentStorage.verifyAll();
        verify(httpClient.getJSONC(anything(), anything())).once();
    });

    test('If downloading experiments fails with error, the storage is left as it is', async () => {
        const settings = {};
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const experimentStorage = TypeMoq.Mock.ofType<IPersistentState<any>>();
        when(workspaceService.getConfiguration('telemetry', anything())).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<boolean>('enableTelemetry'))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        when(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).thenReturn(experimentStorage.object);
        experimentStorage.setup(n => n.value).returns(() => undefined).verifiable(TypeMoq.Times.once());
        when(httpClient.getJSONC(anything(), anything())).thenReject(new Error('Kaboom'));
        experimentStorage.setup(n => n.updateValue(anything())).returns(() => Promise.resolve(undefined)).verifiable(TypeMoq.Times.never());

        await expManager.initializeInBackground();

        verify(workspaceService.getConfiguration('telemetry', anything())).once();
        workspaceConfig.verifyAll();
        verify(persistentStateFactory.createGlobalPersistentState(anything(), undefined as any, anything())).once();
        experimentStorage.verifyAll();
        verify(httpClient.getJSONC(anything(), anything())).once();
    });
    const testsForisEnabled =
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
        testsForisEnabled.forEach(testParams => {
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
