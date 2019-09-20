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
import { IPythonExecutionFactory } from '../../../../client/common/process/types';
import { IExperimentsManager, IExtensions, IPersistentState, IPersistentStateFactory } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { DebugAdapterDescriptorFactory, ptvsdPathStorageKey } from '../../../../client/debugger/extension/adapter/factory';
import { DebugAdapterPtvsdPathInfo, IDebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/types';
import { IInterpreterService, InterpreterType } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';

use(chaiAsPromised);

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Adapter Factory', () => {
    let factory: IDebugAdapterDescriptorFactory;
    let interpreterService: IInterpreterService;
    let appShell: IApplicationShell;
    let experimentsManager: IExperimentsManager;
    let executionFactory: IPythonExecutionFactory;
    let stateFactory: IPersistentStateFactory;
    let debugAdapterPersistentState: IPersistentState<DebugAdapterPtvsdPathInfo | undefined>;
    let extensions: IExtensions;

    const nodeExecutable = { command: 'node', args: [] };
    const mockExtensionVersion = new SemVer('2019.9.0');
    const ptvsdPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');
    const pythonPath = path.join('path', 'to', 'python', 'interpreter');
    const interpreter = {
        architecture: Architecture.Unknown,
        path: pythonPath,
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Unknown,
        version: new SemVer('3.7.4-test')
    };

    setup(() => {
        interpreterService = mock(InterpreterService);
        appShell = mock(ApplicationShell);
        experimentsManager = mock(ExperimentsManager);
        executionFactory = mock(PythonExecutionFactory);
        stateFactory = mock(PersistentStateFactory);
        debugAdapterPersistentState = mock(PersistentState);
        extensions = mock(Extensions);

        // tslint:disable-next-line: no-any
        when(extensions.getExtension(anything())).thenReturn({ packageJSON: { version: mockExtensionVersion } } as any);
        when(interpreterService.getInterpreterDetails(pythonPath)).thenResolve(interpreter);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreter]);

        factory = new DebugAdapterDescriptorFactory(
            instance(interpreterService),
            instance(appShell),
            instance(experimentsManager),
            instance(executionFactory),
            instance(stateFactory),
            instance(extensions)
        );
    });

    function mockPtvsdInfoPersistentState(sameVersion: boolean) {
        const debugAdapterInfo: DebugAdapterPtvsdPathInfo = { extensionVersion: sameVersion ? mockExtensionVersion.raw : '2019.10.0-dev', ptvsdPath };

        when(stateFactory.createGlobalPersistentState<DebugAdapterPtvsdPathInfo | undefined>(ptvsdPathStorageKey, undefined)).thenReturn(instance(debugAdapterPersistentState));
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
        const session = createSession({ pythonPath });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the active interpreter as the current python path if we are in the experiment, it exists and configuration.pythonPath is not defined', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the first available interpreter as the current python path if we are in the experiment, configuration.pythonPath is not defined and there is no active interpreter', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
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
        const python36Path = path.join('path', 'to', 'active', 'interpreter');
        const interpreterPython36Details = {
            architecture: Architecture.Unknown,
            path: pythonPath,
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Unknown,
            version: new SemVer('3.6.8-test')
        };
        const session = createSession({});

        when(interpreterService.getInterpreterDetails(python36Path)).thenResolve(interpreterPython36Details);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });

    test('Return Python debug adapter executable when in the experiment and with the active interpreter being Python 3.7', async () => {
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);
        const session = createSession({});

        mockPtvsdInfoPersistentState(true);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Throw an error if the Node debugger adapter executable has not been defined', async () => {
        const session = createSession({});
        const promise = factory.createDebugAdapterDescriptor(session, undefined);

        await expect(promise).to.eventually.be.rejectedWith('Debug Adapter Executable not provided');
    });

    test('Save the PTVSD path in persistent storage if it doesn\'t exist in the cache', async () => {
        const persistentPtvsdPath = path.join('persistent', 'ptvsd', 'path');
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(persistentPtvsdPath, 'ptvsd', 'adapter')]);
        const session = createSession({});
        let execCalled = false;

        when(stateFactory.createGlobalPersistentState<DebugAdapterPtvsdPathInfo | undefined>(ptvsdPathStorageKey, undefined)).thenReturn(instance(debugAdapterPersistentState));
        when(debugAdapterPersistentState.value).thenReturn(undefined);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const pythonExecService = ({
            exec: () => {
                execCalled = true;
                return Promise.resolve({ stdout: persistentPtvsdPath });
            }
            // tslint:disable-next-line: no-any
        } as any) as PythonExecutionService;
        when(executionFactory.create(anything())).thenResolve(pythonExecService);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
        assert.equal(execCalled, true);
        verify(executionFactory.create(anything())).once();
        verify(debugAdapterPersistentState.updateValue(anything())).once();
    });

    test('Save the PTVSD path in persistent storage if the extension version in the cache is different from the actual one', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);
        let execCalled = false;

        mockPtvsdInfoPersistentState(false);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const pythonExecService = ({
            exec: () => {
                execCalled = true;
                return Promise.resolve({ stdout: ptvsdPath });
            }
            // tslint:disable-next-line: no-any
        } as any) as PythonExecutionService;
        when(executionFactory.create(anything())).thenResolve(pythonExecService);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
        assert.equal(execCalled, true);
        verify(executionFactory.create(anything())).once();
        verify(debugAdapterPersistentState.updateValue(anything())).once();
    });

    test('Use the cached path to PTVSD if it exists and the extension version hasn\'t changed since the value was saved', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);
        let execCalled = false;

        mockPtvsdInfoPersistentState(true);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const pythonExecService = ({
            exec: () => {
                execCalled = true;
                return Promise.resolve({ stdout: ptvsdPath });
            }
            // tslint:disable-next-line: no-any
        } as any) as PythonExecutionService;
        when(executionFactory.create(anything())).thenResolve(pythonExecService);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
        assert.equal(execCalled, false);
        verify(executionFactory.create(anything())).never();
        verify(debugAdapterPersistentState.updateValue(anything())).never();
        verify(debugAdapterPersistentState.value).thrice();
    });

    test('Pass the --log-dir argument to PTVSD is configuration.logToFile is set', async () => {
        const session = createSession({ logToFile: true });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter'), '--log-dir', EXTENSION_ROOT_DIR]);

        mockPtvsdInfoPersistentState(true);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Don\'t pass the --log-dir argument to PTVSD is configuration.logToFile is not set', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Don\'t pass the --log-dir argument to PTVSD is configuration.logToFile is set but false', async () => {
        const session = createSession({ logToFile: false });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(experimentsManager.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });
});
