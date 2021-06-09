// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { EventEmitter, UIKind } from 'vscode';
import { ApplicationEnvironment } from '../../../client/common/application/applicationEnvironment';
import { CommandManager } from '../../../client/common/application/commandManager';
import { IApplicationEnvironment, ICommandManager } from '../../../client/common/application/types';
import { Channel, Commands } from '../../../client/common/constants';
import { ExtensionChannelService } from '../../../client/common/insidersBuild/downloadChannelService';
import { InsidersExtensionPrompt } from '../../../client/common/insidersBuild/insidersExtensionPrompt';
import { InsidersExtensionService } from '../../../client/common/insidersBuild/insidersExtensionService';
import {
    ExtensionChannels,
    IExtensionChannelRule,
    IExtensionChannelService,
    IInsiderExtensionPrompt,
} from '../../../client/common/insidersBuild/types';
import { InsidersBuildInstaller } from '../../../client/common/installer/extensionBuildInstaller';
import { IExtensionBuildInstaller } from '../../../client/common/installer/types';
import { PersistentState } from '../../../client/common/persistentState';
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
        insidersExtensionService = new InsidersExtensionService(
            instance(extensionChannelService),
            instance(insidersPrompt),
            instance(appEnvironment),
            instance(cmdManager),
            instance(serviceContainer),
            instance(insidersInstaller),
            [],
        );
    });

    teardown(() => {
        sinon.restore();
    });

    test('If insiders is not be installed, handling channel does not do anything and simply returns', async () => {
        const channelRule = TypeMoq.Mock.ofType<IExtensionChannelRule>();
        when(serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, 'off')).thenReturn(channelRule.object);
        channelRule
            .setup((c) => c.shouldLookForInsidersBuild(false))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        when(insidersInstaller.install()).thenResolve(undefined);
        await insidersExtensionService.handleChannel('off');
        verify(insidersInstaller.install()).never();
        channelRule.verifyAll();
    });

    test('If insiders is required to be installed, handling channel installs the build and prompts user', async () => {
        const channelRule = TypeMoq.Mock.ofType<IExtensionChannelRule>();
        when(serviceContainer.get<IExtensionChannelRule>(IExtensionChannelRule, 'weekly')).thenReturn(
            channelRule.object,
        );
        channelRule
            .setup((c) => c.shouldLookForInsidersBuild(false))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        when(insidersInstaller.install()).thenResolve(undefined);
        when(insidersPrompt.promptToReload()).thenResolve(undefined);
        await insidersExtensionService.handleChannel('weekly');
        verify(insidersInstaller.install()).once();
        verify(insidersPrompt.promptToReload()).once();
        channelRule.verifyAll();
    });
});

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
    let envUITEST_DISABLE_INSIDERSExists = false;
    setup(() => {
        envUITEST_DISABLE_INSIDERSExists = process.env.UITEST_DISABLE_INSIDERS !== undefined;
        delete process.env.UITEST_DISABLE_INSIDERS;
        extensionChannelService = mock(ExtensionChannelService);
        insidersInstaller = mock(InsidersBuildInstaller);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        handleEdgeCases = sinon.stub(InsidersExtensionService.prototype, 'handleEdgeCases');
        registerCommandsAndHandlers = sinon.stub(InsidersExtensionService.prototype, 'registerCommandsAndHandlers');
        registerCommandsAndHandlers.callsFake(() => Promise.resolve());
    });

    teardown(() => {
        if (envUITEST_DISABLE_INSIDERSExists) {
            process.env.UITEST_DISABLE_INSIDERS = '1';
        }
        sinon.restore();
    });

    test('If install channel is handled in the edge cases, do not handle it again using the general way', async () => {
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        handleEdgeCases.callsFake(() => Promise.resolve(true));
        insidersExtensionService = new InsidersExtensionService(
            instance(extensionChannelService),
            instance(insidersPrompt),
            instance(appEnvironment),
            instance(cmdManager),
            instance(serviceContainer),
            instance(insidersInstaller),
            [],
        );
        when(extensionChannelService.getChannel()).thenReturn('daily');
        when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(false);

        await insidersExtensionService.activate();

        verify(extensionChannelService.getChannel()).once();
        verify(extensionChannelService.isChannelUsingDefaultConfiguration).once();
        assert.ok(registerCommandsAndHandlers.calledOnce);
        assert.ok(handleEdgeCases.calledOnce);
        assert.ok(handleEdgeCases.calledWith(false));
        assert.ok(handleChannel.notCalled);
    });

    test('If install channel is not handled in the edge cases, handle it using the general way', async () => {
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        handleEdgeCases.callsFake(() => Promise.resolve(false));
        insidersExtensionService = new InsidersExtensionService(
            instance(extensionChannelService),
            instance(insidersPrompt),
            instance(appEnvironment),
            instance(cmdManager),
            instance(serviceContainer),
            instance(insidersInstaller),
            [],
        );
        when(extensionChannelService.getChannel()).thenReturn('daily');
        when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(false);

        await insidersExtensionService.activate();

        verify(extensionChannelService.getChannel()).once();
        verify(extensionChannelService.isChannelUsingDefaultConfiguration).once();
        assert.ok(registerCommandsAndHandlers.calledOnce);
        assert.ok(handleEdgeCases.calledOnce);
        assert.ok(handleEdgeCases.calledWith(false));
        assert.ok(handleChannel.calledOnce);
    });

    test('Ensure channels are reliably handled in the background', async () => {
        const handleChannelsDeferred = createDeferred<void>();
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => handleChannelsDeferred.promise);
        handleEdgeCases.callsFake(() => Promise.resolve(false));
        insidersExtensionService = new InsidersExtensionService(
            instance(extensionChannelService),
            instance(insidersPrompt),
            instance(appEnvironment),
            instance(cmdManager),
            instance(serviceContainer),
            instance(insidersInstaller),
            [],
        );
        when(extensionChannelService.getChannel()).thenReturn('daily');
        when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(false);

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
        assert.ok(handleEdgeCases.calledWith(false));
    });
});

