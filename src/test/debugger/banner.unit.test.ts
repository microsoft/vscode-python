// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { DebugSession } from 'vscode';
import { IApplicationShell, IDebugService } from '../../client/common/application/types';
import { IBrowserService, IDisposableRegistry,
    ILogger, IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { ExperimentalDebuggerBanner, PersistentStateKeys } from '../../client/debugger/banner';
import { DebuggerTypeName } from '../../client/debugger/Common/constants';
import { IExperimentalDebuggerBanner } from '../../client/debugger/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Debugging - Banner', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let browser: typemoq.IMock<IBrowserService>;
    let launchCounterState: typemoq.IMock<IPersistentState<number>>;
    let launchThresholdCounterState: typemoq.IMock<IPersistentState<number | undefined>>;
    let showBannerState: typemoq.IMock<IPersistentState<boolean>>;
    let debugService: typemoq.IMock<IDebugService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let banner: IExperimentalDebuggerBanner;
    const message = 'Can you please take 2 minutes to tell us how the Debugger is working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No thanks';

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        browser = typemoq.Mock.ofType<IBrowserService>();
        debugService = typemoq.Mock.ofType<IDebugService>();
        const logger = typemoq.Mock.ofType<ILogger>();

        launchCounterState = typemoq.Mock.ofType<IPersistentState<number>>();
        showBannerState = typemoq.Mock.ofType<IPersistentState<boolean>>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        launchThresholdCounterState = typemoq.Mock.ofType<IPersistentState<number | undefined>>();
        const factory = typemoq.Mock.ofType<IPersistentStateFactory>();
        factory
            .setup(f => f.createGlobalPersistentState(typemoq.It.isValue(PersistentStateKeys.DebuggerLaunchCounter), typemoq.It.isAny()))
            .returns(() => launchCounterState.object);
        factory
            .setup(f => f.createGlobalPersistentState(typemoq.It.isValue(PersistentStateKeys.ShowBanner), typemoq.It.isAny()))
            .returns(() => showBannerState.object);
        factory
            .setup(f => f.createGlobalPersistentState(typemoq.It.isValue(PersistentStateKeys.DebuggerLaunchThresholdCounter), typemoq.It.isAny()))
            .returns(() => launchThresholdCounterState.object);

        serviceContainer.setup(s => s.get(typemoq.It.isValue(IBrowserService))).returns(() => browser.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IPersistentStateFactory))).returns(() => factory.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDebugService))).returns(() => debugService.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(ILogger))).returns(() => logger.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDisposableRegistry))).returns(() => []);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IApplicationShell))).returns(() => appShell.object);

        banner = new ExperimentalDebuggerBanner(serviceContainer.object);
    });
    test('Browser is displayed when launching service along with debugger launch counter', async () => {
        const debuggerLaunchCounter = 1234;
        launchCounterState.setup(l => l.value).returns(() => debuggerLaunchCounter).verifiable(typemoq.Times.once());
        browser.setup(b => b.launch(typemoq.It.isValue(`https://www.research.net/r/N7B25RV?n=${debuggerLaunchCounter}`)))
            .verifiable(typemoq.Times.once());

        await banner.launchSurvey();

        launchCounterState.verifyAll();
        browser.verifyAll();
    });
    test('Increment Debugger Launch Counter when debug session starts', async () => {
        let onDidTerminateDebugSessionCb: (e: DebugSession) => Promise<void>;
        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .callback(cb => onDidTerminateDebugSessionCb = cb)
            .verifiable(typemoq.Times.once());

        const debuggerLaunchCounter = 1234;
        launchCounterState.setup(l => l.value).returns(() => debuggerLaunchCounter)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isValue(debuggerLaunchCounter + 1)))
            .verifiable(typemoq.Times.once());
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());

        banner.initialize();
        await onDidTerminateDebugSessionCb!({ type: DebuggerTypeName } as any);

        launchCounterState.verifyAll();
        browser.verifyAll();
        debugService.verifyAll();
        showBannerState.verifyAll();
    });
    test('Do not Increment Debugger Launch Counter when debug session starts and Banner is disabled', async () => {
        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .verifiable(typemoq.Times.never());

        const debuggerLaunchCounter = 1234;
        launchCounterState.setup(l => l.value).returns(() => debuggerLaunchCounter)
            .verifiable(typemoq.Times.never());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isValue(debuggerLaunchCounter + 1)))
            .verifiable(typemoq.Times.never());
        showBannerState.setup(s => s.value).returns(() => false)
            .verifiable(typemoq.Times.atLeastOnce());

        banner.initialize();

        launchCounterState.verifyAll();
        browser.verifyAll();
        debugService.verifyAll();
        showBannerState.verifyAll();
    });
    test('shouldShowBanner must return false when Banner is disabled', async () => {
        showBannerState.setup(s => s.value).returns(() => false)
            .verifiable(typemoq.Times.once());

        expect(await banner.shouldShowBanner()).to.be.equal(false, 'Incorrect value');

        showBannerState.verifyAll();
    });
    test('shouldShowBanner must return false when Banner is enabled and debug counter is not same as threshold', async () => {
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.once());
        launchCounterState.setup(l => l.value).returns(() => 1)
            .verifiable(typemoq.Times.once());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());

        expect(await banner.shouldShowBanner()).to.be.equal(false, 'Incorrect value');

        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
    });
    test('shouldShowBanner must return true when Banner is enabled and debug counter is same as threshold', async () => {
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.once());
        launchCounterState.setup(l => l.value).returns(() => 10)
            .verifiable(typemoq.Times.once());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());

        expect(await banner.shouldShowBanner()).to.be.equal(true, 'Incorrect value');

        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
    });
    test('showBanner must be invoked when shouldShowBanner returns true', async () => {
        let onDidTerminateDebugSessionCb: (e: DebugSession) => Promise<void>;
        const currentLaunchCounter = 50;

        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .callback(cb => onDidTerminateDebugSessionCb = cb)
            .verifiable(typemoq.Times.atLeastOnce());
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.value).returns(() => currentLaunchCounter)
            .verifiable(typemoq.Times.atLeastOnce());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isValue(currentLaunchCounter + 1)))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.atLeastOnce());

        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no)))
            .verifiable(typemoq.Times.once());
        banner.initialize();
        await onDidTerminateDebugSessionCb!({ type: DebuggerTypeName } as any);

        appShell.verifyAll();
        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
    });
    test('showBanner must not be invoked the second time after dismissing the message', async () => {
        let onDidTerminateDebugSessionCb: (e: DebugSession) => Promise<void>;
        let currentLaunchCounter = 50;

        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .callback(cb => onDidTerminateDebugSessionCb = cb)
            .verifiable(typemoq.Times.atLeastOnce());
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.value).returns(() => currentLaunchCounter)
            .verifiable(typemoq.Times.atLeastOnce());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isAny()))
            .callback(() => currentLaunchCounter = currentLaunchCounter + 1);

        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no)))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());
        banner.initialize();
        await onDidTerminateDebugSessionCb!({ type: DebuggerTypeName } as any);
        await onDidTerminateDebugSessionCb!({ type: DebuggerTypeName } as any);
        await onDidTerminateDebugSessionCb!({ type: DebuggerTypeName } as any);
        await onDidTerminateDebugSessionCb!({ type: DebuggerTypeName } as any);

        appShell.verifyAll();
        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
        expect(currentLaunchCounter).to.be.equal(54);
    });
    test('Disabling banner must store value of \'false\' in global store', async () => {
        showBannerState.setup(s => s.updateValue(typemoq.It.isValue(false)))
            .verifiable(typemoq.Times.once());

        await banner.disable();

        showBannerState.verifyAll();
    });
});
