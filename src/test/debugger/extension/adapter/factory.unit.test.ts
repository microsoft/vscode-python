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
import { DebugAdapterExecutable, DebugAdapterServer, DebugConfiguration, DebugSession, WorkspaceFolder } from 'vscode';
import { ApplicationEnvironment } from '../../../../client/common/application/applicationEnvironment';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { CryptoUtils } from '../../../../client/common/crypto';
import { DebugAdapterNewPtvsd } from '../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../client/common/experiments';
import { HttpClient } from '../../../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IPythonSettings } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { IDebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/types';
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

    const nodeExecutable = { command: 'node', args: [] };
    const ptvsdAdapterPathWithWheels = path.join(
        EXTENSION_ROOT_DIR,
        'pythonFiles',
        'lib',
        'python',
        'debugpy',
        'wheels',
        'debugpy',
        'adapter'
    );
    const ptvsdAdapterPathWithoutWheels = path.join(
        EXTENSION_ROOT_DIR,
        'pythonFiles',
        'lib',
        'python',
        'debugpy',
        'no_wheels',
        'debugpy',
        'adapter'
    );
    const pythonPath = path.join('path', 'to', 'python', 'interpreter');
    const interpreter = {
        architecture: Architecture.Unknown,
        path: pythonPath,
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Unknown,
        version: new SemVer('3.7.4-test'),
    };
    const python36Path = path.join('path', 'to', 'active', 'interpreter');
    const interpreterPython36Details = {
        architecture: Architecture.Unknown,
        path: python36Path,
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Unknown,
        version: new SemVer('3.6.8-test'),
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
        when(configurationService.getSettings(undefined)).thenReturn(({
            experiments: { enabled: true },
            // tslint:disable-next-line: no-any
        } as any) as IPythonSettings);
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

    function createSession(config: Partial<DebugConfiguration>, workspaceFolder?: WorkspaceFolder): DebugSession {
        return {
            configuration: { name: '', request: 'launch', type: 'python', ...config },
            id: '',
            name: 'python',
            type: 'python',
            workspaceFolder,
            customRequest: () => Promise.resolve(),
        };
    }

    test('Return the value of configuration.pythonPath as the current python path if it exists and if we are in the experiment', async () => {
        const session = createSession({ pythonPath });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the active interpreter as the current python path if we are in the experiment, it exists and configuration.pythonPath is not defined', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the first available interpreter as the current python path if we are in the experiment, configuration.pythonPath is not defined and there is no active interpreter', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);

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

    test('Return Debug Adapter server if in DA experiment, request is "attach", and port is specified directly', async () => {
        const session = createSession({ request: 'attach', port: 5678, host: 'localhost' });
        const debugServer = new DebugAdapterServer(session.configuration.port, session.configuration.host);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        // Interpreter not needed for host/port
        verify(interpreterService.getInterpreters(anything())).never();
        assert.deepEqual(descriptor, debugServer);
    });

    test('Return Debug Adapter server if in DA experiment, request is "attach", and connect is specified', async () => {
        const session = createSession({ request: 'attach', connect: { port: 5678, host: 'localhost' } });
        const debugServer = new DebugAdapterServer(
            session.configuration.connect.port,
            session.configuration.connect.host
        );

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        // Interpreter not needed for connect
        verify(interpreterService.getInterpreters(anything())).never();
        assert.deepEqual(descriptor, debugServer);
    });

    test('Return Debug Adapter executable if in DA experiment, request is "attach", and listen is specified', async () => {
        const session = createSession({ request: 'attach', listen: { port: 5678, host: 'localhost' } });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);
        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Throw error if in DA experiment, request is "attach", and neither port, processId, listen, nor connect is specified', async () => {
        const session = createSession({
            request: 'attach',
            port: undefined,
            processId: undefined,
            listen: undefined,
            connect: undefined,
        });

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const promise = factory.createDebugAdapterDescriptor(session, nodeExecutable);

        await expect(promise).to.eventually.be.rejectedWith(
            '"request":"attach" requires either "connect", "listen", or "processId"'
        );
    });

    test('Return old node debugger when not in the experiment', async () => {
        const session = createSession({});
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, nodeExecutable);
    });

    test('Return Python debug adapter without wheels executable if configuration is attach, process ID is specified and active interpreter is not Python 3.7', async () => {
        const debugExecutable = new DebugAdapterExecutable(python36Path, [ptvsdAdapterPathWithoutWheels]);
        const session = createSession({ request: 'attach', processId: 1234 });

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreterPython36Details]);
        when(interpreterService.getInterpreterDetails(python36Path)).thenResolve(interpreterPython36Details);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return Python debug adapter without wheels executable when the active interpreter is not Python 3.7', async () => {
        const debugExecutable = new DebugAdapterExecutable(python36Path, [ptvsdAdapterPathWithoutWheels]);
        const session = createSession({});

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreterPython36Details]);
        when(interpreterService.getInterpreterDetails(python36Path)).thenResolve(interpreterPython36Details);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return Python debug adapter with wheels executable if configuration is attach, process ID is specified and active interpreter is Python 3.7', async () => {
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);
        const session = createSession({ request: 'attach', processId: 1234 });

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return Python debug adapter with wheels executable when in the experiment and with the active interpreter being Python 3.7', async () => {
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);
        const session = createSession({});

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Throw an error if the Node debugger adapter executable has not been defined', async () => {
        const session = createSession({});
        const promise = factory.createDebugAdapterDescriptor(session, undefined);

        await expect(promise).to.eventually.be.rejectedWith('Debug Adapter Executable not provided');
    });

    test('Pass the --log-dir argument to PTVSD if configuration.logToFile is set, with active interpreter Python 3.7', async () => {
        const session = createSession({ logToFile: true });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [
            ptvsdAdapterPathWithWheels,
            '--log-dir',
            EXTENSION_ROOT_DIR,
        ]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Pass the --log-dir argument to PTVSD if configuration.logToFile is set, with active interpreter not Python 3.7', async () => {
        const session = createSession({ logToFile: true });
        const debugExecutable = new DebugAdapterExecutable(python36Path, [
            ptvsdAdapterPathWithoutWheels,
            '--log-dir',
            EXTENSION_ROOT_DIR,
        ]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreterPython36Details]);
        when(interpreterService.getInterpreterDetails(python36Path)).thenResolve(interpreterPython36Details);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test("Don't pass the --log-dir argument to PTVSD if configuration.logToFile is not set, with active interpreter Python 3.7", async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test("Don't pass the --log-dir argument to PTVSD if configuration.logToFile is not set, with active interpreter not Python 3.7", async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(python36Path, [ptvsdAdapterPathWithoutWheels]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreterPython36Details]);
        when(interpreterService.getInterpreterDetails(python36Path)).thenResolve(interpreterPython36Details);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test("Don't pass the --log-dir argument to PTVSD if configuration.logToFile is set but false, with active interpreter Python 3.7", async () => {
        const session = createSession({ logToFile: false });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [ptvsdAdapterPathWithWheels]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test("Don't pass the --log-dir argument to PTVSD if configuration.logToFile is set but false, with active interpreter not Python 3.7", async () => {
        const session = createSession({ logToFile: false });
        const debugExecutable = new DebugAdapterExecutable(python36Path, [ptvsdAdapterPathWithoutWheels]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreterPython36Details]);
        when(interpreterService.getInterpreterDetails(python36Path)).thenResolve(interpreterPython36Details);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Send experiment group telemetry if inside the wheels experiment, with active interpreter Python 3.7', async () => {
        const session = createSession({});
        when(spiedInstance.userExperiments).thenReturn([
            { name: DebugAdapterNewPtvsd.experiment, salt: DebugAdapterNewPtvsd.experiment, min: 0, max: 0 },
        ]);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(Reporter.eventNames, [
            EventName.PYTHON_EXPERIMENTS,
            EventName.DEBUG_ADAPTER_USING_WHEELS_PATH,
        ]);
        assert.deepEqual(Reporter.properties, [{ expName: DebugAdapterNewPtvsd.experiment }, { usingWheels: 'true' }]);
    });

    test('Send experiment group telemetry if inside the wheels experiment, with active interpreter not Python 3.7', async () => {
        const session = createSession({});
        when(spiedInstance.userExperiments).thenReturn([
            { name: DebugAdapterNewPtvsd.experiment, salt: DebugAdapterNewPtvsd.experiment, min: 0, max: 0 },
        ]);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreterPython36Details]);
        when(interpreterService.getInterpreterDetails(python36Path)).thenResolve(interpreterPython36Details);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(Reporter.eventNames, [
            EventName.PYTHON_EXPERIMENTS,
            EventName.DEBUG_ADAPTER_USING_WHEELS_PATH,
        ]);
        assert.deepEqual(Reporter.properties, [{ expName: DebugAdapterNewPtvsd.experiment }, { usingWheels: 'false' }]);
    });

    test('Send attach to local process telemetry if inside the DA experiment and attaching to a local process', async () => {
        const session = createSession({ request: 'attach', processId: 1234 });
        when(spiedInstance.userExperiments).thenReturn([
            { name: DebugAdapterNewPtvsd.experiment, salt: DebugAdapterNewPtvsd.experiment, min: 0, max: 0 },
        ]);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.ok(Reporter.eventNames.includes(EventName.DEBUGGER_ATTACH_TO_LOCAL_PROCESS));
    });

    test('Send control group telemetry if inside the DA experiment control group', async () => {
        const session = createSession({});
        when(spiedInstance.userExperiments).thenReturn([
            { name: DebugAdapterNewPtvsd.control, salt: DebugAdapterNewPtvsd.control, min: 0, max: 0 },
        ]);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(Reporter.eventNames, [EventName.PYTHON_EXPERIMENTS]);
        assert.deepEqual(Reporter.properties, [{ expName: DebugAdapterNewPtvsd.control }]);
    });

    test("Don't send any telemetry if not inside the DA experiment nor control group", async () => {
        const session = createSession({});
        when(spiedInstance.userExperiments).thenReturn([]);

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(Reporter.eventNames, []);
        assert.deepEqual(Reporter.properties, []);
    });

    test('Use custom debug adapter path when specified', async () => {
        const customAdapterPath = 'custom/debug/adapter/path';
        const session = createSession({ debugAdapterPath: customAdapterPath });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [customAdapterPath]);

        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Expected remote arguments are returned if in DebugAdapterNewPtvsd experiment', async () => {
        const remoteDebugOptions = {
            waitUntilDebuggerAttaches: true,
            host: 'host',
            port: 999,
        };
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);

        // tslint:disable-next-line:no-any
        const args = factory.getRemoteDebuggerArgs(remoteDebugOptions as any);

        assert.deepEqual(args, [
            '--listen',
            `${remoteDebugOptions.host}:${remoteDebugOptions.port}`,
            '--wait-for-client',
        ]);
    });

    test('Expected remote arguments are returned if not in DebugAdapterNewPtvsd experiment', async () => {
        const remoteDebugOptions = {
            waitUntilDebuggerAttaches: true,
            host: 'host',
            port: 999,
        };
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(false);

        // tslint:disable-next-line:no-any
        const args = factory.getRemoteDebuggerArgs(remoteDebugOptions as any);

        assert.deepEqual(args, [
            '--host',
            remoteDebugOptions.host,
            '--port',
            remoteDebugOptions.port.toString(),
            '--wait',
        ]);
    });

    test('Wait args is empty if `waitUntilDebuggerAttaches` is set to false', async () => {
        const remoteDebugOptions = {
            waitUntilDebuggerAttaches: false,
            host: 'host',
            port: 999,
        };
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(false);

        // tslint:disable-next-line:no-any
        const args = factory.getRemoteDebuggerArgs(remoteDebugOptions as any);

        assert.deepEqual(args, ['--host', remoteDebugOptions.host, '--port', remoteDebugOptions.port.toString()]);
    });
});
