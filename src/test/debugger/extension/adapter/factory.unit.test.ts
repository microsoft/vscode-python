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
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';
import { DebugAdapterExecutable, DebugAdapterServer, DebugConfiguration, DebugSession, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IPythonSettings } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { IDebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/types';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { EnvironmentType } from '../../../../client/pythonEnvironments/info';
import { clearTelemetryReporter } from '../../../../client/telemetry';
import { EventName } from '../../../../client/telemetry/constants';

use(chaiAsPromised);

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Adapter Factory', () => {
    let factory: IDebugAdapterDescriptorFactory;
    let interpreterService: IInterpreterService;
    let appShell: IApplicationShell;

    const nodeExecutable = undefined;
    const debugAdapterPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'debugpy', 'adapter');
    const pythonPath = path.join('path', 'to', 'python', 'interpreter');
    const interpreter = {
        architecture: Architecture.Unknown,
        path: pythonPath,
        sysPrefix: '',
        sysVersion: '',
        envType: EnvironmentType.Unknown,
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

        const configurationService = mock(ConfigurationService);
        when(configurationService.getSettings(undefined)).thenReturn(({
            experiments: { enabled: true }
            // tslint:disable-next-line: no-any
        } as any) as IPythonSettings);

        interpreterService = mock(InterpreterService);
        appShell = mock(ApplicationShell);

        when(interpreterService.getInterpreterDetails(pythonPath)).thenResolve(interpreter);
        when(interpreterService.getInterpreters(anything())).thenResolve([interpreter]);

        factory = new DebugAdapterDescriptorFactory(instance(interpreterService), instance(appShell));
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
            customRequest: () => Promise.resolve()
        };
    }

    test('Return the value of configuration.pythonPath as the current python path if it exists', async () => {
        const session = createSession({ pythonPath });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [debugAdapterPath]);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the active interpreter as the current python path, it exists and configuration.pythonPath is not defined', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [debugAdapterPath]);

        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Return the path of the first available interpreter as the current python path, configuration.pythonPath is not defined and there is no active interpreter', async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [debugAdapterPath]);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Display a message if no python interpreter is set', async () => {
        when(interpreterService.getInterpreters(anything())).thenResolve([]);
        const session = createSession({});

        const promise = factory.createDebugAdapterDescriptor(session, nodeExecutable);

        await expect(promise).to.eventually.be.rejectedWith('Debug Adapter Executable not provided');
        verify(appShell.showErrorMessage(anyString())).once();
    });

    test('Return Debug Adapter server if request is "attach", and port is specified directly', async () => {
        const session = createSession({ request: 'attach', port: 5678, host: 'localhost' });
        const debugServer = new DebugAdapterServer(session.configuration.port, session.configuration.host);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        // Interpreter not needed for host/port
        verify(interpreterService.getInterpreters(anything())).never();
        assert.deepEqual(descriptor, debugServer);
    });

    test('Return Debug Adapter server if request is "attach", and connect is specified', async () => {
        const session = createSession({ request: 'attach', connect: { port: 5678, host: 'localhost' } });
        const debugServer = new DebugAdapterServer(
            session.configuration.connect.port,
            session.configuration.connect.host
        );

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        // Interpreter not needed for connect
        verify(interpreterService.getInterpreters(anything())).never();
        assert.deepEqual(descriptor, debugServer);
    });

    test('Return Debug Adapter executable if request is "attach", and listen is specified', async () => {
        const session = createSession({ request: 'attach', listen: { port: 5678, host: 'localhost' } });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [debugAdapterPath]);

        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);
        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Throw error if request is "attach", and neither port, processId, listen, nor connect is specified', async () => {
        const session = createSession({
            request: 'attach',
            port: undefined,
            processId: undefined,
            listen: undefined,
            connect: undefined
        });

        const promise = factory.createDebugAdapterDescriptor(session, nodeExecutable);

        await expect(promise).to.eventually.be.rejectedWith(
            '"request":"attach" requires either "connect", "listen", or "processId"'
        );
    });

    test('Pass the --log-dir argument to debug adapter if configuration.logToFile is set', async () => {
        const session = createSession({ logToFile: true });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [
            debugAdapterPath,
            '--log-dir',
            EXTENSION_ROOT_DIR
        ]);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test("Don't pass the --log-dir argument to debug adapter if configuration.logToFile is not set", async () => {
        const session = createSession({});
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [debugAdapterPath]);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test("Don't pass the --log-dir argument to debugger if configuration.logToFile is set to false", async () => {
        const session = createSession({ logToFile: false });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [debugAdapterPath]);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });

    test('Send attach to local process telemetry if attaching to a local process', async () => {
        const session = createSession({ request: 'attach', processId: 1234 });
        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.ok(Reporter.eventNames.includes(EventName.DEBUGGER_ATTACH_TO_LOCAL_PROCESS));
    });

    test("Don't send any telemetry if not attaching to a local process", async () => {
        const session = createSession({});

        await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.ok(Reporter.eventNames.includes(EventName.DEBUG_ADAPTER_USING_WHEELS_PATH));
    });

    test('Use custom debug adapter path when specified', async () => {
        const customAdapterPath = 'custom/debug/adapter/path';
        const session = createSession({ debugAdapterPath: customAdapterPath });
        const debugExecutable = new DebugAdapterExecutable(pythonPath, [customAdapterPath]);

        const descriptor = await factory.createDebugAdapterDescriptor(session, nodeExecutable);

        assert.deepEqual(descriptor, debugExecutable);
    });
});
