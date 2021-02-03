// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, when, verify } from 'ts-mockito';
import { LanguageServerType } from '../../../client/activation/types';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { DiscoveryVariants, JediLSP } from '../../../client/common/experiments/groups';
import {
    inDiscoveryExperiment,
    setDefaultLanguageServerByExperiment,
} from '../../../client/common/experiments/helpers';
import { ExperimentService } from '../../../client/common/experiments/service';
import { IDefaultLanguageServer, IExperimentService } from '../../../client/common/types';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { IServiceManager } from '../../../client/ioc/types';
import { MockWorkspaceConfiguration } from '../../startPage/mockWorkspaceConfig';

suite('Experiments - inDiscoveryExperiment()', () => {
    let experimentService: IExperimentService;
    setup(() => {
        experimentService = mock(ExperimentService);
    });

    test('Return true if in discoverWithFileWatching experiment', async () => {
        when(experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching)).thenResolve(true);
        const result = await inDiscoveryExperiment(instance(experimentService));
        expect(result).to.equal(true);
    });

    test('Return true if in discoveryWithoutFileWatching experiment', async () => {
        when(experimentService.inExperiment(DiscoveryVariants.discoveryWithoutFileWatching)).thenResolve(true);
        const result = await inDiscoveryExperiment(instance(experimentService));
        expect(result).to.equal(true);
    });

    test('Return false otherwise', async () => {
        when(experimentService.inExperiment(anything())).thenResolve(false);
        const result = await inDiscoveryExperiment(instance(experimentService));
        expect(result).to.equal(false);
    });
});

suite('Experiments - setDefaultLanguageServerByExperiment()', () => {
    let experimentService: IExperimentService;
    let workspaceService: IWorkspaceService;
    let serviceManager: IServiceManager;
    setup(() => {
        experimentService = mock(ExperimentService);
        workspaceService = mock(WorkspaceService);
        serviceManager = mock(ServiceManager);
    });

    test('languageServer set by user', async () => {
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                languageServer: { globalValue: LanguageServerType.Node },
            }),
        );
        await setDefaultLanguageServerByExperiment(
            instance(experimentService),
            instance(workspaceService),
            instance(serviceManager),
        );

        verify(workspaceService.getConfiguration('python')).once();
        verify(experimentService.inExperiment(JediLSP.experiment)).never();
        verify(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).never();
    });

    test('languageServer NOT set by user and NOT in experiment', async () => {
        let defaultServerType;
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                languageServer: { defaultValue: LanguageServerType.Jedi },
            }),
        );
        when(experimentService.inExperiment(JediLSP.experiment)).thenResolve(false);
        when(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).thenCall(
            (_symbol, value: IDefaultLanguageServer) => {
                defaultServerType = value.defaultLSType;
            },
        );

        await setDefaultLanguageServerByExperiment(
            instance(experimentService),
            instance(workspaceService),
            instance(serviceManager),
        );

        verify(workspaceService.getConfiguration('python')).once();
        verify(experimentService.inExperiment(JediLSP.experiment)).once();
        verify(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).once();
        expect(defaultServerType).to.equal(LanguageServerType.Jedi);
    });

    test('languageServer NOT set by user and in experiment', async () => {
        let defaultServerType;
        when(workspaceService.getConfiguration('python')).thenReturn(
            new MockWorkspaceConfiguration({
                languageServer: { defaultValue: LanguageServerType.Jedi },
            }),
        );
        when(experimentService.inExperiment(JediLSP.experiment)).thenResolve(true);
        when(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).thenCall(
            (_symbol, value: IDefaultLanguageServer) => {
                defaultServerType = value.defaultLSType;
            },
        );

        await setDefaultLanguageServerByExperiment(
            instance(experimentService),
            instance(workspaceService),
            instance(serviceManager),
        );

        verify(workspaceService.getConfiguration('python')).once();
        verify(experimentService.inExperiment(JediLSP.experiment)).once();
        verify(serviceManager.addSingletonInstance<IDefaultLanguageServer>(IDefaultLanguageServer, anything())).once();
        expect(defaultServerType).to.equal(LanguageServerType.JediLSP);
    });
});
