// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as net from 'net';
import * as sinon from 'sinon';
import * as crypto from 'crypto';
import { OutputChannel, Uri } from 'vscode';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../client/common/process/types';
import { PythonTestServer } from '../../../client/testing/testController/common/server';
import { ITestDebugLauncher } from '../../../client/testing/common/types';
import { createDeferred } from '../../../client/common/utils/async';

suite('Python Test Server', () => {
    const fakeUuid = 'fake-uuid';

    let stubExecutionFactory: IPythonExecutionFactory;
    let stubExecutionService: IPythonExecutionService;
    let server: PythonTestServer;
    let sandbox: sinon.SinonSandbox;
    let execArgs: string[];
    let v4Stub: sinon.SinonStub;
    let debugLauncher: ITestDebugLauncher;

    setup(() => {
        sandbox = sinon.createSandbox();
        v4Stub = sandbox.stub(crypto, 'randomUUID');

        v4Stub.returns(fakeUuid);
        stubExecutionService = ({
            exec: (args: string[]) => {
                execArgs = args;
                return Promise.resolve({ stdout: '', stderr: '' });
            },
        } as unknown) as IPythonExecutionService;

        stubExecutionFactory = ({
            createActivatedEnvironment: () => Promise.resolve(stubExecutionService),
        } as unknown) as IPythonExecutionFactory;
    });

    teardown(() => {
        sandbox.restore();
        execArgs = [];
        server.dispose();
    });

    test('sendCommand should add the port to the command being sent', async () => {
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: fakeUuid,
        };

        server = new PythonTestServer(stubExecutionFactory, debugLauncher);
        await server.serverReady();

        await server.sendCommand(options);
        const port = server.getPort();

        assert.deepStrictEqual(execArgs, ['myscript', '--port', `${port}`, '--uuid', fakeUuid, '-foo', 'foo']);
    });

    test('sendCommand should write to an output channel if it is provided as an option', async () => {
        const output: string[] = [];
        const outChannel = {
            appendLine: (str: string) => {
                output.push(str);
            },
        } as OutputChannel;
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: fakeUuid,
            outChannel,
        };

        server = new PythonTestServer(stubExecutionFactory, debugLauncher);
        await server.serverReady();

        await server.sendCommand(options);

        const port = server.getPort();
        const expected = ['python', 'myscript', '--port', `${port}`, '--uuid', fakeUuid, '-foo', 'foo'].join(' ');

        assert.deepStrictEqual(output, [expected]);
    });

    test('If script execution fails during sendCommand, an onDataReceived event should be fired with the "error" status', async () => {
        let eventData: { status: string; errors: string[] };
        stubExecutionService = ({
            exec: () => {
                throw new Error('Failed to execute');
            },
        } as unknown) as IPythonExecutionService;

        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: fakeUuid,
        };

        server = new PythonTestServer(stubExecutionFactory, debugLauncher);
        await server.serverReady();

        server.onDataReceived(({ data }) => {
            eventData = JSON.parse(data);
        });

        await server.sendCommand(options);

        assert.deepStrictEqual(eventData!.status, 'error');
        assert.deepStrictEqual(eventData!.errors, ['Failed to execute']);
    });

    test('If the server receives malformed data, it should display a log message, and not fire an event', async () => {
        let eventData: string | undefined;
        const client = new net.Socket();
        const deferred = createDeferred();

        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: fakeUuid,
        };

        stubExecutionService = ({
            exec: async () => {
                client.connect(server.getPort());
                return Promise.resolve({ stdout: '', stderr: '' });
            },
        } as unknown) as IPythonExecutionService;

        server = new PythonTestServer(stubExecutionFactory, debugLauncher);
        await server.serverReady();
        server.onDataReceived(({ data }) => {
            eventData = data;
            deferred.resolve();
        });

        client.on('connect', () => {
            console.log('Socket connected, local port:', client.localPort);
            client.write('malformed data');
            client.end();
        });
        client.on('error', (error) => {
            console.log('Socket connection error:', error);
        });

        await server.sendCommand(options);
        await deferred.promise;
        assert.deepStrictEqual(eventData, '');
    });
});
