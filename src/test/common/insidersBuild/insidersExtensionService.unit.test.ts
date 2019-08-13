// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import * as assert from 'assert';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { EventEmitter } from 'vscode';
import { ApplicationEnvironment } from '../../../client/common/application/applicationEnvironment';
import { CommandManager } from '../../../client/common/application/commandManager';
import { Channel, IApplicationEnvironment, ICommandManager } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { ExtensionChannelService } from '../../../client/common/insidersBuild/downloadChannelService';
import { InsidersExtensionPrompt } from '../../../client/common/insidersBuild/insidersExtensionPrompt';
import { InsidersExtensionService } from '../../../client/common/insidersBuild/insidersExtensionService';
import { ExtensionChannels, IExtensionChannelRule, IExtensionChannelService, IInsiderExtensionPrompt } from '../../../client/common/insidersBuild/types';
import { InsidersBuildInstaller } from '../../../client/common/installer/extensionBuildInstaller';
import { IExtensionBuildInstaller } from '../../../client/common/installer/types';
import { IDisposable, IPersistentState } from '../../../client/common/types';
import { createDeferred, createDeferredFromPromise } from '../../../client/common/utils/async';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { sleep } from '../../../test/core';

suite('Insiders Extension Service - Handle channel', () => {
    let appEnvironment: IApplicationEnvironment;
    let serviceContainer: IServiceContainer;
    let extensionChannelService: IExtensionChannelService;
    let cmdManager: ICommandManager;
    let insidersPrompt: IInsiderExtensionPrompt;
    let insidersInstaller: IExtensionBuildInstaller;
    let insidersExtensionService: InsidersExtensionService;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        insidersInstaller = mock(InsidersBuildInstaller);
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), instance(insidersInstaller), []);
    });

    teardown(() => {
        sinon.restore();
    });

    test('If insiders is not be installed, handling channel does not do anything and simply returns', async () => {
        const channelRule = TypeMoq.Mock.ofType<IExtensionChannelRule>();
        when(serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, 'off')).thenReturn(channelRule.object);
        channelRule
            .setup(c => c.shouldLookForInsidersBuild(false))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        when(
            insidersInstaller.install()
        ).thenResolve(undefined);
        await insidersExtensionService.handleChannel('off');
        verify(
            insidersInstaller.install()
        ).never();
        channelRule.verifyAll();
    });

    test('If insiders is required to be installed, handling channel installs the build and prompts user', async () => {
        const channelRule = TypeMoq.Mock.ofType<IExtensionChannelRule>();
        when(serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, 'weekly')).thenReturn(channelRule.object);
        channelRule
            .setup(c => c.shouldLookForInsidersBuild(false))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        when(
            insidersInstaller.install()
        ).thenResolve(undefined);
        when(
            insidersPrompt.promptToReload()
        ).thenResolve(undefined);
        await insidersExtensionService.handleChannel('weekly');
        verify(
            insidersInstaller.install()
        ).once();
        verify(
            insidersPrompt.promptToReload()
        ).once();
        channelRule.verifyAll();
    });
});

// tslint:disable-next-line: max-func-body-length
suite('Insiders Extension Service - Activation', () => {
    let appEnvironment: IApplicationEnvironment;
    let serviceContainer: IServiceContainer;
    let extensionChannelService: IExtensionChannelService;
    let cmdManager: ICommandManager;
    let insidersPrompt: IInsiderExtensionPrompt;
    let registerCommandsAndHandlers: sinon.SinonStub<any>;
    let handleChannel: sinon.SinonStub<any>;
    let handleEdgeCases: sinon.SinonStub<any>;
    let insidersInstaller: IExtensionBuildInstaller;
    let insidersExtensionService: InsidersExtensionService;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        insidersInstaller = mock(InsidersBuildInstaller);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        handleEdgeCases = sinon.stub(InsidersExtensionService.prototype, 'handleEdgeCases');
        handleEdgeCases.callsFake(() => Promise.resolve());
        registerCommandsAndHandlers = sinon.stub(InsidersExtensionService.prototype, 'registerCommandsAndHandlers');
        registerCommandsAndHandlers.callsFake(() => Promise.resolve());
    });

    teardown(() => {
        sinon.restore();
    });

    test('Execution goes as expected if there are no errors', async () => {
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), instance(insidersInstaller), []);
        when(extensionChannelService.getChannel()).thenReturn('daily');

        await insidersExtensionService.activate();

        verify(extensionChannelService.getChannel()).once();
        assert.ok(registerCommandsAndHandlers.calledOnce);
        assert.ok(handleEdgeCases.calledOnce);
        assert.ok(handleChannel.calledOnce);
        expect(handleChannel.args[0][0]).to.equal('daily');
    });

    test('Ensure channels are reliably handled in the background', async () => {
        const handleChannelsDeferred = createDeferred<void>();
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => handleChannelsDeferred.promise);
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), instance(insidersInstaller), []);
        when(extensionChannelService.getChannel()).thenReturn('daily');

        const promise = insidersExtensionService.activate();
        const deferred = createDeferredFromPromise(promise);
        await sleep(1);

        // Ensure activate() function has completed while handleChannel is still running
        assert.equal(deferred.completed, true);

        handleChannelsDeferred.resolve();
        await sleep(1);

        assert.ok(registerCommandsAndHandlers.calledOnce);
        assert.ok(handleEdgeCases.calledOnce);
        assert.ok(handleChannel.calledOnce);
        expect(handleChannel.args[0][0]).to.equal('daily');
    });
});

