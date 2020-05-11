// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-any max-func-body-length no-invalid-this

import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../../client/common/types';
import { InterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection';
import { NextAction } from '../../../../client/interpreter/autoSelection/rules/baseRule';
import { CurrentPathInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/currentPath';
import { IInterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection/types';
import {
    IInterpreterHelper,
    IInterpreterLocatorService,
    PythonInterpreter
} from '../../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../../client/interpreter/helpers';
import { KnownPathsService } from '../../../../client/interpreter/locators/services/KnownPathsService';

suite('Interpreters - Auto Selection - Current Path Rule', () => {
    let rule: CurrentPathInterpretersAutoSelectionRuleTest;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let state: PersistentState<PythonInterpreter | undefined>;
    let locator: IInterpreterLocatorService;
    let helper: IInterpreterHelper;
    class CurrentPathInterpretersAutoSelectionRuleTest extends CurrentPathInterpretersAutoSelectionRule {
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
        locator = mock(KnownPathsService);

        when(stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(anything(), undefined)).thenReturn(
            instance(state)
        );
        rule = new CurrentPathInterpretersAutoSelectionRuleTest(
            instance(fs),
            instance(helper),
            instance(stateFactory),
            instance(locator)
        );
    });

    test('Invoke next rule if there are no interpreters in the current path', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');

        when(locator.getInterpreters(resource)).thenResolve([]);

        const nextAction = await rule.onAutoSelectInterpreter(resource, manager);

        verify(locator.getInterpreters(resource)).once();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('Invoke next rule if fails to update global state', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const interpreterInfo = { path: '1', version: new SemVer('1.0.0') } as any;
        const resource = Uri.file('x');

        when(helper.getBestInterpreter(anything())).thenReturn(interpreterInfo);
        when(locator.getInterpreters(resource)).thenResolve([interpreterInfo]);

        const moq = typemoq.Mock.ofInstance(rule, typemoq.MockBehavior.Loose, true);
        moq.callBase = true;
        moq.setup((m) => m.setGlobalInterpreter(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(false))
            .verifiable(typemoq.Times.once());

        const nextAction = await moq.object.onAutoSelectInterpreter(resource, manager);

        moq.verifyAll();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('Not Invoke next rule if succeeds to update global state', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const interpreterInfo = { path: '1', version: new SemVer('1.0.0') } as any;
        const resource = Uri.file('x');

        when(helper.getBestInterpreter(anything())).thenReturn(interpreterInfo);
        when(locator.getInterpreters(resource)).thenResolve([interpreterInfo]);

        const moq = typemoq.Mock.ofInstance(rule, typemoq.MockBehavior.Loose, true);
        moq.callBase = true;
        moq.setup((m) => m.setGlobalInterpreter(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(typemoq.Times.once());

        const nextAction = await moq.object.onAutoSelectInterpreter(resource, manager);

        moq.verifyAll();
        expect(nextAction).to.be.equal(NextAction.exit);
    });
});
