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
import { DebuggerBanner, injectDebuggerBanner, isUserSelected, PersistentStateKeys } from '../../client/debugger/banner';
import { DebuggerTypeName } from '../../client/debugger/Common/constants';
import { IServiceContainer } from '../../client/ioc/types';

function neverSelected(p: IPersistentState<boolean | undefined>): boolean {
    return false;
}

function alwaysSelected(p: IPersistentState<boolean | undefined>): boolean {
    return true;
}

class StubUserSelectedState implements IPersistentState<boolean | undefined> {
    public actual?: boolean | undefined;
    public get value(): boolean | undefined {
        return this.actual;
    }
    public async updateValue(value: boolean | undefined): Promise<void> {
        this.actual = value;
    }
}

suite('Debugging - Banner', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let browser: typemoq.IMock<IBrowserService>;
    let launchCounterState: typemoq.IMock<IPersistentState<number>>;
    let launchThresholdCounterState: typemoq.IMock<IPersistentState<number | undefined>>;
    let showBannerState: typemoq.IMock<IPersistentState<boolean>>;
    let debugService: typemoq.IMock<IDebugService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let disposables: typemoq.IMock<IDisposableRegistry>;
    let logger: typemoq.IMock<ILogger>;
    let banner: DebuggerBanner;
    const message = 'Can you please take 2 minutes to tell us how the Debugger is working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No thanks';

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        browser = typemoq.Mock.ofType<IBrowserService>();
        debugService = typemoq.Mock.ofType<IDebugService>();
        disposables = typemoq.Mock.ofType<IDisposableRegistry>();
        logger = typemoq.Mock.ofType<ILogger>();

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

        banner = new DebuggerBanner(serviceContainer.object, alwaysSelected);
    });
    test('users are selected 10% of the time', async () => {
        function runTest(randomSample: number, expected: boolean) {
            //console.log(`attempt for ${randomSample}`);
            const state = new StubUserSelectedState();
            function randInt(min: number, max: number): number {
                expect(min).to.be.equal(0, 'Incorrect value');
                expect(max).to.be.equal(100, 'Incorrect value');
                return randomSample;
            }

            const selected = isUserSelected(state, randInt);

            expect(selected).to.be.equal(expected, 'Incorrect value');
            expect(state.actual).to.be.equal(expected, 'Incorrect value');
        }

        for (let i = 0; i < 10; i = i + 1) {
            runTest(i, true);
        }
        for (let i = 10; i < 100; i = i + 1) {
            runTest(i, false);
        }
    });
    test('user selection does not change', async () => {
        function runTest(randomSample: number, expected: boolean) {
            //console.log(`attempt for ${randomSample}`);
            const state = new StubUserSelectedState();
            function randInt(min: number, max: number): number {
                return randomSample;
            }

            const result1 = isUserSelected(state, randInt);
            const set = state.actual;
            const result2 = isUserSelected(state, randInt);

            expect(result1).to.be.equal(expected, 'Incorrect value');
            expect(result2).to.be.equal(expected, 'Incorrect value');
            expect(set).to.be.equal(expected, 'Incorrect value');
        }

        runTest(0, true);
        runTest(10, false);
    });
    test('Browser is displayed when launching service along with debugger launch counter', async () => {
        const debuggerLaunchCounter = 1234;
        launchCounterState.setup(l => l.value).returns(() => debuggerLaunchCounter).verifiable(typemoq.Times.once());
        browser.setup(b => b.launch(typemoq.It.isValue(`https://www.research.net/r/N7B25RV?n=${debuggerLaunchCounter}`)))
            .verifiable(typemoq.Times.once());
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no)))
            .returns(() => Promise.resolve(yes));

        await banner.showBanner();

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

        injectDebuggerBanner(banner, debugService.object, disposables.object, logger.object);
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

        injectDebuggerBanner(banner, debugService.object, disposables.object, logger.object);

        launchCounterState.verifyAll();
        browser.verifyAll();
        debugService.verifyAll();
        showBannerState.verifyAll();
    });
    test('shouldShowBanner must return false when Banner is disabled', async () => {
        showBannerState.setup(s => s.value).returns(() => false)
            .verifiable(typemoq.Times.atLeastOnce());

        expect(await banner.shouldShowBanner()).to.be.equal(false, 'Incorrect value');

        showBannerState.verifyAll();
    });
    test('shouldShowBanner must return false when Banner is enabled and debug counter is not same as threshold', async () => {
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.value).returns(() => 1)
            .verifiable(typemoq.Times.once());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());

        expect(await banner.shouldShowBanner()).to.be.equal(false, 'Incorrect value');

        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
    });
    test('shouldShowBanner returns false if user not selected (90%)', async () => {
        let enabled = true;
        showBannerState.setup(s => s.value).returns(() => enabled);
        showBannerState.setup(s => s.updateValue(typemoq.It.isAny())).returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        launchCounterState.setup(l => l.value).returns(() => 10);
        launchThresholdCounterState.setup(t => t.value).returns(() => 10);
        const banner2 = new DebuggerBanner(serviceContainer.object, neverSelected);

        // The banner got disabled.
        showBannerState.verifyAll();
        enabled = false;

        const result = await banner2.shouldShowBanner();
        expect(result).to.be.equal(false, 'Incorrect value');
    });
    test('shouldShowBanner returns true if user selected (10%)', async () => {
        const enabled = true;
        showBannerState.setup(s => s.value).returns(() => enabled);
        showBannerState.setup(s => s.updateValue(typemoq.It.isAny())).returns(() => Promise.resolve())
            .verifiable(typemoq.Times.never());
        launchCounterState.setup(l => l.value).returns(() => 10);
        launchThresholdCounterState.setup(t => t.value).returns(() => 10);
        const banner2 = new DebuggerBanner(serviceContainer.object, alwaysSelected);

        // The banner was not disabled.
        showBannerState.verifyAll();

        const result = await banner2.shouldShowBanner();
        expect(result).to.be.equal(true, 'Incorrect value');
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
        injectDebuggerBanner(banner, debugService.object, disposables.object, logger.object);
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
        injectDebuggerBanner(banner, debugService.object, disposables.object, logger.object);
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
            .verifiable(typemoq.Times.atLeastOnce());

        await banner.disable();

        showBannerState.verifyAll();
    });
});