suite('Insiders Extension Service - Function handleEdgeCases()', () => {
    let appEnvironment: TypeMoq.IMock<IApplicationEnvironment>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let extensionChannelService: TypeMoq.IMock<IExtensionChannelService>;
    let cmdManager: TypeMoq.IMock<ICommandManager>;
    let insidersPrompt: TypeMoq.IMock<IInsiderExtensionPrompt>;
    let hasUserBeenNotifiedState: IPersistentState<boolean>;
    let insidersInstaller: TypeMoq.IMock<IExtensionBuildInstaller>;

    let insidersExtensionService: InsidersExtensionService;

    function setupCommon() {
        extensionChannelService = TypeMoq.Mock.ofType<IExtensionChannelService>(undefined, TypeMoq.MockBehavior.Strict);
        insidersInstaller = TypeMoq.Mock.ofType<IExtensionBuildInstaller>(undefined, TypeMoq.MockBehavior.Strict);
        appEnvironment = TypeMoq.Mock.ofType<IApplicationEnvironment>(undefined, TypeMoq.MockBehavior.Strict);
        cmdManager = TypeMoq.Mock.ofType<ICommandManager>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        insidersPrompt = TypeMoq.Mock.ofType<IInsiderExtensionPrompt>(undefined, TypeMoq.MockBehavior.Strict);
        hasUserBeenNotifiedState = mock(PersistentState) as IPersistentState<boolean>;

        insidersExtensionService = new InsidersExtensionService(
            extensionChannelService.object,
            insidersPrompt.object,
            appEnvironment.object,
            cmdManager.object,
            serviceContainer.object,
            insidersInstaller.object,
            [],
        );

        insidersPrompt
            .setup((p) => p.hasUserBeenNotified)
            .returns(() => instance(hasUserBeenNotifiedState))
            // Basically means "we don't care" (necessary for strict mocks).
            .verifiable(TypeMoq.Times.atLeast(0));
        hasUserBeenNotifiedState = mock(PersistentState) as PersistentState<boolean>;
    }

    setup(() => {
        setupCommon();
    });

    function verifyAll() {
        // the most important ones:
        insidersPrompt.verifyAll();
        insidersInstaller.verifyAll();
        extensionChannelService.verifyAll();
        // the other used interfaces:
        appEnvironment.verifyAll();
        serviceContainer.verifyAll();
        cmdManager.verifyAll();
    }

    type TestInfo = {
        vscodeChannel?: Channel;
        installChannel?: ExtensionChannels;
        isChannelUsingDefaultConfiguration?: boolean;
        hasUserBeenNotified?: boolean;
        uiKind?: UIKind;
    };

    function setState(info: TestInfo, checkPromptEnroll: boolean) {
        if (info.vscodeChannel) {
            appEnvironment.setup((e) => e.channel).returns(() => info.vscodeChannel!);
        }

        appEnvironment
            .setup((e) => e.uiKind)
            .returns(() => info.uiKind ?? UIKind.Desktop)
            // Basically means "we don't care" (necessary for strict mocks).
            .verifiable(TypeMoq.Times.atLeast(0));

        if (info.hasUserBeenNotified !== undefined) {
            when(hasUserBeenNotifiedState.value).thenReturn(info.hasUserBeenNotified!);
        }
        if (checkPromptEnroll) {
            insidersPrompt.setup((p) => p.promptToInstallInsiders()).returns(() => Promise.resolve());
        }
    }

    test(`Insiders Install Prompt is displayed when vscode channel = 'insiders', user has not been notified to install insiders, isChannelUsingDefaultConfiguration = true`, async () => {
        setState(
            {
                // prompt to enroll
                vscodeChannel: 'insiders',
                hasUserBeenNotified: false,
                isChannelUsingDefaultConfiguration: true,
            },
            true,
        );

        await insidersExtensionService.handleEdgeCases(true);

        verifyAll();
        verify(hasUserBeenNotifiedState.value).once();
    });

    test(`Insiders Install Prompt is not displayed when uiKind = 'UIKind.Web'`, async () => {
        setState(
            {
                // prompt to enroll
                vscodeChannel: 'insiders',
                hasUserBeenNotified: false,
                isChannelUsingDefaultConfiguration: true,
                uiKind: UIKind.Web,
            },
            false,
        );

        await insidersExtensionService.handleEdgeCases(true);

        verifyAll();
    });

    suite('Verify no operation is performed if none of the case conditions are met', async () => {
        const testsForHandleEdgeCases: TestInfo[] = [
            {
                installChannel: 'daily',
                // skip enroll
                vscodeChannel: 'insiders',
                hasUserBeenNotified: true,
            },
            {
                installChannel: 'daily',
                // skip enroll
                vscodeChannel: 'insiders',
                hasUserBeenNotified: false,
                isChannelUsingDefaultConfiguration: false,
            },
            {
                installChannel: 'daily',
                // skip enroll
                vscodeChannel: 'stable',
            },
            {
                installChannel: 'off',
                // skip enroll
                vscodeChannel: 'insiders',
                hasUserBeenNotified: true,
            },
            {
                installChannel: 'off',
                isChannelUsingDefaultConfiguration: true,
                // skip enroll
                vscodeChannel: 'insiders',
                hasUserBeenNotified: true,
            },
            {
                // skip re-enroll
                installChannel: 'off',
                isChannelUsingDefaultConfiguration: true,
                // skip enroll
                vscodeChannel: 'stable',
            },
        ];

        setup(() => {
            setupCommon();
        });

        testsForHandleEdgeCases.forEach((testParams) => {
            const testName = `No operation is performed when vscode channel = '${
                testParams.vscodeChannel
            }', install channel = '${testParams.installChannel}', ${
                !testParams.hasUserBeenNotified
                    ? 'user has not been notified to install insiders'
                    : 'user has already been notified to install insiders'
            }, isChannelUsingDefaultConfiguration = ${testParams.isChannelUsingDefaultConfiguration}`;
            test(testName, async () => {
                setState(testParams, false);

                await insidersExtensionService.handleEdgeCases(
                    testParams.isChannelUsingDefaultConfiguration || testParams.installChannel === 'off',
                );

                verifyAll();
                if (testParams.hasUserBeenNotified === undefined) {
                    verify(hasUserBeenNotifiedState.value).never();
                } else {
                    verify(hasUserBeenNotifiedState.value).once();
                }
            });
        });
    });
});

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
        insidersExtensionService = new InsidersExtensionService(
            instance(extensionChannelService),
            instance(insidersPrompt),
            instance(appEnvironment),
            instance(cmdManager),
            instance(serviceContainer),
            instance(insidersInstaller),
            [],
        );
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
        when(extensionChannelService.onDidChannelChange).thenReturn((cb) => {
            channelChangedHandler = cb;
            return disposable1.object;
        });
        when(cmdManager.registerCommand(Commands.SwitchOffInsidersChannel, anything())).thenCall((_, cb) => {
            switchTooffHandler = cb;
            return disposable2.object;
        });
        when(cmdManager.registerCommand(Commands.SwitchToInsidersDaily, anything())).thenCall((_, cb) => {
            switchToInsidersDailyHandler = cb;
            return disposable3.object;
        });
        when(cmdManager.registerCommand(Commands.SwitchToInsidersWeekly, anything())).thenCall((_, cb) => {
            switchToweeklyHandler = cb;
            return disposable4.object;
        });

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
