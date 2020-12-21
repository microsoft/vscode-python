// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as Typemoq from 'typemoq';
import { EventEmitter, Uri } from 'vscode';
import { IPersistentState } from '../../../../client/common/types';
import { createDeferred, sleep } from '../../../../client/common/utils/async';
import { InterpreterSecurityService } from '../../../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityService';
import {
    IInterpreterEvaluation,
    IInterpreterSecurityStorage,
} from '../../../../client/interpreter/autoSelection/types';

suite('Interpreter Security service', () => {
    const safeInterpretersList = ['safe1', 'safe2'];
    const unsafeInterpretersList = ['unsafe1', 'unsafe2'];
    const resource = Uri.parse('a');
    let interpreterSecurityStorage: Typemoq.IMock<IInterpreterSecurityStorage>;
    let interpreterEvaluation: Typemoq.IMock<IInterpreterEvaluation>;
    let unsafeInterpreters: Typemoq.IMock<IPersistentState<string[]>>;
    let safeInterpreters: Typemoq.IMock<IPersistentState<string[]>>;
    let interpreterSecurityService: InterpreterSecurityService;
    setup(() => {
        interpreterEvaluation = Typemoq.Mock.ofType<IInterpreterEvaluation>();
        unsafeInterpreters = Typemoq.Mock.ofType<IPersistentState<string[]>>();
        safeInterpreters = Typemoq.Mock.ofType<IPersistentState<string[]>>();
        interpreterSecurityStorage = Typemoq.Mock.ofType<IInterpreterSecurityStorage>();
        safeInterpreters.setup((s) => s.value).returns(() => safeInterpretersList);
        unsafeInterpreters.setup((s) => s.value).returns(() => unsafeInterpretersList);
        interpreterSecurityStorage.setup((p) => p.unsafeInterpreters).returns(() => unsafeInterpreters.object);
        interpreterSecurityStorage.setup((p) => p.safeInterpreters).returns(() => safeInterpreters.object);
        interpreterSecurityService = new InterpreterSecurityService(
            interpreterSecurityStorage.object,
            interpreterEvaluation.object,
        );
    });

    suite('Method isSafe()', () => {
        test('Returns `true` if interpreter is in the safe interpreters list', () => {
            let isSafe = interpreterSecurityService.isSafe({ path: 'safe1' } as any);
            expect(isSafe).to.equal(true, '');

            isSafe = interpreterSecurityService.isSafe({ path: 'safe2' } as any);
            expect(isSafe).to.equal(true, '');
        });

        test('Returns `false` if interpreter is in the unsafe intepreters list', () => {
            let isSafe = interpreterSecurityService.isSafe({ path: 'unsafe1' } as any);
            expect(isSafe).to.equal(false, '');

            isSafe = interpreterSecurityService.isSafe({ path: 'unsafe2' } as any);
            expect(isSafe).to.equal(false, '');
        });

        test('Returns `undefined` if interpreter is not in either of these lists', () => {
            const interpreter = { path: 'random' } as any;
            interpreterEvaluation
                .setup((i) => i.inferValueUsingCurrentState(interpreter, resource))

                .returns(() => 'value' as any)
                .verifiable(Typemoq.Times.once());
            const isSafe = interpreterSecurityService.isSafe(interpreter, resource);
            expect(isSafe).to.equal('value', '');
            interpreterEvaluation.verifyAll();
        });
    });

    suite('Method evaluateInterpreterSafety()', () => {
        test("If interpreter to be evaluated already exists in the safe intepreters list, simply return and don't evaluate", async () => {
            const interpreter = { path: 'safe2' };
            interpreterEvaluation
                .setup((i) => i.evaluateIfInterpreterIsSafe(Typemoq.It.isAny(), Typemoq.It.isAny()))
                .verifiable(Typemoq.Times.never());

            await interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource);
            interpreterEvaluation.verifyAll();
        });

        test("If interpreter to be evaluated already exists in the unsafe intepreters list, simply return and don't evaluate", async () => {
            const interpreter = { path: 'unsafe1' };
            interpreterEvaluation
                .setup((i) => i.evaluateIfInterpreterIsSafe(Typemoq.It.isAny(), Typemoq.It.isAny()))
                .verifiable(Typemoq.Times.never());

            await interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource);
            interpreterEvaluation.verifyAll();
        });

        test('If interpreter to be evaluated does not exists in the either of the intepreters list, evaluate the interpreters', async () => {
            const interpreter = { path: 'notInEitherLists' };
            interpreterEvaluation
                .setup((i) => i.evaluateIfInterpreterIsSafe(Typemoq.It.isAny(), Typemoq.It.isAny()))
                .verifiable(Typemoq.Times.once());

            await interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource);
            interpreterEvaluation.verifyAll();
        });

        test('If interpreter is evaluated to be safe, add it in the safe interpreters list', async () => {
            const interpreter = { path: 'notInEitherLists' };
            interpreterEvaluation
                .setup((i) => i.evaluateIfInterpreterIsSafe(Typemoq.It.isAny(), Typemoq.It.isAny()))
                .returns(() => Promise.resolve(true))
                .verifiable(Typemoq.Times.once());
            safeInterpreters
                .setup((s) => s.updateValue(['notInEitherLists', ...safeInterpretersList]))
                .returns(() => Promise.resolve())
                .verifiable(Typemoq.Times.once());

            await interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource);
            interpreterEvaluation.verifyAll();
            safeInterpreters.verifyAll();
        });

        test('If interpreter is evaluated to be unsafe, add it in the unsafe interpreters list', async () => {
            const interpreter = { path: 'notInEitherLists' };
            interpreterEvaluation
                .setup((i) => i.evaluateIfInterpreterIsSafe(Typemoq.It.isAny(), Typemoq.It.isAny()))
                .returns(() => Promise.resolve(false))
                .verifiable(Typemoq.Times.once());
            unsafeInterpreters
                .setup((s) => s.updateValue(['notInEitherLists', ...unsafeInterpretersList]))
                .returns(() => Promise.resolve())
                .verifiable(Typemoq.Times.once());

            await interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource);
            interpreterEvaluation.verifyAll();
            unsafeInterpreters.verifyAll();
        });

        test('Ensure an event is fired at the end of the method execution', async () => {
            const _didSafeInterpretersChange = Typemoq.Mock.ofType<EventEmitter<void>>();
            const interpreter = { path: 'notInEitherLists' };
            interpreterEvaluation
                .setup((i) => i.evaluateIfInterpreterIsSafe(Typemoq.It.isAny(), Typemoq.It.isAny()))
                .returns(() => Promise.resolve(false));
            unsafeInterpreters
                .setup((s) => s.updateValue(['notInEitherLists', ...unsafeInterpretersList]))
                .returns(() => Promise.resolve());
            interpreterSecurityService._didSafeInterpretersChange = _didSafeInterpretersChange.object;
            _didSafeInterpretersChange
                .setup((d) => d.fire())
                .returns(() => undefined)
                .verifiable(Typemoq.Times.once());

            await interpreterSecurityService.evaluateAndRecordInterpreterSafety(interpreter as any, resource);
            interpreterEvaluation.verifyAll();
            unsafeInterpreters.verifyAll();
            _didSafeInterpretersChange.verifyAll();
        });
    });

    test('Ensure onDidChangeSafeInterpreters() method captures the fired event', async () => {
        const deferred = createDeferred<true>();
        interpreterSecurityService.onDidChangeSafeInterpreters(() => {
            deferred.resolve(true);
        });
        interpreterSecurityService._didSafeInterpretersChange.fire();
        const eventCaptured = await Promise.race([deferred.promise, sleep(1000).then(() => false)]);
        expect(eventCaptured).to.equal(true, 'Event should be captured');
    });
});
