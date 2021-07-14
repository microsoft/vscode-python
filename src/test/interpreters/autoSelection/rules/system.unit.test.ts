// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../../client/common/types';
import { InterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection';
import { NextAction } from '../../../../client/interpreter/autoSelection/rules/baseRule';
import { SystemWideInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/system';
import { IInterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection/types';
import { IInterpreterHelper, IInterpreterService } from '../../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../../client/interpreter/helpers';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { PythonEnvironment } from '../../../../client/pythonEnvironments/info';

suite('Interpreters - Auto Selection - System Interpreters Rule', () => {
    let rule: SystemWideInterpretersAutoSelectionRuleTest;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let state: PersistentState<PythonEnvironment | undefined>;
    let interpreterService: IInterpreterService;
    let helper: IInterpreterHelper;
    class SystemWideInterpretersAutoSelectionRuleTest extends SystemWideInterpretersAutoSelectionRule {
        public async setGlobalInterpreter(
            interpreter?: PythonEnvironment,
            manager?: IInterpreterAutoSelectionService,
        ): Promise<boolean> {
            return super.setGlobalInterpreter(interpreter, manager);
        }

        public async onAutoSelectInterpreter(
            resource: Resource,
            manager?: IInterpreterAutoSelectionService,
        ): Promise<NextAction> {
            return super.onAutoSelectInterpreter(resource, manager);
        }
    }
    setup(() => {
        stateFactory = mock(PersistentStateFactory);
        state = mock(PersistentState) as PersistentState<PythonEnvironment | undefined>;
        fs = mock(FileSystem);
        helper = mock(InterpreterHelper);
        interpreterService = mock(InterpreterService);

        when(stateFactory.createGlobalPersistentState<PythonEnvironment | undefined>(anything(), undefined)).thenReturn(
            instance(state),
        );
        rule = new SystemWideInterpretersAutoSelectionRuleTest(
            instance(fs),
            instance(helper),
            instance(stateFactory),
            instance(interpreterService),
        );
    });

    test('Invoke next rule if there are no interpreters in the current path', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');
        let setGlobalInterpreterInvoked = false;
        when(interpreterService.getInterpreters(resource)).thenResolve([]);
        when(helper.getBestInterpreter(deepEqual([]))).thenReturn(undefined);
        rule.setGlobalInterpreter = async (res: PythonEnvironment | undefined) => {
            setGlobalInterpreterInvoked = true;
            assert.strictEqual(res, undefined);
            return Promise.resolve(false);
        };

        const nextAction = await rule.onAutoSelectInterpreter(resource, manager);

        verify(interpreterService.getInterpreters(resource)).once();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
        expect(setGlobalInterpreterInvoked).to.be.equal(true, 'setGlobalInterpreter not invoked');
    });
    test('Invoke next rule if there interpreters in the current path but update fails', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');
        let setGlobalInterpreterInvoked = false;
        const interpreterInfo = ({ path: '1', version: new SemVer('1.0.0') } as unknown) as PythonEnvironment;
        when(interpreterService.getInterpreters(resource)).thenResolve([interpreterInfo]);
        when(helper.getBestInterpreter(deepEqual([interpreterInfo]))).thenReturn(interpreterInfo);
        rule.setGlobalInterpreter = async (res: PythonEnvironment | undefined) => {
            setGlobalInterpreterInvoked = true;
            expect(res).deep.equal(interpreterInfo);
            return Promise.resolve(false);
        };

        const nextAction = await rule.onAutoSelectInterpreter(resource, manager);

        verify(interpreterService.getInterpreters(resource)).once();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
        expect(setGlobalInterpreterInvoked).to.be.equal(true, 'setGlobalInterpreter not invoked');
    });
    test('Do not Invoke next rule if there interpreters in the current path and update does not fail', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');
        let setGlobalInterpreterInvoked = false;
        const interpreterInfo = ({ path: '1', version: new SemVer('1.0.0') } as unknown) as PythonEnvironment;
        when(interpreterService.getInterpreters(resource)).thenResolve([interpreterInfo]);
        when(helper.getBestInterpreter(deepEqual([interpreterInfo]))).thenReturn(interpreterInfo);
        rule.setGlobalInterpreter = async (res: PythonEnvironment | undefined) => {
            setGlobalInterpreterInvoked = true;
            expect(res).deep.equal(interpreterInfo);
            return Promise.resolve(true);
        };

        const nextAction = await rule.onAutoSelectInterpreter(resource, manager);

        verify(interpreterService.getInterpreters(resource)).once();
        expect(nextAction).to.be.equal(NextAction.exit);
        expect(setGlobalInterpreterInvoked).to.be.equal(true, 'setGlobalInterpreter not invoked');
    });
});
