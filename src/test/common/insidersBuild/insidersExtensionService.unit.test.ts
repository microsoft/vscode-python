// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import * as assert from 'assert';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { EventEmitter, Uri } from 'vscode';
import { ApplicationEnvironment } from '../../../client/common/application/applicationEnvironment';
import { CommandManager } from '../../../client/common/application/commandManager';
import { Channel, IApplicationEnvironment, ICommandManager } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { ExtensionChannelService } from '../../../client/common/insidersBuild/downloadChannelService';
import { InsidersExtensionPrompt } from '../../../client/common/insidersBuild/insidersExtensionPrompt';
import { InsidersExtensionService } from '../../../client/common/insidersBuild/insidersExtensionService';
import { ExtensionChannels, IExtensionChannelRule, IExtensionChannelService, IInsiderExtensionPrompt } from '../../../client/common/insidersBuild/types';
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
    let choosePromptAndDisplay: sinon.SinonStub<any>;
    let insidersExtensionService: InsidersExtensionService;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        choosePromptAndDisplay = sinon.stub(InsidersExtensionService.prototype, 'choosePromptAndDisplay');
        choosePromptAndDisplay.callsFake(() => Promise.resolve());
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), []);
    });

    teardown(() => {
        sinon.restore();
    });

    test('If no build installer is returned, handling channel does not do anything and simply returns', async () => {
        const channelRule = TypeMoq.Mock.ofType<IExtensionChannelRule>();
        when(serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, 'Stable')).thenReturn(channelRule.object);
        channelRule
            .setup(c => c.getInstaller(false))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await insidersExtensionService.handleChannel('Stable');
        channelRule.verifyAll();
        assert.ok(choosePromptAndDisplay.notCalled);
    });

    test('If build installer is returned, handling channel installs the build and prompts user', async () => {
        const channelRule = TypeMoq.Mock.ofType<IExtensionChannelRule>();
        const buildInstaller = TypeMoq.Mock.ofType<IExtensionBuildInstaller>();
        buildInstaller.setup(b => (b as any).then).returns(() => undefined);
        when(serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, 'Stable')).thenReturn(channelRule.object);
        channelRule
            .setup(c => c.getInstaller(false))
            .returns(() => Promise.resolve(buildInstaller.object))
            .verifiable(TypeMoq.Times.once());
        buildInstaller
            .setup(b => b.install())
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        await insidersExtensionService.handleChannel('Stable');
        channelRule.verifyAll();
        buildInstaller.verifyAll();
        expect(choosePromptAndDisplay.args[0][0]).to.equal('Stable');
        expect(choosePromptAndDisplay.args[0][1]).to.equal(false, 'Should be false');
        assert.ok(choosePromptAndDisplay.calledOnce);
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
    let insidersExtensionService: InsidersExtensionService;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        registerCommandsAndHandlers = sinon.stub(InsidersExtensionService.prototype, 'registerCommandsAndHandlers');
        registerCommandsAndHandlers.callsFake(() => Promise.resolve());
    });

    teardown(() => {
        sinon.restore();
    });

    test('If service has been activated once, simply return', async () => {
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), []);
        insidersExtensionService.activatedOnce = true;
        await insidersExtensionService.activate(Uri.parse('r'));
        assert.ok(registerCommandsAndHandlers.notCalled);
    });

    const testsForActivation: {
        installChannel: ExtensionChannels;
        extensionChannel: Channel;
        expectedResult: boolean;
    }[] =
        [
            {
                installChannel: 'Stable',
                extensionChannel: 'stable',
                expectedResult: false
            },
            {
                installChannel: 'Stable',
                extensionChannel: 'insiders',
                expectedResult: true
            },
            {
                installChannel: 'InsidersDaily',
                extensionChannel: 'stable',
                expectedResult: true
            }, {
                installChannel: 'InsidersDaily',
                extensionChannel: 'insiders',
                expectedResult: false
            }, {
                installChannel: 'InsidersWeekly',
                extensionChannel: 'stable',
                expectedResult: true
            }, {
                installChannel: 'InsidersWeekly',
                extensionChannel: 'insiders',
                expectedResult: false
            }
        ];

    testsForActivation.forEach(testParams => {
        const testName = `Handle channel is passed with didChannelChange argument = '${testParams.expectedResult}' when installChannel = '${testParams.installChannel}' and extensionChannel = '${testParams.extensionChannel}'`;
        test(testName, async () => {
            handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
            handleChannel.callsFake(() => Promise.resolve());
            insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), []);
            when(extensionChannelService.getChannel()).thenResolve(testParams.installChannel);
            when(appEnvironment.extensionChannel).thenReturn(testParams.extensionChannel);
            await insidersExtensionService.activate(Uri.parse('r'));
            expect(handleChannel.args[0][1]).to.equal(testParams.expectedResult);
            verify(extensionChannelService.getChannel()).once();
            verify(appEnvironment.extensionChannel).once();
            expect(insidersExtensionService.activatedOnce).to.equal(true, 'Variable should be set to true');
        });
    });

    test('Ensure channels are reliably handled in the background', async () => {
        const handleChannelsDeferred = createDeferred<void>();
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => handleChannelsDeferred.promise);
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), []);
        when(extensionChannelService.getChannel()).thenResolve('InsidersDaily');
        when(appEnvironment.extensionChannel).thenReturn('insiders');

        const promise = insidersExtensionService.activate(Uri.parse('r'));
        const deferred = createDeferredFromPromise(promise);
        await sleep(1);

        // Ensure activate() function has completed while handleChannel is still running
        assert.equal(deferred.completed, true);

        handleChannelsDeferred.resolve();
        await sleep(1);

        verify(extensionChannelService.getChannel()).once();
        verify(appEnvironment.extensionChannel).once();
        expect(insidersExtensionService.activatedOnce).to.equal(true, 'Variable should be set to true');
    });
});

