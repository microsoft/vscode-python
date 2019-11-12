// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, ConfigurationTarget, EventEmitter, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { ExtensionChannelService, insidersChannelSetting } from '../../../client/common/insidersBuild/downloadChannelService';
import { ExtensionChannels } from '../../../client/common/insidersBuild/types';
import { IConfigurationService } from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { sleep } from '../../../test/common';

// tslint:disable-next-line:max-func-body-length
suite('Download channel service', () => {
    let configService: IConfigurationService;
    let workspaceService: IWorkspaceService;
    let channelService: ExtensionChannelService;
    let configChangeEvent: EventEmitter<ConfigurationChangeEvent>;
    setup(() => {
        configService = mock(ConfigurationService);
        workspaceService = mock(WorkspaceService);
        configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
        when(workspaceService.onDidChangeConfiguration).thenReturn(configChangeEvent.event);
        channelService = new ExtensionChannelService(instance(configService), instance(workspaceService), []);
    });

    teardown(() => {
        configChangeEvent.dispose();
    });

    [
        {
            testName: "Get channel returns 'off' if settings value is set to 'off'",
            settings: 'off',
            expectedResult: 'off'
        },
        {
            testName: "Get channel returns 'weekly' if settings value is set to 'weekly'",
            settings: 'weekly',
            expectedResult: 'weekly'
        },
        {
            testName: "Get channel returns 'daily' if settings value is set to 'daily'",
            settings: 'daily',
            expectedResult: 'daily'
        }
    ].forEach(testParams => {
        test(testParams.testName, async () => {
            when(configService.getSettings()).thenReturn({ insidersChannel: testParams.settings as ExtensionChannels } as any);
            const result = channelService.getChannel();
            expect(result).to.equal(testParams.expectedResult);
            verify(configService.getSettings()).once();
        });
    });

    test('Function isChannelUsingDefaultConfiguration() returns false if setting is set', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = { globalValue: 'off' };

        when(workspaceService.getConfiguration('python')).thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<ExtensionChannels>(insidersChannelSetting))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        expect(channelService.isChannelUsingDefaultConfiguration).to.equal(false, 'Incorrect value');
        workspaceConfig.verifyAll();
    });

    test('Function isChannelUsingDefaultConfiguration() returns true if setting is not set', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = { globalValue: undefined };

        when(workspaceService.getConfiguration('python')).thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<ExtensionChannels>(insidersChannelSetting))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        expect(channelService.isChannelUsingDefaultConfiguration).to.equal(true, 'Incorrect value');
        workspaceConfig.verifyAll();
    });

    test('Function isChannelUsingDefaultConfiguration() throws error if not setting is found', async () => {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        const settings = undefined;

        when(workspaceService.getConfiguration('python')).thenReturn(workspaceConfig.object);
        workspaceConfig
            .setup(c => c.inspect<ExtensionChannels>(insidersChannelSetting))
            .returns(() => settings as any)
            .verifiable(TypeMoq.Times.once());
        expect(() => channelService.isChannelUsingDefaultConfiguration).to.throw();
        workspaceConfig.verifyAll();
    });

    test('Update channel updates configuration settings', async () => {
        const value = 'Random';
        when(configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global)).thenResolve(undefined);
        await channelService.updateChannel(value as any);
        verify(configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global)).once();
    });

    test('Update channel throws error when updates configuration settings fails', async () => {
        const value = 'Random';
        when(configService.updateSetting(insidersChannelSetting, value, undefined, ConfigurationTarget.Global)).thenThrow(new Error('Kaboom'));
        const promise = channelService.updateChannel(value as any);
        await expect(promise).to.eventually.be.rejectedWith('Kaboom');
    });

    test('If insidersChannelSetting is changed, an event is fired', async () => {
        const _onDidChannelChange = TypeMoq.Mock.ofType<EventEmitter<ExtensionChannels>>();
        const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
        const settings = { insidersChannel: 'off' };
        event
            .setup(e => e.affectsConfiguration(`python.${insidersChannelSetting}`))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        when(configService.getSettings()).thenReturn(settings as any);
        channelService._onDidChannelChange = _onDidChannelChange.object;
        _onDidChannelChange
            .setup(emitter => emitter.fire(TypeMoq.It.isValue(settings.insidersChannel as any)))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        await channelService.onDidChangeConfiguration(event.object);
        _onDidChannelChange.verifyAll();
        event.verifyAll();
        verify(configService.getSettings()).once();
    });

    test('If some other setting changed, no event is fired', async () => {
        const _onDidChannelChange = TypeMoq.Mock.ofType<EventEmitter<ExtensionChannels>>();
        const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
        const settings = { insidersChannel: 'off' };
        event
            .setup(e => e.affectsConfiguration(`python.${insidersChannelSetting}`))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        when(configService.getSettings()).thenReturn(settings as any);
        channelService._onDidChannelChange = _onDidChannelChange.object;
        _onDidChannelChange
            .setup(emitter => emitter.fire(TypeMoq.It.isValue(settings.insidersChannel as any)))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.never());
        await channelService.onDidChangeConfiguration(event.object);
        _onDidChannelChange.verifyAll();
        event.verifyAll();
        verify(configService.getSettings()).never();
    });

    test('Ensure on channel change captures the fired event with the correct arguments', async () => {
        const deferred = createDeferred<true>();
        const settings = { insidersChannel: 'off' };
        channelService.onDidChannelChange(channel => {
            expect(channel).to.equal(settings.insidersChannel);
            deferred.resolve(true);
        });
        channelService._onDidChannelChange.fire(settings.insidersChannel as any);
        const eventCaptured = await Promise.race([deferred.promise, sleep(1000).then(() => false)]);
        expect(eventCaptured).to.equal(true, 'Event should be captured');
    });
});