// tslint:disable-next-line: max-func-body-length
suite('Insiders Extension Service - Function handleEdgeCases()', () => {
    let appEnvironment: IApplicationEnvironment;
    let serviceContainer: IServiceContainer;
    let extensionChannelService: IExtensionChannelService;
    let cmdManager: ICommandManager;
    let insidersPrompt: IInsiderExtensionPrompt;
    let hasUserBeenNotifiedState: TypeMoq.IMock<IPersistentState<boolean>>;
    let insidersExtensionService: InsidersExtensionService;
    let insidersInstaller: IExtensionBuildInstaller;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        insidersInstaller = mock(InsidersBuildInstaller);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        hasUserBeenNotifiedState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(insidersPrompt.hasUserBeenNotified).thenReturn(hasUserBeenNotifiedState.object);
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), instance(insidersInstaller), []);
    });

    teardown(() => {
        sinon.restore();
    });

    const testsForHandleEdgeCases: {
        vscodeChannel: Channel;
        hasUserBeenNotified?: boolean;
        installChannel?: ExtensionChannels;
        isChannelUsingDefaultConfiguration?: boolean;
        extensionChannel?: Channel;
        operation: 'Set channel to off' | 'Insiders Install Prompt' | undefined;
    }[] =
        [
            {
                vscodeChannel: 'stable',
                installChannel: 'daily',
                extensionChannel: 'stable',
                operation: 'Set channel to off'
            },
            {
                vscodeChannel: 'stable',
                installChannel: 'daily',
                extensionChannel: 'insiders',
                operation: undefined
            },
            {
                vscodeChannel: 'stable',
                installChannel: 'off',
                operation: undefined
            },
            {
                vscodeChannel: 'insiders',
                hasUserBeenNotified: true,
                installChannel: 'off',
                operation: undefined
            },
            {
                vscodeChannel: 'insiders',
                hasUserBeenNotified: false,
                isChannelUsingDefaultConfiguration: false,
                installChannel: 'off',
                operation: undefined
            },
            {
                vscodeChannel: 'insiders',
                hasUserBeenNotified: false,
                isChannelUsingDefaultConfiguration: true,
                operation: 'Insiders Install Prompt'
            },
            {
                // TEST: Ensure when conditions for both operations are met, 'Insiders Install prompt' is given preference
                vscodeChannel: 'insiders',
                hasUserBeenNotified: false,
                isChannelUsingDefaultConfiguration: true,
                installChannel: 'daily',
                extensionChannel: 'stable',
                operation: 'Insiders Install Prompt'
            }
        ];

    testsForHandleEdgeCases.forEach(testParams => {
        const testName = `${testParams.operation ? testParams.operation : 'No prompt'} is displayed when vscode channel = '${testParams.vscodeChannel}', extension channel = '${testParams.extensionChannel}', install channel = '${testParams.installChannel}', ${!testParams.hasUserBeenNotified ? 'user has not been notified to install insiders' : 'user has already been notified to install insiders'}, isChannelUsingDefaultConfiguration = ${testParams.isChannelUsingDefaultConfiguration}`;
        test(testName, async () => {
            hasUserBeenNotifiedState
                .setup(c => c.value)
                .returns(() => testParams.hasUserBeenNotified !== undefined ? testParams.hasUserBeenNotified : true);
            when(appEnvironment.channel).thenReturn(testParams.vscodeChannel);
            when(appEnvironment.extensionChannel).thenReturn(testParams.extensionChannel ? testParams.extensionChannel : 'stable');
            when(insidersPrompt.notifyToInstallInsiders()).thenResolve();
            when(extensionChannelService.updateChannel('off')).thenResolve();
            when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(testParams.isChannelUsingDefaultConfiguration !== undefined ? testParams.isChannelUsingDefaultConfiguration : true);
            await insidersExtensionService.handleEdgeCases(testParams.installChannel !== undefined ? testParams.installChannel : 'off');
            if (testParams.operation === 'Set channel to off') {
                verify(extensionChannelService.updateChannel('off')).once();
                verify(insidersPrompt.notifyToInstallInsiders()).never();
            } else if (testParams.operation === 'Insiders Install Prompt') {
                verify(extensionChannelService.updateChannel('off')).never();
                verify(insidersPrompt.notifyToInstallInsiders()).once();
            } else {
                verify(extensionChannelService.updateChannel('off')).never();
                verify(insidersPrompt.notifyToInstallInsiders()).never();
            }
            verify(appEnvironment.channel).once();
        });
    });
});

