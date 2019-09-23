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
        registerCommandsAndHandlers = sinon.stub(InsidersExtensionService.prototype, 'registerCommandsAndHandlers');
        registerCommandsAndHandlers.callsFake(() => Promise.resolve());
    });

    teardown(() => {
        sinon.restore();
    });

    test('If install channel is handled in the edge cases, do not handle it again using the general way', async () => {
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        handleEdgeCases.callsFake(() => Promise.resolve(true));
        insidersExtensionService = new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), instance(insidersInstaller), []);
        when(extensionChannelService.getChannel()).thenReturn('daily');

        await insidersExtensionService.activate();

        verify(extensionChannelService.getChannel()).once();
        assert.ok(registerCommandsAndHandlers.calledOnce);
        assert.ok(handleEdgeCases.calledOnce);
        assert.ok(handleChannel.notCalled);
    });

    test('If install channel is not handled in the edge cases, handle it using the general way', async () => {
        handleChannel = sinon.stub(InsidersExtensionService.prototype, 'handleChannel');
        handleChannel.callsFake(() => Promise.resolve());
        handleEdgeCases.callsFake(() => Promise.resolve(false));
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
        handleEdgeCases.callsFake(() => Promise.resolve(false));
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
    function setupMock() {
        extensionChannelService = mock(ExtensionChannelService);
        insidersInstaller = mock(InsidersBuildInstaller);
        appEnvironment = mock(ApplicationEnvironment);
        cmdManager = mock(CommandManager);
        serviceContainer = mock(ServiceContainer);
        insidersPrompt = mock(InsidersExtensionPrompt);
        hasUserBeenNotifiedState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(insidersPrompt.hasUserBeenNotified).thenReturn(hasUserBeenNotifiedState.object);
        return new InsidersExtensionService(instance(extensionChannelService), instance(insidersPrompt), instance(appEnvironment), instance(cmdManager), instance(serviceContainer), instance(insidersInstaller), []);
    }

    suite('Case I - Verify enroll into the program again prompt is displayed when conditions are met', async () => {
        const testsForHandleEdgeCaseI: {
            vscodeChannel: Channel;
            installChannel: ExtensionChannels;
            isChannelUsingDefaultConfiguration: boolean;
        }[] =
            [
                {
                    vscodeChannel: 'stable',
                    installChannel: 'off',
                    isChannelUsingDefaultConfiguration: false
                },
                {
                    vscodeChannel: 'insiders',
                    isChannelUsingDefaultConfiguration: false,
                    installChannel: 'off'
                },
                {
                    vscodeChannel: 'insiders',
                    installChannel: 'off',
                    isChannelUsingDefaultConfiguration: false
                }
            ];

        setup(() => {
            insidersExtensionService = setupMock();
        });

        testsForHandleEdgeCaseI.forEach(testParams => {
            const testName = `Enroll into the program again prompt is displayed when vscode channel = '${testParams.vscodeChannel}', install channel = '${testParams.installChannel}', isChannelUsingDefaultConfiguration = ${testParams.isChannelUsingDefaultConfiguration}`;
            test(testName, async () => {
                when(appEnvironment.channel).thenReturn(testParams.vscodeChannel);
                when(insidersPrompt.promptToInstallInsiders()).thenResolve();
                when(extensionChannelService.updateChannel('off')).thenResolve();
                when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(testParams.isChannelUsingDefaultConfiguration !== undefined ? testParams.isChannelUsingDefaultConfiguration : true);
                await insidersExtensionService.handleEdgeCases(testParams.installChannel !== undefined ? testParams.installChannel : 'off');

                verify(insidersPrompt.promptToEnrollBackToInsiders()).once();
                verify(extensionChannelService.updateChannel('off')).never();
                verify(insidersPrompt.promptToInstallInsiders()).never();
            });
        });
    });

    suite('Case II - Verify Insiders Install Prompt is displayed when conditions are met', async () => {
        const testsForHandleEdgeCaseII: {
            vscodeChannel: Channel;
            hasUserBeenNotified: boolean;
            installChannel?: ExtensionChannels;
            isChannelUsingDefaultConfiguration: boolean;
            extensionChannel?: Channel;
        }[] =
            [
                {
                    // TEST: Ensure when conditions for both 'Set channel to off' & 'Insiders Install Prompt' operations are met, 'Insiders Install prompt' is given preference
                    vscodeChannel: 'insiders',
                    hasUserBeenNotified: false,
                    isChannelUsingDefaultConfiguration: true,
                    installChannel: 'daily',
                    extensionChannel: 'stable'
                },
                {
                    vscodeChannel: 'insiders',
                    hasUserBeenNotified: false,
                    isChannelUsingDefaultConfiguration: true
                }
            ];

        setup(() => {
            insidersExtensionService = setupMock();
        });

        testsForHandleEdgeCaseII.forEach(testParams => {
            const testName = `Insiders Install Prompt is displayed when vscode channel = '${testParams.vscodeChannel}', extension channel = '${testParams.extensionChannel}', install channel = '${testParams.installChannel}', ${!testParams.hasUserBeenNotified ? 'user has not been notified to install insiders' : 'user has already been notified to install insiders'}, isChannelUsingDefaultConfiguration = ${testParams.isChannelUsingDefaultConfiguration}`;
            test(testName, async () => {
                hasUserBeenNotifiedState
                    .setup(c => c.value)
                    .returns(() => testParams.hasUserBeenNotified !== undefined ? testParams.hasUserBeenNotified : true);
                when(appEnvironment.channel).thenReturn(testParams.vscodeChannel);
                when(appEnvironment.extensionChannel).thenReturn(testParams.extensionChannel ? testParams.extensionChannel : 'stable');
                when(insidersPrompt.promptToInstallInsiders()).thenResolve();
                when(extensionChannelService.updateChannel('off')).thenResolve();
                when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(testParams.isChannelUsingDefaultConfiguration !== undefined ? testParams.isChannelUsingDefaultConfiguration : true);
                await insidersExtensionService.handleEdgeCases(testParams.installChannel !== undefined ? testParams.installChannel : 'off');
                verify(insidersPrompt.promptToEnrollBackToInsiders()).never();
                verify(extensionChannelService.updateChannel('off')).never();
                verify(insidersPrompt.promptToInstallInsiders()).once();
            });
        });
    });

    suite('Case III - Verify Insiders channel is set to off when conditions are met', async () => {
        const testsForHandleEdgeCaseIII: {
            vscodeChannel: Channel;
            hasUserBeenNotified?: boolean;
            installChannel: ExtensionChannels;
            isChannelUsingDefaultConfiguration?: boolean;
            extensionChannel: Channel;
        }[] =
            [
                {
                    vscodeChannel: 'stable',
                    installChannel: 'daily',
                    extensionChannel: 'stable'
                },
                {
                    vscodeChannel: 'stable',
                    installChannel: 'weekly',
                    extensionChannel: 'stable'
                }
            ];

        setup(() => {
            insidersExtensionService = setupMock();
        });

        testsForHandleEdgeCaseIII.forEach(testParams => {
            const testName = `Insiders channel is set to off when vscode channel = '${testParams.vscodeChannel}', extension channel = '${testParams.extensionChannel}', install channel = '${testParams.installChannel}', ${!testParams.hasUserBeenNotified ? 'user has not been notified to install insiders' : 'user has already been notified to install insiders'}, isChannelUsingDefaultConfiguration = ${testParams.isChannelUsingDefaultConfiguration}`;
            test(testName, async () => {
                hasUserBeenNotifiedState
                    .setup(c => c.value)
                    .returns(() => testParams.hasUserBeenNotified !== undefined ? testParams.hasUserBeenNotified : true);
                when(appEnvironment.channel).thenReturn(testParams.vscodeChannel);
                when(appEnvironment.extensionChannel).thenReturn(testParams.extensionChannel ? testParams.extensionChannel : 'stable');
                when(insidersPrompt.promptToInstallInsiders()).thenResolve();
                when(extensionChannelService.updateChannel('off')).thenResolve();
                when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(testParams.isChannelUsingDefaultConfiguration !== undefined ? testParams.isChannelUsingDefaultConfiguration : true);
                await insidersExtensionService.handleEdgeCases(testParams.installChannel !== undefined ? testParams.installChannel : 'off');
                verify(insidersPrompt.promptToEnrollBackToInsiders()).never();
                verify(extensionChannelService.updateChannel('off')).once();
                verify(insidersPrompt.promptToInstallInsiders()).never();
            });
        });
    });

    suite('Case IV - Verify no operation is performed if none of the case conditions are met', async () => {
        const testsForHandleEdgeCaseIV: {
            vscodeChannel: Channel;
            hasUserBeenNotified?: boolean;
            installChannel: ExtensionChannels;
            isChannelUsingDefaultConfiguration?: boolean;
            extensionChannel?: Channel;
        }[] =
            [
                {
                    vscodeChannel: 'insiders',
                    hasUserBeenNotified: false,
                    isChannelUsingDefaultConfiguration: false,
                    installChannel: 'daily',
                    extensionChannel: 'insiders'
                },
                {
                    vscodeChannel: 'stable',
                    isChannelUsingDefaultConfiguration: true,
                    installChannel: 'off',
                    extensionChannel: 'insiders'
                },
                {
                    vscodeChannel: 'stable',
                    installChannel: 'daily',
                    extensionChannel: 'insiders'
                },
                {
                    vscodeChannel: 'stable',
                    installChannel: 'off'
                },
                {
                    vscodeChannel: 'insiders',
                    hasUserBeenNotified: true,
                    installChannel: 'off'
                }
            ];

        setup(() => {
            insidersExtensionService = setupMock();
        });

        testsForHandleEdgeCaseIV.forEach(testParams => {
            const testName = `No operation is performed when vscode channel = '${testParams.vscodeChannel}', extension channel = '${testParams.extensionChannel}', install channel = '${testParams.installChannel}', ${!testParams.hasUserBeenNotified ? 'user has not been notified to install insiders' : 'user has already been notified to install insiders'}, isChannelUsingDefaultConfiguration = ${testParams.isChannelUsingDefaultConfiguration}`;
            test(testName, async () => {
                hasUserBeenNotifiedState
                    .setup(c => c.value)
                    .returns(() => testParams.hasUserBeenNotified !== undefined ? testParams.hasUserBeenNotified : true);
                when(appEnvironment.channel).thenReturn(testParams.vscodeChannel);
                when(appEnvironment.extensionChannel).thenReturn(testParams.extensionChannel ? testParams.extensionChannel : 'stable');
                when(insidersPrompt.promptToInstallInsiders()).thenResolve();
                when(extensionChannelService.updateChannel('off')).thenResolve();
                when(extensionChannelService.isChannelUsingDefaultConfiguration).thenReturn(testParams.isChannelUsingDefaultConfiguration !== undefined ? testParams.isChannelUsingDefaultConfiguration : true);
                await insidersExtensionService.handleEdgeCases(testParams.installChannel !== undefined ? testParams.installChannel : 'off');
                verify(extensionChannelService.updateChannel('off')).never();
                verify(insidersPrompt.promptToInstallInsiders()).never();
                verify(insidersPrompt.promptToEnrollBackToInsiders()).never();
            });
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
