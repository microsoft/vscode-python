// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { assert, expect } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ExtensionInsidersDailyChannelRule, ExtensionInsidersWeeklyChannelRule, ExtensionStableChannelRule, frequencyForDailyInsidersCheck, frequencyForWeeklyInsidersCheck, lastLookUpTimeKey } from '../../../client/common/insidersBuild/downloadChannelRules';
import { InsidersBuildInstaller, StableBuildInstaller } from '../../../client/common/installer/extensionBuildInstaller';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentState, IPersistentStateFactory } from '../../../client/common/types';

suite('Download channel rules - ExtensionStableChannelRule', () => {
    let stableInstaller: StableBuildInstaller;
    let stableChannelRule: ExtensionStableChannelRule;
    setup(() => {
        stableInstaller = new StableBuildInstaller(undefined as any, undefined as any);
        stableChannelRule = new ExtensionStableChannelRule(stableInstaller);
    });

    test('If insiders channel rule is new, return installer for stable build', async () => {
        const result = await stableChannelRule.getInstaller(true);
        assert.instanceOf(result, StableBuildInstaller, 'Not looking for the correct build');
    });
    test('If insiders channel rule is not new, do not return any installer', async () => {
        const result = await stableChannelRule.getInstaller();
        expect(result).to.equal(undefined, 'Should not look for any installer');
    });
});

suite('Download channel rules - ExtensionInsidersDailyChannelRule', () => {
    let insidersInstaller: InsidersBuildInstaller;
    let persistentStateFactory: IPersistentStateFactory;
    let lastLookUpTime: TypeMoq.IMock<IPersistentState<number>>;
    let insidersDailyChannelRule: ExtensionInsidersDailyChannelRule;
    setup(() => {
        // tslint:disable-next-line:no-any
        insidersInstaller = new InsidersBuildInstaller(undefined as any, undefined as any, undefined as any, undefined as any);
        persistentStateFactory = mock(PersistentStateFactory);
        lastLookUpTime = TypeMoq.Mock.ofType<IPersistentState<number>>();
        when(persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1)).thenReturn(lastLookUpTime.object);
        insidersDailyChannelRule = new ExtensionInsidersDailyChannelRule(insidersInstaller, instance(persistentStateFactory));
    });

    test('If insiders channel rule is new, update look up time and return installer for insiders build', async () => {
        lastLookUpTime
            .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        const result = await insidersDailyChannelRule.getInstaller(true);
        lastLookUpTime.verifyAll();
        assert.instanceOf(result, InsidersBuildInstaller, 'Not looking for the correct build');
    });
    suite('If insiders channel rule is not new', async () => {
        test('Update look up time and return installer for insiders build if looking for insiders the first time', async () => {
            lastLookUpTime
                .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup(l => l.value)
                .returns(() => -1)
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.getInstaller(false);
            lastLookUpTime.verifyAll();
            assert.instanceOf(result, InsidersBuildInstaller, 'Not looking for the correct build');
        });
        test('Update look up time and return installer for insiders build if looking for insiders after 24 hrs of last lookup time', async () => {
            lastLookUpTime
                .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup(l => l.value)
                .returns(() => Date.now() - 2 * frequencyForDailyInsidersCheck) // Looking after 2 days
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.getInstaller(false);
            lastLookUpTime.verifyAll();
            assert.instanceOf(result, InsidersBuildInstaller, 'Not looking for the correct build');
        });
        test('Do not update look up time or return any installer if looking for insiders within 24 hrs of last lookup time', async () => {
            lastLookUpTime
                .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            lastLookUpTime
                .setup(l => l.value)
                .returns(() => Date.now() - frequencyForDailyInsidersCheck / 2) // Looking after half a day
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.getInstaller(false);
            lastLookUpTime.verifyAll();
            expect(result).to.equal(undefined, 'Should not look for any installer');
        });
    });
});

suite('Download channel rules - ExtensionInsidersWeeklyChannelRule', () => {
    let insidersInstaller: InsidersBuildInstaller;
    let persistentStateFactory: IPersistentStateFactory;
    let lastLookUpTime: TypeMoq.IMock<IPersistentState<number>>;
    let insidersDailyChannelRule: ExtensionInsidersWeeklyChannelRule;
    setup(() => {
        insidersInstaller = new InsidersBuildInstaller(undefined as any, undefined as any, undefined as any, undefined as any);
        persistentStateFactory = mock(PersistentStateFactory);
        lastLookUpTime = TypeMoq.Mock.ofType<IPersistentState<number>>();
        when(persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1)).thenReturn(lastLookUpTime.object);
        insidersDailyChannelRule = new ExtensionInsidersWeeklyChannelRule(insidersInstaller, instance(persistentStateFactory));
    });

    test('If insiders channel rule is new, update look up time and return installer for insiders build', async () => {
        lastLookUpTime
            .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        const result = await insidersDailyChannelRule.getInstaller(true);
        lastLookUpTime.verifyAll();
        assert.instanceOf(result, InsidersBuildInstaller, 'Not looking for the correct build');
    });
    suite('If insiders channel rule is not new', async () => {
        test('Update look up time and return installer for insiders build if looking for insiders the first time', async () => {
            lastLookUpTime
                .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup(l => l.value)
                .returns(() => -1)
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.getInstaller(false);
            lastLookUpTime.verifyAll();
            assert.instanceOf(result, InsidersBuildInstaller, 'Not looking for the correct build');
        });
        test('Update look up time and return installer for insiders build if looking for insiders after one week of last lookup time', async () => {
            lastLookUpTime
                .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup(l => l.value)
                .returns(() => Date.now() - 2 * frequencyForWeeklyInsidersCheck) // Looking after 2 weeks
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.getInstaller(false);
            lastLookUpTime.verifyAll();
            assert.instanceOf(result, InsidersBuildInstaller, 'Not looking for the correct build');
        });
        test('Do not update look up time or return any installer if looking for insiders within a week of last lookup time', async () => {
            lastLookUpTime
                .setup(l => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            lastLookUpTime
                .setup(l => l.value)
                .returns(() => Date.now() - frequencyForWeeklyInsidersCheck / 2) // Looking after half a week
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.getInstaller(false);
            lastLookUpTime.verifyAll();
            expect(result).to.equal(undefined, 'Should not look for any installer');
        });
    });
});
