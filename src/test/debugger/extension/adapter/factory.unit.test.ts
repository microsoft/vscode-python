// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { SemVer } from 'semver';
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';
import { DebugAdapterExecutable, DebugConfiguration, DebugSession, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { Extensions } from '../../../../client/common/application/extensions';
import { IApplicationShell } from '../../../../client/common/application/types';
import { DebugAdapterNewPtvsd } from '../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../client/common/experiments';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { PythonExecutionFactory } from '../../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../../client/common/process/pythonProcess';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../../client/common/process/types';
import { IExperimentsManager, IExtensions, IPersistentState, IPersistentStateFactory } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { DebugAdapterDescriptorFactory, ptvsdPathStorageKey } from '../../../../client/debugger/extension/adapter/factory';
import { DebugAdapterPtvsdPathInfo, IDebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/types';
import { IInterpreterService, InterpreterType } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';

use(chaiAsPromised);

// tslint:disable: no-any
// tslint:disable-next-line: max-func-body-length
suite('Debugging - Adapter Factory', () => {
    let factory: IDebugAdapterDescriptorFactory;
    let interpreterService: IInterpreterService;
    let appShell: IApplicationShell;
    let experimentsManager: IExperimentsManager;
    let executionFactory: IPythonExecutionFactory;
    let pythonProcess: IPythonExecutionService;
    let stateFactory: IPersistentStateFactory;
    let debugAdapterPersistentState: IPersistentState<DebugAdapterPtvsdPathInfo>;
    let extensions: IExtensions;
    const nodeExecutable = { command: 'node', args: [] };
    const mockExtensionVersion = new SemVer('2019.9.0');

    setup(() => {
        interpreterService = mock(InterpreterService);
        appShell = mock(ApplicationShell);
        appShell = mock(ApplicationShell);
        experimentsManager = mock(ExperimentsManager);
        executionFactory = mock(PythonExecutionFactory);
        pythonProcess = mock(PythonExecutionService);
        stateFactory = mock(PersistentStateFactory);
        debugAdapterPersistentState = mock(PersistentState);
        extensions = mock(Extensions);

        const interpreter = {
            architecture: Architecture.Unknown,
            path: path.join('path', 'to', 'active', 'interpreter'),
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown
        };

        when(interpreterService.getInterpreters(anything())).thenResolve([interpreter]);
        when(executionFactory.create(anything())).thenResolve(instance(pythonProcess));
        when(extensions.getExtension(anything())).thenReturn({ packageJSON: { version: mockExtensionVersion } } as any);

        factory = new DebugAdapterDescriptorFactory(
            instance(interpreterService),
            instance(appShell),
            instance(experimentsManager),
            instance(executionFactory),
            instance(stateFactory),
            instance(extensions)
        );
    });

    function mockPtvsdInfoPersistentState(sameVersion: boolean, ptvsdPath: string) {
        const debugAdapterInfo: DebugAdapterPtvsdPathInfo = { extensionVersion: sameVersion ? mockExtensionVersion.raw : '2019.10.0-dev', ptvsdPath };

        when(stateFactory.createGlobalPersistentState<DebugAdapterPtvsdPathInfo>(ptvsdPathStorageKey, undefined)).thenReturn(instance(debugAdapterPersistentState));
        when(debugAdapterPersistentState.value).thenReturn(debugAdapterInfo);
    }

    function createSession(config: Partial<DebugConfiguration>, workspaceFolder?: WorkspaceFolder): DebugSession {
        return {
            configuration: { name: '', request: 'launch', type: 'python', ...config },
            id: '',
            name: 'python',
            type: 'python',
            workspaceFolder,
            customRequest: () => Promise.resolve()
        };
    }

    test('Return the value of configuration.pythonPath as the current python path if it exists and if we are in the experiment', async () => {
        const ptvsdPath = path.join('path', 'to', 'ptvsd');
        const pythonPath = path.join('session', 'path', 'to', 'python');
        const session = createSession({ pythonPath });
        const interpreterDetails = {
            architecture: Architecture.Unknown,
            path: pythonPath,
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown,
            version: new SemVer('3.7.4-test')
        };
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true, ptvsdPath);
        when(interpreterService.getInterpreterDetails(pythonPath)).thenResolve(interpreterDetails);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the active interpreter as the current python path if we are in the experiment, it exists and configuration.pythonPath is not defined', async () => {
        const ptvsdPath = path.join('path', 'to', 'ptvsd');
        const pythonPath = path.join('active', 'python', 'interpreter');
        const session = createSession({});
        const interpreterDetails = {
            architecture: Architecture.Unknown,
            path: pythonPath,
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown,
            version: new SemVer('3.7.4-test')
        };
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true, ptvsdPath);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreterDetails);
        when(interpreterService.getInterpreterDetails(pythonPath)).thenResolve(interpreterDetails);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the first available interpreter as the current python path if we are in the experiment, configuration.pythonPath is not defined and there is no active interpreter', async () => {
        const ptvsdPath = path.join('path', 'to', 'ptvsd');
        const pythonPath = path.join('first', 'available', 'interpreter');
        const session = createSession({});
        const interpreterDetails = {
            architecture: Architecture.Unknown,
            path: pythonPath,
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown,
            version: new SemVer('3.7.4-test')
        };
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true, ptvsdPath);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreterDetails]);
        when(interpreterService.getInterpreterDetails(pythonPath)).thenResolve(interpreterDetails);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Display a message if no python interpreter is set and we are in the experiment', async () => {
        when(interpreterService.getInterpreters(anything())).thenResolve([]);
        const session = createSession({});
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        verify(appShell.showErrorMessage(anyString())).once();
        assert.deepEqual(descriptor, nodeExecutable);
    });

    test('Return old node debugger when not in the experiment', async () => {
        const session = createSession({});
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });

    test('Return old node debugger when the active interpreter is not Python 3.7', async () => {
        const pythonPath = path.join('path', 'to', 'active', 'interpreter');
        const interpreterDetails = {
            architecture: Architecture.Unknown,
            path: pythonPath,
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown,
            version: new SemVer('3.6.8-test')
        };
        const session = createSession({});

        when(interpreterService.getInterpreterDetails(pythonPath)).thenResolve(interpreterDetails);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });

    test('Return Python debug adapter executable when in the experiment and with the active interpreter being Python 3.7', async () => {
        const ptvsdPath = path.join('path', 'to', 'ptvsd');
        const pythonPath = path.join('path', 'to', 'active', 'interpreter');
        const interpreterDetails = {
            architecture: Architecture.Unknown,
            path: pythonPath,
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown,
            version: { raw: '3.7.4', major: 3, minor: 7, build: ['foo'], patch: 0, prerelease: ['bar'] }
        };
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);
        const session = createSession({});

        mockPtvsdInfoPersistentState(true, ptvsdPath);
        when(interpreterService.getInterpreterDetails(pythonPath)).thenResolve(interpreterDetails);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Throw an error if the Node debugger adapter executable has not been defined', async () => {
        const session = createSession({});
        const promise = factory.createDebugAdapterDescriptor(session, undefined);

        await expect(promise).to.eventually.be.rejectedWith('Debug Adapter Executable not provided');
    });
});
