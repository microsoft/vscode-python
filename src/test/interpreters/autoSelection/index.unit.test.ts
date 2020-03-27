// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-any max-func-body-length no-invalid-this

import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PersistentState, PersistentStateFactory } from '../../../client/common/persistentState';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IPersistentStateFactory, Resource } from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { InterpreterAutoSelectionService } from '../../../client/interpreter/autoSelection';
import { InterpreterAutoSeletionProxyService } from '../../../client/interpreter/autoSelection/proxy';
import { CachedInterpretersAutoSelectionRule } from '../../../client/interpreter/autoSelection/rules/cached';
import { CurrentPathInterpretersAutoSelectionRule } from '../../../client/interpreter/autoSelection/rules/currentPath';
import { SettingsInterpretersAutoSelectionRule } from '../../../client/interpreter/autoSelection/rules/settings';
import { SystemWideInterpretersAutoSelectionRule } from '../../../client/interpreter/autoSelection/rules/system';
import { WindowsRegistryInterpretersAutoSelectionRule } from '../../../client/interpreter/autoSelection/rules/winRegistry';
import { WorkspaceVirtualEnvInterpretersAutoSelectionRule } from '../../../client/interpreter/autoSelection/rules/workspaceEnv';
import {
    IInterpreterAutoSelectionRule,
    IInterpreterAutoSeletionProxyService
} from '../../../client/interpreter/autoSelection/types';
import { IInterpreterHelper, PythonInterpreter } from '../../../client/interpreter/contracts';
import { InterpreterHelper } from '../../../client/interpreter/helpers';

const preferredGlobalInterpreter = 'preferredGlobalPyInterpreter';

