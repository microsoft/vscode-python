// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as net from 'net';
import * as sinon from 'sinon';
import * as crypto from 'crypto';
import { OutputChannel, Uri } from 'vscode';
import { IPythonExecutionFactory, IPythonExecutionService, SpawnOptions } from '../../../client/common/process/types';
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
    let spawnOptions: SpawnOptions;
    let v4Stub: sinon.SinonStub;
    let debugLauncher: ITestDebugLauncher;

    setup(() => {
        sandbox = sinon.createSandbox();
        v4Stub = sandbox.stub(crypto, 'randomUUID');

        v4Stub.returns(fakeUuid);
        stubExecutionService = ({
            exec: (args: string[], spawnOptionsProvided: SpawnOptions) => {
                execArgs = args;
                spawnOptions = spawnOptionsProvided;
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

    test('sendCommand should add the port to the command being sent and add the correct extra spawn variables', async () => {
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: fakeUuid,
        };
        const expectedSpawnOptions = {
            cwd: '/foo/bar',
            outputChannel: undefined,
            token: undefined,
            throwOnStdErr: true,
            extraVariables: { PYTHONPATH: '/foo/bar', RUN_TEST_IDS_PORT: '56789' },
        } as SpawnOptions;

        server = new PythonTestServer(stubExecutionFactory, debugLauncher);
        await server.serverReady();

        await server.sendCommand(options, '56789');
        const port = server.getPort();

        assert.deepStrictEqual(execArgs, ['myscript', '--port', `${port}`, '--uuid', fakeUuid, '-foo', 'foo']);
        assert.deepStrictEqual(spawnOptions, expectedSpawnOptions);
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

    test('If the server doesnt recognize the UUID it should ignore it', async () => {
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
            client.write('{"Request-uuid": "unknown-uuid"}');
            client.end();
        });
        client.on('error', (error) => {
            console.log('Socket connection error:', error);
        });

        await server.sendCommand(options);
        await deferred.promise;
        assert.deepStrictEqual(eventData, '');
    });

    // required to have "tests" or "results"
    // the heading length not being equal and yes being equal
    // multiple payloads
    test('Error if payload does not have a content length header', async () => {
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
            client.write('{"not content length": "5"}');
            client.end();
        });
        client.on('error', (error) => {
            console.log('Socket connection error:', error);
        });

        await server.sendCommand(options);
        await deferred.promise;
        assert.deepStrictEqual(eventData, '');
    });

    const testData = [
        {
            testName: 'fires discovery correctly on test payload',
            payload: `Content-Length: 52
Content-Type: application/json
Request-uuid: UUID_HERE

{"cwd": "path", "status": "success", "tests": "xyz"}`,
            expectedResult: '{"cwd": "path", "status": "success", "tests": "xyz"}',
        },
        // Add more test data as needed
    ];

    testData.forEach(({ testName, payload, expectedResult }) => {
        test(`test: ${testName}`, async () => {
            // Your test logic here
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
            const uuid = server.createUUID();
            payload = payload.replace('UUID_HERE', uuid);
            server.onDiscoveryDataReceived(({ data }) => {
                eventData = data;
                deferred.resolve();
            });

            client.on('connect', () => {
                console.log('Socket connected, local port:', client.localPort);
                client.write(payload);
                client.end();
            });
            client.on('error', (error) => {
                console.log('Socket connection error:', error);
            });

            await server.sendCommand(options);
            await deferred.promise;
            assert.deepStrictEqual(eventData, expectedResult);
        });
    });

    test('Calls run resolver if the result header is in the payload', async () => {
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
        const uuid = server.createUUID();
        server.onRunDataReceived(({ data }) => {
            eventData = data;
            deferred.resolve();
        });

        const payload = `Content-Length: 87
Content-Type: application/json
Request-uuid: ${uuid}

{"cwd": "path", "status": "success", "result": "xyz", "not_found": null, "error": null}`;

        client.on('connect', () => {
            console.log('Socket connected, local port:', client.localPort);
            client.write(payload);
            client.end();
        });
        client.on('error', (error) => {
            console.log('Socket connection error:', error);
        });

        await server.sendCommand(options);
        await deferred.promise;
        console.log('event data', eventData);
        const expectedResult =
            '{"cwd": "path", "status": "success", "result": "xyz", "not_found": null, "error": null}';
        assert.deepStrictEqual(eventData, expectedResult);
    });
});
