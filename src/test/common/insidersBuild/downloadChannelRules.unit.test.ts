// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import {
    ExtensionInsidersDailyChannelRule,
    ExtensionInsidersOffChannelRule,
    ExtensionInsidersWeeklyChannelRule,
    frequencyForDailyInsidersCheck,
    frequencyForWeeklyInsidersCheck,
    lastLookUpTimeKey,
} from '../../../client/common/insidersBuild/downloadChannelRules';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentState, IPersistentStateFactory } from '../../../client/common/types';

suite('Download channel rules - ExtensionInsidersOffChannelRule', () => {
    let stableChannelRule: ExtensionInsidersOffChannelRule;
    setup(() => {
        stableChannelRule = new ExtensionInsidersOffChannelRule();
    });

    test('Never look for insiders build', async () => {
        const result = await stableChannelRule.shouldLookForInsidersBuild();
        assert.equal(result, false, 'Not looking for the correct build');
    });
});

suite('Download channel rules - ExtensionInsidersDailyChannelRule', () => {
    let persistentStateFactory: IPersistentStateFactory;
    let lastLookUpTime: TypeMoq.IMock<IPersistentState<number>>;
    let insidersDailyChannelRule: ExtensionInsidersDailyChannelRule;
    setup(() => {
        persistentStateFactory = mock(PersistentStateFactory);
        lastLookUpTime = TypeMoq.Mock.ofType<IPersistentState<number>>();
        when(persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1)).thenReturn(
            lastLookUpTime.object,
        );
        insidersDailyChannelRule = new ExtensionInsidersDailyChannelRule(instance(persistentStateFactory));
    });

    test('If insiders channel rule is new, update look up time and return installer for insiders build', async () => {
        lastLookUpTime
            .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        const result = await insidersDailyChannelRule.shouldLookForInsidersBuild(true);
        lastLookUpTime.verifyAll();
        assert.equal(result, true, 'Not looking for the correct build');
    });
    suite('If insiders channel rule is not new', async () => {
        test('Update look up time and return installer for insiders build if looking for insiders the first time', async () => {
            lastLookUpTime
                .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup((l) => l.value)
                .returns(() => -1)
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.shouldLookForInsidersBuild(false);
            lastLookUpTime.verifyAll();
            assert.equal(result, true, 'Not looking for the correct build');
        });
        test('Update look up time and return installer for insiders build if looking for insiders after 24 hrs of last lookup time', async () => {
            lastLookUpTime
                .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup((l) => l.value)
                .returns(() => Date.now() - 2 * frequencyForDailyInsidersCheck) // Looking after 2 days
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.shouldLookForInsidersBuild(false);
            lastLookUpTime.verifyAll();
            assert.equal(result, true, 'Not looking for the correct build');
        });
        test('Do not update look up time or return any installer if looking for insiders within 24 hrs of last lookup time', async () => {
            lastLookUpTime
                .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            lastLookUpTime
                .setup((l) => l.value)
                .returns(() => Date.now() - frequencyForDailyInsidersCheck / 2) // Looking after half a day
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersDailyChannelRule.shouldLookForInsidersBuild(false);
            lastLookUpTime.verifyAll();
            assert.equal(result, false, 'Not looking for the correct build');
        });
    });
});

suite('Download channel rules - ExtensionInsidersWeeklyChannelRule', () => {
    let persistentStateFactory: IPersistentStateFactory;
    let lastLookUpTime: TypeMoq.IMock<IPersistentState<number>>;
    let insidersWeeklyChannelRule: ExtensionInsidersWeeklyChannelRule;
    setup(() => {
        persistentStateFactory = mock(PersistentStateFactory);
        lastLookUpTime = TypeMoq.Mock.ofType<IPersistentState<number>>();
        when(persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1)).thenReturn(
            lastLookUpTime.object,
        );
        insidersWeeklyChannelRule = new ExtensionInsidersWeeklyChannelRule(instance(persistentStateFactory));
    });

    test('If insiders channel rule is new, update look up time and return installer for insiders build', async () => {
        lastLookUpTime
            .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        const result = await insidersWeeklyChannelRule.shouldLookForInsidersBuild(true);
        lastLookUpTime.verifyAll();
        assert.equal(result, true, 'Not looking for the correct build');
    });
    suite('If insiders channel rule is not new', async () => {
        test('Update look up time and return installer for insiders build if looking for insiders the first time', async () => {
            lastLookUpTime
                .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup((l) => l.value)
                .returns(() => -1)
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersWeeklyChannelRule.shouldLookForInsidersBuild(false);
            lastLookUpTime.verifyAll();
            assert.equal(result, true, 'Not looking for the correct build');
        });
        test('Update look up time and return installer for insiders build if looking for insiders after a week of last lookup time', async () => {
            lastLookUpTime
                .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            lastLookUpTime
                .setup((l) => l.value)
                .returns(() => Date.now() - 2 * frequencyForWeeklyInsidersCheck) // Looking after 2 weeks
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersWeeklyChannelRule.shouldLookForInsidersBuild(false);
            lastLookUpTime.verifyAll();
            assert.equal(result, true, 'Not looking for the correct build');
        });
        test('Do not update look up time or return any installer if looking for insiders within one week of last lookup time', async () => {
            lastLookUpTime
                .setup((l) => l.updateValue(TypeMoq.It.isAnyNumber()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            lastLookUpTime
                .setup((l) => l.value)
                .returns(() => Date.now() - frequencyForWeeklyInsidersCheck / 2) // Looking after half a week
                .verifiable(TypeMoq.Times.atLeastOnce());
            const result = await insidersWeeklyChannelRule.shouldLookForInsidersBuild(false);
            lastLookUpTime.verifyAll();
            assert.equal(result, false, 'Not looking for the correct build');
        });
    });
});
