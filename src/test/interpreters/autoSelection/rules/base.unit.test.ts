// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-any max-func-body-length no-invalid-this

import * as assert from 'assert';
import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../../client/common/types';
import { InterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection';
import { BaseRuleService, NextAction } from '../../../../client/interpreter/autoSelection/rules/baseRule';
import { CurrentPathInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/currentPath';
import {
    AutoSelectionRule,
    IInterpreterAutoSelectionService
} from '../../../../client/interpreter/autoSelection/types';
import { PythonInterpreter } from '../../../../client/pythonEnvironments/info';

suite('Interpreters - Auto Selection - Base Rule', () => {
    let rule: BaseRuleServiceTest;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let state: PersistentState<PythonInterpreter | undefined>;
    class BaseRuleServiceTest extends BaseRuleService {
        public async next(resource: Resource, manager?: IInterpreterAutoSelectionService): Promise<void> {
            return super.next(resource, manager);
        }
        public async cacheSelectedInterpreter(resource: Resource, interpreter: PythonInterpreter | undefined) {
            return super.cacheSelectedInterpreter(resource, interpreter);
        }
        public async setGlobalInterpreter(
            interpreter?: PythonInterpreter,
            manager?: IInterpreterAutoSelectionService
        ): Promise<boolean> {
            return super.setGlobalInterpreter(interpreter, manager);
        }
        protected async onAutoSelectInterpreter(
            _resource: Uri,
            _manager?: IInterpreterAutoSelectionService
        ): Promise<NextAction> {
            return NextAction.runNextRule;
        }
    }
    setup(() => {
        stateFactory = mock(PersistentStateFactory);
        state = mock(PersistentState);
        fs = mock(FileSystem);
        when(stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(anything(), undefined)).thenReturn(
            instance(state)
        );
        rule = new BaseRuleServiceTest(AutoSelectionRule.cachedInterpreters, instance(fs), instance(stateFactory));
    });

    test('State store is created', () => {
        verify(
            stateFactory.createGlobalPersistentState(
                `InterpreterAutoSeletionRule-${AutoSelectionRule.cachedInterpreters}`,
                undefined
            )
        ).once();
    });
    test('Next rule should be invoked', async () => {
        const nextRule = mock(CurrentPathInterpretersAutoSelectionRule);
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.parse('x');

        rule.setNextRule(instance(nextRule));
        await rule.next(resource, manager);

        verify(
            stateFactory.createGlobalPersistentState(
                `InterpreterAutoSeletionRule-${AutoSelectionRule.cachedInterpreters}`,
                undefined
            )
        ).once();
        verify(nextRule.autoSelectInterpreter(resource, manager)).once();
    });
    test('Next rule should not be invoked', async () => {
        const nextRule = mock(CurrentPathInterpretersAutoSelectionRule);
        const resource = Uri.parse('x');

        rule.setNextRule(instance(nextRule));
        await rule.next(resource);

        verify(
            stateFactory.createGlobalPersistentState(
                `InterpreterAutoSeletionRule-${AutoSelectionRule.cachedInterpreters}`,
                undefined
            )
        ).once();
        verify(nextRule.autoSelectInterpreter(anything(), anything())).never();
    });
    test('State store must be updated', async () => {
        const resource = Uri.parse('x');
        const interpreterInfo = { x: '1324' } as any;
        when(state.updateValue(anything())).thenResolve();

        await rule.cacheSelectedInterpreter(resource, interpreterInfo);

        verify(state.updateValue(interpreterInfo)).once();
    });
    test('State store must be cleared when file does not exist', async () => {
        const resource = Uri.parse('x');
        const interpreterInfo = { path: '1324' } as any;
        when(state.value).thenReturn(interpreterInfo);
        when(state.updateValue(anything())).thenResolve();
        when(fs.fileExists(interpreterInfo.path)).thenResolve(false);

        await rule.autoSelectInterpreter(resource);

        verify(state.value).atLeast(1);
        verify(state.updateValue(undefined)).once();
        verify(fs.fileExists(interpreterInfo.path)).once();
    });
    test('State store must not be cleared when file exists', async () => {
        const resource = Uri.parse('x');
        const interpreterInfo = { path: '1324' } as any;
        when(state.value).thenReturn(interpreterInfo);
        when(state.updateValue(anything())).thenResolve();
        when(fs.fileExists(interpreterInfo.path)).thenResolve(true);

        await rule.autoSelectInterpreter(resource);

        verify(state.value).atLeast(1);
        verify(state.updateValue(anything())).never();
        verify(fs.fileExists(interpreterInfo.path)).once();
    });
    test("Get undefined if there's nothing in state store", async () => {
        when(state.value).thenReturn(undefined);

        expect(rule.getPreviouslyAutoSelectedInterpreter(Uri.parse('x'))).to.be.equal(undefined, 'Must be undefined');

        verify(state.value).atLeast(1);
    });
    test('Get value from state store', async () => {
        const stateStoreValue = 'x';
        when(state.value).thenReturn(stateStoreValue as any);

        expect(rule.getPreviouslyAutoSelectedInterpreter(Uri.parse('x'))).to.be.equal(stateStoreValue);

        verify(state.value).atLeast(1);
    });
    test('setGlobalInterpreter should do nothing if interpreter is undefined or version is empty', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const interpreterInfo = { path: '1324' } as any;

        const result1 = await rule.setGlobalInterpreter(undefined, instance(manager));
        const result2 = await rule.setGlobalInterpreter(interpreterInfo, instance(manager));

        verify(manager.setGlobalInterpreter(anything())).never();
        assert.equal(result1, false);
        assert.equal(result2, false);
    });
    test('setGlobalInterpreter should not update manager if interpreter is not better than one stored in manager', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const interpreterInfo = { path: '1324', version: new SemVer('1.0.0') } as any;
        const interpreterInfoInManager = { path: '2', version: new SemVer('2.0.0') } as any;
        when(manager.getAutoSelectedInterpreter(undefined)).thenReturn(interpreterInfoInManager);

        const result = await rule.setGlobalInterpreter(interpreterInfo, instance(manager));

        verify(manager.getAutoSelectedInterpreter(undefined)).once();
        verify(manager.setGlobalInterpreter(anything())).never();
        assert.equal(result, false);
    });
    test('setGlobalInterpreter should update manager if interpreter is better than one stored in manager', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const interpreterInfo = { path: '1324', version: new SemVer('3.0.0') } as any;
        const interpreterInfoInManager = { path: '2', version: new SemVer('2.0.0') } as any;
        when(manager.getAutoSelectedInterpreter(undefined)).thenReturn(interpreterInfoInManager);

        const result = await rule.setGlobalInterpreter(interpreterInfo, instance(manager));

        verify(manager.getAutoSelectedInterpreter(undefined)).once();
        verify(manager.setGlobalInterpreter(anything())).once();
        assert.equal(result, true);
    });
});
