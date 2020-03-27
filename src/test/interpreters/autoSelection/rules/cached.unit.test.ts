// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-any max-func-body-length no-invalid-this

import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../../client/common/types';
import { InterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection';
import { NextAction } from '../../../../client/interpreter/autoSelection/rules/baseRule';
import { CachedInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/cached';
import { SystemWideInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/system';
import {
    IInterpreterAutoSelectionRule,
    IInterpreterAutoSelectionService,
} from '../../../../client/interpreter/autoSelection/types';
import { IInterpreterHelper, PythonInterpreter } from '../../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../../client/interpreter/helpers';

suite('Interpreters - Auto Selection - Cached Rule', () => {
    let rule: CachedInterpretersAutoSelectionRuleTest;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let state: PersistentState<PythonInterpreter | undefined>;
    let systemInterpreter: IInterpreterAutoSelectionRule;
    let currentPathInterpreter: IInterpreterAutoSelectionRule;
    let winRegInterpreter: IInterpreterAutoSelectionRule;
    let helper: IInterpreterHelper;
    class CachedInterpretersAutoSelectionRuleTest extends CachedInterpretersAutoSelectionRule {
        public readonly rules!: IInterpreterAutoSelectionRule[];
        public async setGlobalInterpreter(
            interpreter?: PythonInterpreter,
            manager?: IInterpreterAutoSelectionService
        ): Promise<boolean> {
            return super.setGlobalInterpreter(interpreter, manager);
        }
        public async onAutoSelectInterpreter(
            resource: Resource,
            manager?: IInterpreterAutoSelectionService
        ): Promise<NextAction> {
            return super.onAutoSelectInterpreter(resource, manager);
        }
    }
    setup(() => {
        stateFactory = mock(PersistentStateFactory);
        state = mock(PersistentState);
        fs = mock(FileSystem);
        helper = mock(InterpreterHelper);
        systemInterpreter = mock(SystemWideInterpretersAutoSelectionRule);
        currentPathInterpreter = mock(SystemWideInterpretersAutoSelectionRule);
        winRegInterpreter = mock(SystemWideInterpretersAutoSelectionRule);

        when(stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(anything(), undefined)).thenReturn(
            instance(state)
        );
        rule = new CachedInterpretersAutoSelectionRuleTest(
            instance(fs),
            instance(helper),
            instance(stateFactory),
            instance(systemInterpreter),
            instance(currentPathInterpreter),
            instance(winRegInterpreter)
        );
    });

    test('Invoke next rule if there are no cached interpreters', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');

        when(systemInterpreter.getPreviouslyAutoSelectedInterpreter(resource)).thenReturn(undefined);
        when(currentPathInterpreter.getPreviouslyAutoSelectedInterpreter(resource)).thenReturn(undefined);
        when(winRegInterpreter.getPreviouslyAutoSelectedInterpreter(resource)).thenReturn(undefined);

        const nextAction = await rule.onAutoSelectInterpreter(resource, manager);

        verify(systemInterpreter.getPreviouslyAutoSelectedInterpreter(resource)).once();
        verify(currentPathInterpreter.getPreviouslyAutoSelectedInterpreter(resource)).once();
        verify(winRegInterpreter.getPreviouslyAutoSelectedInterpreter(resource)).once();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('Invoke next rule if fails to update global state', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const winRegInterpreterInfo = { path: '1', version: new SemVer('1.0.0') } as any;
        const resource = Uri.file('x');

        when(helper.getBestInterpreter(deepEqual(anything()))).thenReturn(winRegInterpreterInfo);
        when(systemInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).thenReturn(undefined);
        when(currentPathInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).thenReturn(undefined);
        when(winRegInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).thenReturn(winRegInterpreterInfo);

        const moq = typemoq.Mock.ofInstance(rule, typemoq.MockBehavior.Loose, true);
        moq.callBase = true;
        moq.setup((m) => m.setGlobalInterpreter(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(false))
            .verifiable(typemoq.Times.once());

        const nextAction = await moq.object.onAutoSelectInterpreter(resource, manager);

        verify(systemInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).once();
        verify(currentPathInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).once();
        verify(winRegInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).once();
        moq.verifyAll();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('Must not Invoke next rule if updating global state is successful', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const winRegInterpreterInfo = { path: '1', version: new SemVer('1.0.0') } as any;
        const resource = Uri.file('x');

        when(helper.getBestInterpreter(deepEqual(anything()))).thenReturn(winRegInterpreterInfo);
        when(systemInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).thenReturn(undefined);
        when(currentPathInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).thenReturn(undefined);
        when(winRegInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).thenReturn(winRegInterpreterInfo);

        const moq = typemoq.Mock.ofInstance(rule, typemoq.MockBehavior.Loose, true);
        moq.callBase = true;
        moq.setup((m) => m.setGlobalInterpreter(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(typemoq.Times.once());

        const nextAction = await moq.object.onAutoSelectInterpreter(resource, manager);

        verify(systemInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).once();
        verify(currentPathInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).once();
        verify(winRegInterpreter.getPreviouslyAutoSelectedInterpreter(anything())).once();
        moq.verifyAll();
        expect(nextAction).to.be.equal(NextAction.exit);
    });
});
