// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as http from 'http';
import * as sinon from 'sinon';
import * as crypto from 'crypto';
import { OutputChannel, Uri } from 'vscode';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../client/common/process/types';
import { createDeferred } from '../../../client/common/utils/async';
import { PythonTestServer } from '../../../client/testing/testController/common/server';
import * as logging from '../../../client/logging';
import { ITestDebugLauncher } from '../../../client/testing/common/types';

suite('Python Test Server', () => {
    const fakeUuid = 'fake-uuid';

    let stubExecutionFactory: IPythonExecutionFactory;
    let stubExecutionService: IPythonExecutionService;
    let server: PythonTestServer;
    let sandbox: sinon.SinonSandbox;
    let execArgs: string[];
    let v4Stub: sinon.SinonStub;
    let traceLogStub: sinon.SinonStub;
    let debugLauncher: ITestDebugLauncher;

    setup(() => {
        sandbox = sinon.createSandbox();
        v4Stub = sandbox.stub(crypto, 'randomUUID');
        traceLogStub = sandbox.stub(logging, 'traceLog');

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
        const deferred = createDeferred();
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: fakeUuid,
        };

        let response;

        server = new PythonTestServer(stubExecutionFactory, debugLauncher);
        await server.serverReady();

        server.onDataReceived(({ data }) => {
            response = data;
            deferred.resolve();
        });

        await server.sendCommand(options);

        // Send data back.
        const port = server.getPort();
        const requestOptions = {
            hostname: 'localhost',
            method: 'POST',
            port,
            headers: { 'Request-uuid': fakeUuid },
        };

        const request = http.request(requestOptions, (res) => {
            res.setEncoding('utf8');
        });
        const postData = '[test';
        request.write(postData);
        request.end();

        await deferred.promise;

        sinon.assert.calledOnce(traceLogStub);
        assert.deepStrictEqual(response, '');
    });
});
