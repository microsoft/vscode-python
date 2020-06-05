// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-any max-func-body-length no-invalid-this

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { DeprecatePythonPath } from '../../../../client/common/experiments/groups';
import { ExperimentsManager } from '../../../../client/common/experiments/manager';
import { InterpreterPathService } from '../../../../client/common/interpreterPathService';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import {
    IExperimentsManager,
    IInterpreterPathService,
    IPersistentStateFactory,
    Resource
} from '../../../../client/common/types';
import { InterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection';
import { NextAction } from '../../../../client/interpreter/autoSelection/rules/baseRule';
import { SettingsInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/settings';
import { IInterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection/types';
import { PythonInterpreter } from '../../../../client/pythonEnvironments/discovery/types';

suite('Interpreters - Auto Selection - Settings Rule', () => {
    let rule: SettingsInterpretersAutoSelectionRuleTest;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let state: PersistentState<PythonInterpreter | undefined>;
    let workspaceService: IWorkspaceService;
    let experimentsManager: IExperimentsManager;
    let interpreterPathService: IInterpreterPathService;
    class SettingsInterpretersAutoSelectionRuleTest extends SettingsInterpretersAutoSelectionRule {
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
        workspaceService = mock(WorkspaceService);
        experimentsManager = mock(ExperimentsManager);
        interpreterPathService = mock(InterpreterPathService);
        when(experimentsManager.sendTelemetryIfInExperiment(DeprecatePythonPath.control)).thenReturn(undefined);

        when(stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(anything(), undefined)).thenReturn(
            instance(state)
        );
        rule = new SettingsInterpretersAutoSelectionRuleTest(
            instance(fs),
            instance(stateFactory),
            instance(workspaceService),
            instance(experimentsManager),
            instance(interpreterPathService)
        );
    });

    test('If in experiment, invoke next rule if python Path in user settings is default', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const pythonPathInConfig = {};

        when(experimentsManager.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
        when(interpreterPathService.inspect(undefined)).thenReturn(pythonPathInConfig as any);

        const nextAction = await rule.onAutoSelectInterpreter(undefined, manager);

        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('If in experiment, invoke next rule if python Path in user settings is not defined', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const pythonPathInConfig = { globalValue: 'python' };

        when(experimentsManager.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
        when(interpreterPathService.inspect(undefined)).thenReturn(pythonPathInConfig as any);

        const nextAction = await rule.onAutoSelectInterpreter(undefined, manager);

        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('If in experiment, must not Invoke next rule if python Path in user settings is not default', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const pythonPathInConfig = { globalValue: 'something else' };

        when(experimentsManager.inExperiment(DeprecatePythonPath.experiment)).thenReturn(true);
        when(interpreterPathService.inspect(undefined)).thenReturn(pythonPathInConfig as any);

        const nextAction = await rule.onAutoSelectInterpreter(undefined, manager);

        expect(nextAction).to.be.equal(NextAction.exit);
    });

    test('If not in experiment, invoke next rule if python Path in user settings is default', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const pythonPathInConfig = {};
        const pythonPath = { inspect: () => pythonPathInConfig };

        when(workspaceService.getConfiguration('python', null as any)).thenReturn(pythonPath as any);

        const nextAction = await rule.onAutoSelectInterpreter(undefined, manager);

        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('If not in experiment, invoke next rule if python Path in user settings is not defined', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const pythonPathInConfig = { globalValue: 'python' };
        const pythonPath = { inspect: () => pythonPathInConfig };

        when(workspaceService.getConfiguration('python', null as any)).thenReturn(pythonPath as any);

        const nextAction = await rule.onAutoSelectInterpreter(undefined, manager);

        expect(nextAction).to.be.equal(NextAction.runNextRule);
    });
    test('If not in experiment, must not Invoke next rule if python Path in user settings is not default', async () => {
        const manager = mock(InterpreterAutoSelectionService);
        const pythonPathInConfig = { globalValue: 'something else' };
        const pythonPath = { inspect: () => pythonPathInConfig };

        when(workspaceService.getConfiguration('python', null as any)).thenReturn(pythonPath as any);

        const nextAction = await rule.onAutoSelectInterpreter(undefined, manager);

        expect(nextAction).to.be.equal(NextAction.exit);
    });
});