// tslint:disable-next-line: max-func-body-length
suite('Insiders Extension Service - Function registerCommandsAndHandlers()', () => {
    let appEnvironment: IApplicationEnvironment;
    let serviceContainer: IServiceContainer;
    let extensionChannelService: IExtensionChannelService;
    let cmdManager: ICommandManager;
    let insidersPrompt: IInsiderExtensionPrompt;
    let channelChangeEvent: EventEmitter<ExtensionChannels>;
    let handleChannel: sinon.SinonStub<any>;
    let insidersExtensionService: InsidersExtensionService;
    let insidersInstaller: IExtensionBuildInstaller;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        insidersInstaller = mock(InsidersBuildInstaller);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        channelChangeEvent = new EventEmitter<ExtensionChannels>();
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), instance(insidersInstaller), []);
    });

    teardown(() => {
        sinon.restore();
        channelChangeEvent.dispose();
    });

    test('Ensure commands and handlers get registered, and disposables returned are in the disposable list', async () => {
        const disposable1 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable2 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable3 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable4 = TypeMoq.Mock.ofType<IDisposable>();
        when(extensionChannelService.onDidChannelChange).thenReturn(() => disposable1.object);
        when(cmdManager.registerCommand(Commands.SwitchOffInsidersChannel, anything())).thenReturn(disposable2.object);
        when(cmdManager.registerCommand(Commands.SwitchToInsidersDaily, anything())).thenReturn(disposable3.object);
        when(cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, anything())).thenReturn(disposable4.object);

        insidersExtensionService.registerCommandsAndHandlers();

        expect(insidersExtensionService.disposables.length).to.equal(4);
        verify(extensionChannelService.onDidChannelChange).once();
        verify(cmdManager.registerCommand(Commands.SwitchOffInsidersChannel, anything())).once();
        verify(cmdManager.registerCommand(Commands.SwitchToInsidersDaily, anything())).once();
        verify(cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, anything())).once();
    });

    test('Ensure commands and handlers get registered with the correct callback handlers', async () => {
        const disposable1 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable2 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable3 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable4 = TypeMoq.Mock.ofType<IDisposable>();
        let channelChangedHandler!: Function;
        let switchTooffHandler!: Function;
        let switchToInsidersDailyHandler!: Function;
        let switchToweeklyHandler!: Function;
        when(extensionChannelService.onDidChannelChange).thenReturn(cb => { channelChangedHandler = cb; return disposable1.object; });
        when(cmdManager.registerCommand(Commands.SwitchOffInsidersChannel, anything())).thenCall((_, cb) => { switchTooffHandler = cb; return disposable2.object; });
        when(cmdManager.registerCommand(Commands.SwitchToInsidersDaily, anything())).thenCall((_, cb) => { switchToInsidersDailyHandler = cb; return disposable3.object; });
        when(cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, anything())).thenCall((_, cb) => { switchToweeklyHandler = cb; return disposable4.object; });

        insidersExtensionService.registerCommandsAndHandlers();

        channelChangedHandler('Some channel');
        assert.ok(handleChannel.calledOnce);

        when(extensionChannelService.updateChannel('off')).thenResolve();
        await switchTooffHandler();
        verify(extensionChannelService.updateChannel('off')).once();

        when(extensionChannelService.updateChannel('daily')).thenResolve();
        await switchToInsidersDailyHandler();
        verify(extensionChannelService.updateChannel('daily')).once();

        when(extensionChannelService.updateChannel('weekly')).thenResolve();
        await switchToweeklyHandler();
        verify(extensionChannelService.updateChannel('weekly')).once();
    });
});
