// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, deepEqual, instance, mock, reset, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { DiscoveryVariants } from '../../../../client/common/experiments/groups';
import { ExperimentService } from '../../../../client/common/experiments/service';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IExperimentService, IPersistentStateFactory, Resource } from '../../../../client/common/types';
import { InterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection';
import { NextAction } from '../../../../client/interpreter/autoSelection/rules/baseRule';
import { CurrentPathInterpretersAutoSelectionRule } from '../../../../client/interpreter/autoSelection/rules/currentPath';
import { IInterpreterAutoSelectionService } from '../../../../client/interpreter/autoSelection/types';
import {
    CURRENT_PATH_SERVICE,
    IComponentAdapter,
    IInterpreterHelper,
    IInterpreterLocatorService,
} from '../../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../../client/interpreter/helpers';
import { ServiceContainer } from '../../../../client/ioc/container';
import { IServiceContainer } from '../../../../client/ioc/types';
import { PythonEnvSource } from '../../../../client/pythonEnvironments/base/info';
import { KnownPathsService } from '../../../../client/pythonEnvironments/discovery/locators/services/KnownPathsService';
import { PythonEnvironment } from '../../../../client/pythonEnvironments/info';

suite('Interpreters - Auto Selection - Current Path Rule', () => {
    let rule: CurrentPathInterpretersAutoSelectionRuleTest;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let state: PersistentState<PythonEnvironment | undefined>;
    let locator: IInterpreterLocatorService;
    let helper: IInterpreterHelper;
    let serviceContainer: IServiceContainer;
    let experimentService: IExperimentService;
    let componentAdapter: IComponentAdapter;
    class CurrentPathInterpretersAutoSelectionRuleTest extends CurrentPathInterpretersAutoSelectionRule {
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
        state = mock(PersistentState);
        fs = mock(FileSystem);
        helper = mock(InterpreterHelper);
        locator = mock(KnownPathsService);
        serviceContainer = mock(ServiceContainer);
        experimentService = mock(ExperimentService);
        componentAdapter = mock<IComponentAdapter>();
        when(
            serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CURRENT_PATH_SERVICE),
        ).thenReturn(instance(locator));
        when(experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching)).thenResolve(false);

        when(stateFactory.createGlobalPersistentState<PythonEnvironment | undefined>(anything(), undefined)).thenReturn(
            instance(state),
        );
        rule = new CurrentPathInterpretersAutoSelectionRuleTest(
            instance(fs),
            instance(helper),
            instance(stateFactory),
            instance(componentAdapter),
            instance(experimentService),
            instance(serviceContainer),
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

        when(helper.getBestInterpreter(deepEqual([interpreterInfo]))).thenReturn(interpreterInfo);
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
    test('When in experiment, invoke next rule if fails to update global state', async () => {
        reset(experimentService);
        when(experimentService.inExperiment(DiscoveryVariants.discoverWithFileWatching)).thenResolve(true);
        const manager = mock(InterpreterAutoSelectionService);
        const interpreterInfo = { path: '1', version: new SemVer('1.0.0') } as any;
        const resource = Uri.file('x');

        when(helper.getBestInterpreter(deepEqual([interpreterInfo]))).thenReturn(interpreterInfo);
        when(locator.getInterpreters(resource)).thenResolve([interpreterInfo]);
        // Return interpreters using the component adapter instead
        when(
            componentAdapter.getInterpreters(resource, undefined, deepEqual([PythonEnvSource.PathEnvVar])),
        ).thenResolve([interpreterInfo]);

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