suite('Interpreters - Auto Selection', () => {
    let autoSelectionService: InterpreterAutoSelectionServiceTest;
    let workspaceService: IWorkspaceService;
    let stateFactory: IPersistentStateFactory;
    let fs: IFileSystem;
    let systemInterpreter: IInterpreterAutoSelectionRule;
    let currentPathInterpreter: IInterpreterAutoSelectionRule;
    let winRegInterpreter: IInterpreterAutoSelectionRule;
    let cachedPaths: IInterpreterAutoSelectionRule;
    let userDefinedInterpreter: IInterpreterAutoSelectionRule;
    let workspaceInterpreter: IInterpreterAutoSelectionRule;
    let state: PersistentState<PythonInterpreter | undefined>;
    let helper: IInterpreterHelper;
    let proxy: IInterpreterAutoSeletionProxyService;
    class InterpreterAutoSelectionServiceTest extends InterpreterAutoSelectionService {
        public initializeStore(resource: Resource): Promise<void> {
            return super.initializeStore(resource);
        }
        public storeAutoSelectedInterpreter(resource: Resource, interpreter: PythonInterpreter | undefined) {
            return super.storeAutoSelectedInterpreter(resource, interpreter);
        }
        public getAutoSelectedWorkspacePromises() {
            return this.autoSelectedWorkspacePromises;
        }
    }
    setup(() => {
        workspaceService = mock(WorkspaceService);
        stateFactory = mock(PersistentStateFactory);
        state = mock(PersistentState);
        fs = mock(FileSystem);
        systemInterpreter = mock(SystemWideInterpretersAutoSelectionRule);
        currentPathInterpreter = mock(CurrentPathInterpretersAutoSelectionRule);
        winRegInterpreter = mock(WindowsRegistryInterpretersAutoSelectionRule);
        cachedPaths = mock(CachedInterpretersAutoSelectionRule);
        userDefinedInterpreter = mock(SettingsInterpretersAutoSelectionRule);
        workspaceInterpreter = mock(WorkspaceVirtualEnvInterpretersAutoSelectionRule);
        helper = mock(InterpreterHelper);
        proxy = mock(InterpreterAutoSeletionProxyService);

        autoSelectionService = new InterpreterAutoSelectionServiceTest(
            instance(workspaceService),
            instance(stateFactory),
            instance(fs),
            instance(systemInterpreter),
            instance(currentPathInterpreter),
            instance(winRegInterpreter),
            instance(cachedPaths),
            instance(userDefinedInterpreter),
            instance(workspaceInterpreter),
            instance(proxy),
            instance(helper)
        );
    });

    test('Instance is registered in proxy', () => {
        verify(proxy.registerInstance!(autoSelectionService)).once();
    });
    test('Rules are chained in order of preference', () => {
        verify(userDefinedInterpreter.setNextRule(instance(workspaceInterpreter))).once();
        verify(workspaceInterpreter.setNextRule(instance(cachedPaths))).once();
        verify(cachedPaths.setNextRule(instance(currentPathInterpreter))).once();
        verify(currentPathInterpreter.setNextRule(instance(winRegInterpreter))).once();
        verify(winRegInterpreter.setNextRule(instance(systemInterpreter))).once();
        verify(systemInterpreter.setNextRule(anything())).never();
    });
    test('Run rules in background', async () => {
        let eventFired = false;
        autoSelectionService.onDidChangeAutoSelectedInterpreter(() => (eventFired = true));
        autoSelectionService.initializeStore = () => Promise.resolve();
        await autoSelectionService.autoSelectInterpreter(undefined);

        expect(eventFired).to.deep.equal(true, 'event not fired');

        const allRules = [
            userDefinedInterpreter,
            winRegInterpreter,
            currentPathInterpreter,
            systemInterpreter,
            workspaceInterpreter,
            cachedPaths
        ];
        for (const service of allRules) {
            verify(service.autoSelectInterpreter(undefined)).once();
            if (service !== userDefinedInterpreter) {
                verify(service.autoSelectInterpreter(anything(), autoSelectionService)).never();
            }
        }
        verify(userDefinedInterpreter.autoSelectInterpreter(anything(), autoSelectionService)).once();
    });
    test('Run userDefineInterpreter as the first rule', async () => {
        let eventFired = false;
        autoSelectionService.onDidChangeAutoSelectedInterpreter(() => (eventFired = true));
        autoSelectionService.initializeStore = () => Promise.resolve();

        await autoSelectionService.autoSelectInterpreter(undefined);

        expect(eventFired).to.deep.equal(true, 'event not fired');
        verify(userDefinedInterpreter.autoSelectInterpreter(undefined, autoSelectionService)).once();
    });
    test('Initialize the store', async () => {
        let initialize = false;
        let eventFired = false;
        autoSelectionService.onDidChangeAutoSelectedInterpreter(() => (eventFired = true));
        autoSelectionService.initializeStore = async () => (initialize = true as any);

        await autoSelectionService.autoSelectInterpreter(undefined);

        expect(eventFired).to.deep.equal(true, 'event not fired');
        expect(initialize).to.be.equal(true, 'Not invoked');
    });
    test('Initializing the store would be executed once', async () => {
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.initializeStore(undefined);

        verify(stateFactory.createGlobalPersistentState(preferredGlobalInterpreter, undefined)).once();
    });
    test("Clear file stored in cache if it doesn't exist", async () => {
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        when(state.value).thenReturn(interpreterInfo);
        when(fs.fileExists(pythonPath)).thenResolve(false);

        await autoSelectionService.initializeStore(undefined);

        verify(stateFactory.createGlobalPersistentState(preferredGlobalInterpreter, undefined)).once();
        verify(state.value).atLeast(1);
        verify(fs.fileExists(pythonPath)).once();
        verify(state.updateValue(undefined)).once();
    });
    test('Should not clear file stored in cache if it does exist', async () => {
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        when(state.value).thenReturn(interpreterInfo);
        when(fs.fileExists(pythonPath)).thenResolve(true);

        await autoSelectionService.initializeStore(undefined);

        verify(stateFactory.createGlobalPersistentState(preferredGlobalInterpreter, undefined)).once();
        verify(state.value).atLeast(1);
        verify(fs.fileExists(pythonPath)).once();
        verify(state.updateValue(undefined)).never();
    });
    test('Store interpreter info in state store when resource is undefined', async () => {
        let eventFired = false;
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        when(workspaceService.getWorkspaceFolderIdentifier(undefined, anything())).thenReturn('');
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        autoSelectionService.onDidChangeAutoSelectedInterpreter(() => (eventFired = true));

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.storeAutoSelectedInterpreter(undefined, interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(undefined);

        verify(state.updateValue(interpreterInfo)).once();
        expect(selectedInterpreter).to.deep.equal(interpreterInfo);
        expect(eventFired).to.deep.equal(false, 'event fired');
    });
    test('Do not store global interpreter info in state store when resource is undefined and version is lower than one already in state', async () => {
        let eventFired = false;
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath, version: new SemVer('1.0.0') } as any;
        const interpreterInfoInState = { path: pythonPath, version: new SemVer('2.0.0') } as any;
        when(fs.fileExists(interpreterInfoInState.path)).thenResolve(true);
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        autoSelectionService.onDidChangeAutoSelectedInterpreter(() => (eventFired = true));
        when(state.value).thenReturn(interpreterInfoInState);
        when(workspaceService.getWorkspaceFolderIdentifier(undefined, anything())).thenReturn('');

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.storeAutoSelectedInterpreter(undefined, interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(undefined);

        verify(state.updateValue(anything())).never();
        expect(selectedInterpreter).to.deep.equal(interpreterInfoInState);
        expect(eventFired).to.deep.equal(false, 'event fired');
    });
    test('Store global interpreter info in state store when resource is undefined and version is higher than one already in state', async () => {
        let eventFired = false;
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath, version: new SemVer('3.0.0') } as any;
        const interpreterInfoInState = { path: pythonPath, version: new SemVer('2.0.0') } as any;
        when(fs.fileExists(interpreterInfoInState.path)).thenResolve(true);
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        autoSelectionService.onDidChangeAutoSelectedInterpreter(() => (eventFired = true));
        when(state.value).thenReturn(interpreterInfoInState);
        when(workspaceService.getWorkspaceFolderIdentifier(undefined, anything())).thenReturn('');

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.storeAutoSelectedInterpreter(undefined, interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(undefined);

        verify(state.updateValue(anything())).once();
        expect(selectedInterpreter).to.deep.equal(interpreterInfo);
        expect(eventFired).to.deep.equal(false, 'event fired');
    });
    test('Store global interpreter info in state store', async () => {
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        when(workspaceService.getWorkspaceFolderIdentifier(undefined, anything())).thenReturn('');

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.setGlobalInterpreter(interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(undefined);

        verify(state.updateValue(interpreterInfo)).once();
        expect(selectedInterpreter).to.deep.equal(interpreterInfo);
    });
    test('Store interpreter info in state store when resource is defined', async () => {
        let eventFired = false;
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        const resource = Uri.parse('one');
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        when(workspaceService.getWorkspaceFolder(resource)).thenReturn({ name: '', index: 0, uri: resource });
        autoSelectionService.onDidChangeAutoSelectedInterpreter(() => (eventFired = true));
        when(workspaceService.getWorkspaceFolderIdentifier(undefined, anything())).thenReturn('');

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.storeAutoSelectedInterpreter(resource, interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(resource);

        verify(state.updateValue(interpreterInfo)).never();
        expect(selectedInterpreter).to.deep.equal(interpreterInfo);
        expect(eventFired).to.deep.equal(false, 'event fired');
    });
    test('Storing workspace interpreter info in state store should fail', async () => {
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        const resource = Uri.parse('one');
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        when(workspaceService.getWorkspaceFolder(resource)).thenReturn({ name: '', index: 0, uri: resource });
        when(workspaceService.getWorkspaceFolderIdentifier(anything(), anything())).thenReturn('');

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.setWorkspaceInterpreter(resource, interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(resource);

        verify(state.updateValue(interpreterInfo)).never();
        expect(selectedInterpreter ? selectedInterpreter : undefined).to.deep.equal(undefined, 'not undefined');
    });
    test('Store workspace interpreter info in state store', async () => {
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        const resource = Uri.parse('one');
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        when(workspaceService.getWorkspaceFolder(resource)).thenReturn({ name: '', index: 0, uri: resource });
        when(workspaceService.getWorkspaceFolderIdentifier(anything(), anything())).thenReturn('');
        const deferred = createDeferred<void>();
        deferred.resolve();
        autoSelectionService.getAutoSelectedWorkspacePromises().set('', deferred);

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.setWorkspaceInterpreter(resource, interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(resource);

        verify(state.updateValue(interpreterInfo)).once();
        expect(selectedInterpreter).to.deep.equal(interpreterInfo);
    });
    test('Return undefined when we do not have a global value', async () => {
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        const resource = Uri.parse('one');
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        when(workspaceService.getWorkspaceFolder(resource)).thenReturn({ name: '', index: 0, uri: resource });
        when(workspaceService.getWorkspaceFolderIdentifier(undefined, anything())).thenReturn('');

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.storeAutoSelectedInterpreter(resource, interpreterInfo);
        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(undefined);

        verify(state.updateValue(interpreterInfo)).never();
        expect(selectedInterpreter === null || selectedInterpreter === undefined).to.equal(true, 'Should be undefined');
    });
    test('Return global value if we do not have a matching value for the resource', async () => {
        const pythonPath = 'Hello World';
        const interpreterInfo = { path: pythonPath } as any;
        const resource = Uri.parse('one');
        when(
            stateFactory.createGlobalPersistentState<PythonInterpreter | undefined>(
                preferredGlobalInterpreter,
                undefined
            )
        ).thenReturn(instance(state));
        const globalInterpreterInfo = { path: 'global Value' };
        when(state.value).thenReturn(globalInterpreterInfo as any);
        when(workspaceService.getWorkspaceFolderIdentifier(resource, anything())).thenReturn('1');
        const deferred = createDeferred<void>();
        deferred.resolve();
        autoSelectionService.getAutoSelectedWorkspacePromises().set('', deferred);

        await autoSelectionService.initializeStore(undefined);
        await autoSelectionService.storeAutoSelectedInterpreter(resource, interpreterInfo);

        const anotherResourceOfAnotherWorkspace = Uri.parse('Some other workspace');
        when(workspaceService.getWorkspaceFolderIdentifier(anotherResourceOfAnotherWorkspace, anything())).thenReturn(
            '2'
        );

        const selectedInterpreter = autoSelectionService.getAutoSelectedInterpreter(anotherResourceOfAnotherWorkspace);

        verify(state.updateValue(interpreterInfo)).never();
        expect(selectedInterpreter).to.deep.equal(globalInterpreterInfo);
    });
});
