// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, ConfigurationTarget, EventEmitter, WorkspaceConfiguration } from 'vscode';
import { ApplicationEnvironment } from '../../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { ExtensionChannelService, insidersChannelSetting, isThisFirstSessionStateKey } from '../../../client/common/insidersBuild/downloadChannelService';
import { ExtensionChannels } from '../../../client/common/insidersBuild/types';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IConfigurationService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';

// tslint:disable-next-line:max-func-body-length
suite('Download channel service', () => {
    let configService: IConfigurationService;
    let appEnvironment: IApplicationEnvironment;
    let workspaceService: IWorkspaceService;
    let channelService: ExtensionChannelService;
    let persistentState: IPersistentStateFactory;
    let isThisFirstSessionState: TypeMoq.IMock<IPersistentState<boolean>>;
    let configChangeEvent: EventEmitter<ConfigurationChangeEvent>;
    setup(() => {
        configService = mock(ConfigurationService);
        appEnvironment = mock(ApplicationEnvironment);
        workspaceService = mock(WorkspaceService);
        configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
        when(workspaceService.onDidChangeConfiguration).thenReturn(configChangeEvent.event);
        persistentState = mock(PersistentStateFactory);
        isThisFirstSessionState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentState.createGlobalPersistentState(isThisFirstSessionStateKey, true)).thenReturn(isThisFirstSessionState.object);
        channelService = new ExtensionChannelService(instance(appEnvironment), instance(configService), instance(workspaceService), instance(persistentState), []);
    });

    teardown(() => {
        configChangeEvent.dispose();
    });

    [
        {
            testName: 'Get channel returns \'InsidersWeekly\' if user is using default setting in the first session and is using VS Code Insiders',
            settings: {},
            vscodeChannel: 'insiders',
            expectedResult: 'InsidersWeekly'
        },
        {
            testName: 'Get channel returns \'Stable\' if user is using default setting and is using VS Code Stable',
            settings: {},
            vscodeChannel: 'stable',
            expectedResult: 'Stable'
        },
        {
            testName: 'Get channel returns \'Stable\' if settings value is set to \'Stable\'',
            settings: { globalValue: 'Stable' },
            vscodeChannel: 'insiders',
            expectedResult: 'Stable'
        },
        {
            testName: 'Get channel returns \'InsidersWeekly\' if settings value is set to \'InsidersWeekly\'',
            settings: { globalValue: 'InsidersWeekly' },
            vscodeChannel: 'insiders',
            expectedResult: 'InsidersWeekly'
        },
        {
            testName: 'Get channel returns \'InsidersDaily\' if settings value is set to \'InsidersDaily\'',
            settings: { globalValue: 'InsidersDaily' },
            vscodeChannel: 'insiders',
            expectedResult: 'InsidersDaily'
        }
    ].forEach(testParams => {
        test(testParams.testName, async () => {
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            const settings = testParams.settings;

            when(
                workspaceService.getConfiguration('python')
            ).thenReturn(workspaceConfig.object);
            workspaceConfig.setup(c => c.inspect<ExtensionChannels>(insidersChannelSetting))
                .returns(() => settings as any)
                .verifiable(TypeMoq.Times.once());
            isThisFirstSessionState
                .setup(u => u.value)
                .returns(() => true);
            isThisFirstSessionState
                .setup(u => u.updateValue(false))
                .returns(() => Promise.resolve());
            when(appEnvironment.channel).thenReturn(testParams.vscodeChannel as any);
            const channel = await channelService.getChannel();
            expect(channel).to.equal(testParams.expectedResult);
            workspaceConfig.verifyAll();
        });
    });

    test('Get channel returns \'Stable\' if user is using default setting and is using VS Code Insiders, but this is not the first session', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = {};

        when(
            workspaceService.getConfiguration('python')
        ).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<ExtensionChannels>(insidersChannelSetting))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        isThisFirstSessionState
            .setup(u => u.value)
            .returns(() => false);
        isThisFirstSessionState
            .setup(u => u.updateValue(false))
            .returns(() => Promise.resolve());
        when(appEnvironment.channel).thenReturn('insiders');
        const channel = await channelService.getChannel();
        expect(channel).to.equal('Stable');
        workspaceConfig.verifyAll();
    });

    test('Get channel throws error if not setting is found', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = undefined;

        when(
            workspaceService.getConfiguration('python')
        ).thenReturn(workspaceConfig.object);
        workspaceConfig.setup(c => c.inspect<ExtensionChannels>(insidersChannelSetting))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        await expect(channelService.getChannel()).to.eventually.be.rejected;
        workspaceConfig.verifyAll();
    });

    test('Update channel updates configuration settings', async () => {
        const value = 'Random';
        when(
            configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global)
        ).thenResolve(undefined);
        await channelService.updateChannel(value as any);
        verify(
            configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global)
        ).once();
    });

    test('Update channel throws error when updates configuration settings fails', async () => {
        const value = 'Random';
        when(
            configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global)
        ).thenThrow(new Error('Kaboom'));
        const promise = channelService.updateChannel(value as any);
        await expect(promise).to.eventually.be.rejectedWith('Kaboom');
    });

    test('If insidersChannelSetting is changed, an event is fired', async () => {
        const _onDidChannelChange = TypeMoq.Mock.ofType<EventEmitter<ExtensionChannels>>();
        const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
        const settings = { insidersChannel: 'Stable' };
        event
            .setup(e => e.affectsConfiguration(`python.${insidersChannelSetting}`))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        when(
            configService.getSettings()
        ).thenReturn(settings as any);
        channelService._onDidChannelChange = _onDidChannelChange.object;
        _onDidChannelChange
            .setup(emitter => emitter.fire(TypeMoq.It.isValue(settings.insidersChannel as any)))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        await channelService.onDidChangeConfiguration(event.object);
        _onDidChannelChange.verifyAll();
        event.verifyAll();
        verify(
            configService.getSettings()
        ).once();
    });

    test('If some other setting changed, no event is fired', async () => {
        const _onDidChannelChange = TypeMoq.Mock.ofType<EventEmitter<ExtensionChannels>>();
        const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
        const settings = { insidersChannel: 'Stable' };
        event
            .setup(e => e.affectsConfiguration(`python.${insidersChannelSetting}`))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        when(
            configService.getSettings()
        ).thenReturn(settings as any);
        channelService._onDidChannelChange = _onDidChannelChange.object;
        _onDidChannelChange
            .setup(emitter => emitter.fire(TypeMoq.It.isValue(settings.insidersChannel as any)))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.never());
        await channelService.onDidChangeConfiguration(event.object);
        _onDidChannelChange.verifyAll();
        event.verifyAll();
        verify(
            configService.getSettings()
        ).never();
    });
});