// tslint:disable-next-line: max-func-body-length
suite('Insiders Extension Service - Function choosePromptAndDisplay()', () => {
    let appEnvironment: IApplicationEnvironment;
    let serviceContainer: IServiceContainer;
    let extensionChannelService: IExtensionChannelService;
    let cmdManager: ICommandManager;
    let insidersPrompt: IInsiderExtensionPrompt;
    let hasUserBeenNotifiedState: TypeMoq.IMock<IPersistentState<boolean>>;
    let insidersExtensionService: InsidersExtensionService;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        hasUserBeenNotifiedState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(insidersPrompt.hasUserBeenNotified).thenReturn(hasUserBeenNotifiedState.object);
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), []);
    });

    teardown(() => {
        sinon.restore();
    });

    const testsForChoosePromptAndDisplay: {
        vscodeChannel: Channel;
        promptToDisplay: 'Reload Prompt' | 'Insiders Install Prompt' | undefined;
        didChannelChange?: boolean;
        hasUserBeenNotified?: boolean;
        installChannel?: ExtensionChannels;
    }[] =
        [
            {
                vscodeChannel: 'stable',
                didChannelChange: true,
                promptToDisplay: 'Reload Prompt'
            },
            {
                vscodeChannel: 'stable',
                didChannelChange: false,
                promptToDisplay: undefined
            },
            {
                vscodeChannel: 'insiders',
                installChannel: 'Stable',
                didChannelChange: true,
                promptToDisplay: 'Reload Prompt'
            },
            {
                vscodeChannel: 'insiders',
                installChannel: 'Stable',
                didChannelChange: false,
                promptToDisplay: undefined
            },
            {
                vscodeChannel: 'insiders',
                installChannel: 'InsidersWeekly',
                hasUserBeenNotified: false,
                promptToDisplay: 'Insiders Install Prompt'
            },
            {
                vscodeChannel: 'insiders',
                installChannel: 'InsidersWeekly',
                hasUserBeenNotified: true,
                didChannelChange: true,
                promptToDisplay: 'Reload Prompt'
            },
            {
                vscodeChannel: 'insiders',
                installChannel: 'InsidersWeekly',
                hasUserBeenNotified: true,
                didChannelChange: false,
                promptToDisplay: undefined
            }
        ];

    testsForChoosePromptAndDisplay.forEach(testParams => {
        const testName = `${testParams.promptToDisplay ? testParams.promptToDisplay : 'No prompt'} is displayed when vscode channel = '${testParams.vscodeChannel}', extension channel = '${testParams.installChannel}', ${!testParams.hasUserBeenNotified ? 'user has not been notified to install insiders' : 'user has already been notified to install insiders'}, didChannelChange = ${testParams.didChannelChange === undefined ? false : testParams.didChannelChange}`;
        test(testName, async () => {
            hasUserBeenNotifiedState
                .setup(c => c.value)
                .returns(() => testParams.hasUserBeenNotified !== undefined ? testParams.hasUserBeenNotified : true);
            when(appEnvironment.channel).thenReturn(testParams.vscodeChannel);
            when(insidersPrompt.notifyToInstallInsiders()).thenResolve();
            when(insidersPrompt.promptToReload()).thenResolve();
            await insidersExtensionService.choosePromptAndDisplay(testParams.installChannel !== undefined ? testParams.installChannel : 'Stable', testParams.didChannelChange !== undefined ? testParams.didChannelChange : false);
            if (testParams.promptToDisplay === 'Reload Prompt') {
                verify(insidersPrompt.promptToReload()).once();
                verify(insidersPrompt.notifyToInstallInsiders()).never();
            } else if (testParams.promptToDisplay === 'Insiders Install Prompt') {
                verify(insidersPrompt.promptToReload()).never();
                verify(insidersPrompt.notifyToInstallInsiders()).once();
            } else {
                verify(insidersPrompt.promptToReload()).never();
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
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        channelChangeEvent = new EventEmitter<ExtensionChannels>();
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), []);
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
        when(cmdManager.registerCommand(Commands.SwitchToStable, anything())).thenReturn(disposable2.object);
        when(cmdManager.registerCommand(Commands.SwitchToInsidersDaily, anything())).thenReturn(disposable3.object);
        when(cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, anything())).thenReturn(disposable4.object);

        insidersExtensionService.registerCommandsAndHandlers();

        expect(insidersExtensionService.disposables.length).to.equal(4);
        verify(extensionChannelService.onDidChannelChange).once();
        verify(cmdManager.registerCommand(Commands.SwitchToStable, anything())).once();
        verify(cmdManager.registerCommand(Commands.SwitchToInsidersDaily, anything())).once();
        verify(cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, anything())).once();
    });

    test('Ensure commands and handlers get registered with the correct callback handlers', async () => {
        const disposable1 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable2 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable3 = TypeMoq.Mock.ofType<IDisposable>();
        const disposable4 = TypeMoq.Mock.ofType<IDisposable>();
        let channelChangedHandler!: Function;
        let switchToStableHandler!: Function;
        let switchToInsidersDailyHandler!: Function;
        let switchToInsidersWeeklyHandler!: Function;
        when(extensionChannelService.onDidChannelChange).thenReturn(cb => { channelChangedHandler = cb; return disposable1.object; });
        when(cmdManager.registerCommand(Commands.SwitchToStable, anything())).thenCall((_, cb) => { switchToStableHandler = cb; return disposable2.object; });
        when(cmdManager.registerCommand(Commands.SwitchToInsidersDaily, anything())).thenCall((_, cb) => { switchToInsidersDailyHandler = cb; return disposable3.object; });
        when(cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, anything())).thenCall((_, cb) => { switchToInsidersWeeklyHandler = cb; return disposable4.object; });

        insidersExtensionService.registerCommandsAndHandlers();

        channelChangedHandler('Some channel');
        assert.ok(handleChannel.calledOnce);

        when(extensionChannelService.updateChannel('Stable')).thenResolve();
        await switchToStableHandler();
        verify(extensionChannelService.updateChannel('Stable')).once();

        when(extensionChannelService.updateChannel('InsidersDaily')).thenResolve();
        await switchToInsidersDailyHandler();
        verify(extensionChannelService.updateChannel('InsidersDaily')).once();

        when(extensionChannelService.updateChannel('InsidersWeekly')).thenResolve();
        await switchToInsidersWeeklyHandler();
        verify(extensionChannelService.updateChannel('InsidersWeekly')).once();
    });
});
