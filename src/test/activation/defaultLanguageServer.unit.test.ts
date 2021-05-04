// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, when, verify } from 'ts-mockito';
import { Extension } from 'vscode';
import { setDefaultLanguageServer } from '../../client/activation/common/defaultlanguageServer';
import { LanguageServerType } from '../../client/activation/types';
import { PYLANCE_EXTENSION_ID } from '../../client/common/constants';
import { JediLSP } from '../../client/common/experiments/groups';
import { ExperimentService } from '../../client/common/experiments/service';
import { IDefaultLanguageServer, IExperimentService, IExtensions } from '../../client/common/types';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';

suite('Activation - setDefaultLanguageServer()', () => {
    let experimentService: IExperimentService;
    let extensions: IExtensions;
    let extension: Extension<unknown>;
    let serviceManager: IServiceManager;
    setup(() => {
        experimentService = mock(ExperimentService);
        extensions = mock();
        extension = mock();
        serviceManager = mock(ServiceManager);
    });

    test('Pylance not installed and NOT in experiment', async () => {
        let defaultServerType;

        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(undefined);
        when(experimentService.inExperiment(JediLSP.experiment)).thenResolve(false);
        when(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).thenCall(
            (_symbol, value: IDefaultLanguageServer) => {
                defaultServerType = value.defaultLSType;
            },
        );

        await setDefaultLanguageServer(instance(experimentService), instance(extensions), instance(serviceManager));

        verify(extensions.getExtension(PYLANCE_EXTENSION_ID)).once();
        verify(experimentService.inExperiment(JediLSP.experiment)).once();
        verify(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).once();
        expect(defaultServerType).to.equal(LanguageServerType.Jedi);
    });

    test('Pylance not installed and in experiment', async () => {
        let defaultServerType;
        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(undefined);
        when(experimentService.inExperiment(JediLSP.experiment)).thenResolve(true);
        when(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).thenCall(
            (_symbol, value: IDefaultLanguageServer) => {
                defaultServerType = value.defaultLSType;
            },
        );

        await setDefaultLanguageServer(instance(experimentService), instance(extensions), instance(serviceManager));

        verify(extensions.getExtension(PYLANCE_EXTENSION_ID)).once();
        verify(experimentService.inExperiment(JediLSP.experiment)).once();
        verify(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).once();
        expect(defaultServerType).to.equal(LanguageServerType.JediLSP);
    });

    test('Pylance installed and NOT in experiment', async () => {
        let defaultServerType;

        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(extension));
        when(experimentService.inExperiment(JediLSP.experiment)).thenResolve(false);
        when(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).thenCall(
            (_symbol, value: IDefaultLanguageServer) => {
                defaultServerType = value.defaultLSType;
            },
        );

        await setDefaultLanguageServer(instance(experimentService), instance(extensions), instance(serviceManager));

        verify(extensions.getExtension(PYLANCE_EXTENSION_ID)).once();
        verify(experimentService.inExperiment(JediLSP.experiment)).never();
        verify(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).once();
        expect(defaultServerType).to.equal(LanguageServerType.Node);
    });

    test('Pylance installed and in experiment', async () => {
        let defaultServerType;
        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(extension));
        when(experimentService.inExperiment(JediLSP.experiment)).thenResolve(true);
        when(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).thenCall(
            (_symbol, value: IDefaultLanguageServer) => {
                defaultServerType = value.defaultLSType;
            },
        );

        await setDefaultLanguageServer(instance(experimentService), instance(extensions), instance(serviceManager));

        verify(extensions.getExtension(PYLANCE_EXTENSION_ID)).once();
        verify(experimentService.inExperiment(JediLSP.experiment)).never();
        verify(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).once();
        expect(defaultServerType).to.equal(LanguageServerType.Node);
    });
});
