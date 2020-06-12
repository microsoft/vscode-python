// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-any max-func-body-length no-invalid-this

import * as assert from 'assert';
import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../../../client/common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../../client/common/types';
import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { OSType } from '../../../../client/common/utils/platform';
import { InterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection';
import { NextAction } from '../../../../client/interpreter/autoSelection/rules/baseRule';
import { WindowsRegistryInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/winRegistry';
import { IInterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection/types';
import { IInterpreterHelper, IInterpreterLocatorService } from '../../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../../client/interpreter/helpers';
import { WindowsRegistryService } from '../../../../client/pythonEnvironments/discovery/locators/services/windowsRegistryService';
import { PythonInterpreter } from '../../../../client/pythonEnvironments/discovery/types';

suite('Interpreters - Auto Selection - Windows Registry Rule', () => {
    let rule: WindowsRegistryInterpretersAutoSelectionRuleTest;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let state: PersistentState<PythonInterpreter | undefined>;
    let locator: IInterpreterLocatorService;
    let platform: IPlatformService;
    let helper: IInterpreterHelper;
    class WindowsRegistryInterpretersAutoSelectionRuleTest extends WindowsRegistryInterpretersAutoSelectionRule {
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
        locator = mock(WindowsRegistryService);
        platform = mock(PlatformService);

        when(stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(anything(), undefined)).thenReturn(
            instance(state)
        );
        rule = new WindowsRegistryInterpretersAutoSelectionRuleTest(
            instance(fs),
            instance(helper),
            instance(stateFactory),
            instance(platform),
            instance(locator)
        );
    });

    getNamesAndValues<OSType>(OSType).forEach((osType) => {
        test(`Invoke next rule if platform is not windows (${osType.name})`, async function () {
            const manager = mock(InterpreterAutoSelectionService);
            if (osType.value === OSType.Windows) {
                return this.skip();
            }
            const resource = Uri.file('x');
            when(platform.osType).thenReturn(osType.value);

            const nextAction = await rule.onAutoSelectInterpreter(resource, instance(manager));

            verify(platform.osType).once();
            expect(nextAction).to.be.equal(NextAction.runNextRule);
        });
    });
    test('Invoke next rule if there are no interpreters in the registry', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');
        let setGlobalInterpreterInvoked = false;
        when(platform.osType).thenReturn(OSType.Windows);
        when(locator.getInterpreters(resource)).thenResolve([]);
        when(helper.getBestInterpreter(deepEqual([]))).thenReturn(undefined);
        rule.setGlobalInterpreter = async (res: any) => {
            setGlobalInterpreterInvoked = true;
            assert.equal(res, undefined);
            return Promise.resolve(false);
        };

        const nextAction = await rule.onAutoSelectInterpreter(resource, instance(manager));

        verify(locator.getInterpreters(resource)).once();
        verify(platform.osType).once();
        verify(helper.getBestInterpreter(deepEqual([]))).once();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
        expect(setGlobalInterpreterInvoked).to.be.equal(true, 'setGlobalInterpreter not invoked');
    });
    test('Invoke next rule if there are interpreters in the registry and update fails', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');
        let setGlobalInterpreterInvoked = false;
        const interpreterInfo = { path: '1', version: new SemVer('1.0.0') } as any;
        when(platform.osType).thenReturn(OSType.Windows);
        when(locator.getInterpreters(resource)).thenResolve([interpreterInfo]);
        when(helper.getBestInterpreter(deepEqual([interpreterInfo]))).thenReturn(interpreterInfo);
        rule.setGlobalInterpreter = async (res: any) => {
            setGlobalInterpreterInvoked = true;
            expect(res).to.deep.equal(interpreterInfo);
            return Promise.resolve(false);
        };

        const nextAction = await rule.onAutoSelectInterpreter(resource, instance(manager));

        verify(locator.getInterpreters(resource)).once();
        verify(platform.osType).once();
        verify(helper.getBestInterpreter(deepEqual([interpreterInfo]))).once();
        expect(nextAction).to.be.equal(NextAction.runNextRule);
        expect(setGlobalInterpreterInvoked).to.be.equal(true, 'setGlobalInterpreter not invoked');
    });
    test('Do not Invoke next rule if there are interpreters in the registry and update does not fail', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const resource = Uri.file('x');
        let setGlobalInterpreterInvoked = false;
        const interpreterInfo = { path: '1', version: new SemVer('1.0.0') } as any;
        when(platform.osType).thenReturn(OSType.Windows);
        when(locator.getInterpreters(resource)).thenResolve([interpreterInfo]);
        when(helper.getBestInterpreter(deepEqual([interpreterInfo]))).thenReturn(interpreterInfo);
        rule.setGlobalInterpreter = async (res: any) => {
            setGlobalInterpreterInvoked = true;
            expect(res).to.deep.equal(interpreterInfo);
            return Promise.resolve(true);
        };

        const nextAction = await rule.onAutoSelectInterpreter(resource, instance(manager));

        verify(locator.getInterpreters(resource)).once();
        verify(platform.osType).once();
        verify(helper.getBestInterpreter(deepEqual([interpreterInfo]))).once();
        expect(nextAction).to.be.equal(NextAction.exit);
        expect(setGlobalInterpreterInvoked).to.be.equal(true, 'setGlobalInterpreter not invoked');
    });
});
