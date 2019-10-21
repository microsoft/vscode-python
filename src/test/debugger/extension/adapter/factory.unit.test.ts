// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
// tslint:disable-next-line: match-default-export-name
import rewiremock from 'rewiremock';
import { SemVer } from 'semver';
import { anyString, anything, instance, mock, spy, verify, when } from 'ts-mockito';
import { DebugAdapterExecutable, DebugConfiguration, DebugSession, WorkspaceFolder, DebugAdapterServer } from 'vscode';
import { ApplicationEnvironment } from '../../../../client/common/application/applicationEnvironment';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { Extensions } from '../../../../client/common/application/extensions';
import { IApplicationShell } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { CryptoUtils } from '../../../../client/common/crypto';
import { DebugAdapterNewPtvsd } from '../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../client/common/experiments';
import { HttpClient } from '../../../../client/common/net/httpClient';
import { PersistentState, PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { PythonExecutionFactory } from '../../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../../client/common/process/pythonProcess';
import { IPythonExecutionFactory } from '../../../../client/common/process/types';
import { IExtensions, IPersistentState, IPersistentStateFactory, IPythonSettings } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { DebugAdapterDescriptorFactory, ptvsdPathStorageKey } from '../../../../client/debugger/extension/adapter/factory';
import { DebugAdapterPtvsdPathInfo, IDebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/types';
import { IInterpreterService, InterpreterType } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { clearTelemetryReporter } from '../../../../client/telemetry';
import { EventName } from '../../../../client/telemetry/constants';
import { MockOutputChannel } from '../../../mockClasses';

use(chaiAsPromised);

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Adapter Factory', () => {
    let factory: IDebugAdapterDescriptorFactory;
    let interpreterService: IInterpreterService;
    let appShell: IApplicationShell;
    let experimentsManager: ExperimentsManager;
    let spiedInstance: ExperimentsManager;
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
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;

    class Reporter {
        public static eventNames: string[] = [];
        public static properties: Record<string, string>[] = [];
        public static measures: {}[] = [];
        public sendTelemetryEvent(eventName: string, properties?: {}, measures?: {}) {
            Reporter.eventNames.push(eventName);
            Reporter.properties.push(properties!);
            Reporter.measures.push(measures!);
        }
    }

    setup(() => {
        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const workspaceService = mock(WorkspaceService);
        const httpClient = mock(HttpClient);
        const crypto = mock(CryptoUtils);
        const appEnvironment = mock(ApplicationEnvironment);
        const persistentStateFactory = mock(PersistentStateFactory);
        const output = mock(MockOutputChannel);
        const configurationService = mock(ConfigurationService);
        const fs = mock(FileSystem);
        // tslint:disable-next-line: no-any
        when(configurationService.getSettings(undefined)).thenReturn(({ experiments: { enabled: true } } as any) as IPythonSettings);
        experimentsManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            instance(output),
            instance(fs),
            instance(configurationService)
        );
        spiedInstance = spy(experimentsManager);

        interpreterService = mock(InterpreterService);
        appShell = mock(ApplicationShell);
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
            experimentsManager
        );
    });

    teardown(() => {
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
        Reporter.properties = [];
        Reporter.eventNames = [];
        Reporter.measures = [];
        rewiremock.disable();
        clearTelemetryReporter();
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
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'lib', 'python', 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the active interpreter as the current python path if we are in the experiment, it exists and configuration.pythonPath is not defined', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'lib', 'python', 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the first available interpreter as the current python path if we are in the experiment, configuration.pythonPath is not defined and there is no active interpreter', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'lib', 'python', 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Display a message if no python interpreter is set and we are in the experiment', async () => {
        when(interpreterService.getInterpreters(anything())).thenResolve([]);
        const session = createSession({});

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        verify(appShell.showErrorMessage(anyString())).once();
        assert.deepEqual(descriptor, nodeExecutable);
    });

    test('Return Debug Adapter server if attach configuration and we are in experiment', async () => {
        const session = createSession({ request: 'attach', port: 5678, host: 'localhost' });
        const debugServer = new DebugAdapterServer(session.configuration.port, session.configuration.host);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        // Interpreter not needed for attach
        verify(interpreterService.getInterpreters(anything())).never()
        assert.deepEqual(descriptor, debugServer);
    });

    test('Throw error if configuration is attach and in experiment and port is 0', async () => {
        const session = createSession({ request: 'attach', port: 0, host: 'localhost' });

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const promise = factory.createDebugAdapterDescriptor(session, nodeExecutable);

        await expect(promise).to.eventually.be.rejectedWith('Port must be specified for request type attach');
    });

    test('Throw error if configuration is attach and in experiment and port is not specified', async () => {
        const session = createSession({ request: 'attach', port: undefined });

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const promise = factory.createDebugAdapterDescriptor(session, nodeExecutable);

        await expect(promise).to.eventually.be.rejectedWith('Port must be specified for request type attach');
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
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'lib', 'python', 'ptvsd', 'adapter')]);
        const session = createSession({});

        mockPtvsdInfoPersistentState(true);
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Throw an error if the Node debugger adapter executable has not been defined', async () => {
        const session = createSession({});
        const promise = factory.createDebugAdapterDescriptor(session, undefined);

        await expect(promise).to.eventually.be.rejectedWith('Debug Adapter Executable not provided');
    });

    test('Pass the --log-dir argument to PTVSD is configuration.logToFile is set', async () => {
        const session = createSession({ logToFile: true });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'lib', 'python', 'ptvsd', 'adapter'), '--log-dir', EXTENSION_ROOT_DIR]);

        mockPtvsdInfoPersistentState(true);
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Don\'t pass the --log-dir argument to PTVSD is configuration.logToFile is not set', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'lib', 'python', 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Don\'t pass the --log-dir argument to PTVSD is configuration.logToFile is set but false', async () => {
        const session = createSession({ logToFile: false });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [path.join(ptvsdPath, 'lib', 'python', 'ptvsd', 'adapter')]);

        mockPtvsdInfoPersistentState(true);
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Send experiment group telemetry if inside the wheels experiment', async () => {
        const session = createSession({});
        when(spiedInstance.userExperiments).thenReturn([{ name: DebugAdapterNewPtvsd.experiment, salt: DebugAdapterNewPtvsd.experiment, min: 0, max: 0 }]);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(Reporter.eventNames, [EventName.PYTHON_EXPERIMENTS]);
        assert.deepEqual(Reporter.properties, [{ expName: DebugAdapterNewPtvsd.experiment }]);
    });

    test('Send control group telemetry if inside the DA experiment control group', async () => {
        const session = createSession({});
        when(spiedInstance.userExperiments).thenReturn([{ name: DebugAdapterNewPtvsd.control, salt: DebugAdapterNewPtvsd.control, min: 0, max: 0 }]);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(Reporter.eventNames, [EventName.PYTHON_EXPERIMENTS]);
        assert.deepEqual(Reporter.properties, [{ expName: DebugAdapterNewPtvsd.control }]);
    });

    test('Don\'t send any telemetry if not inside the DA experiment nor control group', async () => {
        const session = createSession({});
        when(spiedInstance.userExperiments).thenReturn([]);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(Reporter.eventNames, []);
        assert.deepEqual(Reporter.properties, []);
    });
});
