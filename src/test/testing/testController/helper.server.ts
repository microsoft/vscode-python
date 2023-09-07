// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as assert from 'assert';
import * as net from 'net';
import * as sinon from 'sinon';
import * as crypto from 'crypto';
import { Observable } from 'rxjs';
import * as typeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IPythonExecutionFactory, IPythonExecutionService, Output } from '../../../client/common/process/types';
import { PythonTestServer } from '../../../client/testing/testController/common/server';
import { ITestDebugLauncher } from '../../../client/testing/common/types';
import { Deferred, createDeferred } from '../../../client/common/utils/async';
import { MockChildProcess } from '../../mocks/mockChildProcess';
import { PAYLOAD_MULTI_CHUNK, PAYLOAD_SINGLE_CHUNK, PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY } from './payloadTestCases';

suite('Python Test Server', () => {
    const FAKE_UUID = 'fake-uuid';
    let server: PythonTestServer;
    let v4Stub: sinon.SinonStub;
    let debugLauncher: ITestDebugLauncher;
    let mockProc: MockChildProcess;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    const sandbox = sinon.createSandbox();

    setup(async () => {
        // set up test command options

        v4Stub = sandbox.stub(crypto, 'randomUUID');
        v4Stub.returns(FAKE_UUID);

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        const outputObservable = new Observable<Output<string>>(() => {
            /* no op */
        });
        execService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                proc: mockProc,
                out: outputObservable,
                dispose: () => {
                    /* no-body */
                },
            }));
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
    });

    teardown(() => {
        sandbox.restore();
        server.dispose();
    });
    test('basic payload', async () => {
        let eventData = '';
        const client = new net.Socket();

        deferred = createDeferred();
        mockProc = new MockChildProcess('', ['']);
        const output2 = new Observable<Output<string>>(() => {
            /* no op */
        });
        const stubExecutionService2 = ({
            execObservable: () => {
                client.connect(server.getPort());
                return {
                    proc: mockProc,
                    out: output2,
                    dispose: () => {
                        /* no-body */
                    },
                };
            },
        } as unknown) as IPythonExecutionService;

        const stubExecutionFactory2 = ({
            createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
        } as unknown) as IPythonExecutionFactory;
        server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
        const uuid = server.createUUID();
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid,
        };

        const dataWithPayloadChunks = PAYLOAD_SINGLE_CHUNK(uuid);

        await server.serverReady();

        server.onRunDataReceived(({ data }) => {
            eventData = eventData + data;
            deferred.resolve();
        });
        client.on('connect', () => {
            console.log('Socket connected, local port:', client.localPort);
            // since this test is a single payload as a single chunk there should be a single line in the payload.
            for (const line of dataWithPayloadChunks.payloadArray) {
                client.write(line);
            }
            client.end();
        });
        client.on('error', (error) => {
            console.log('Socket connection error:', error);
        });

        server.sendCommand(options);
        await deferred.promise;
        const expectedResult = dataWithPayloadChunks.data;
        assert.deepStrictEqual(eventData, expectedResult);
    });
    test('second payload', async () => {
        let eventData = '';
        const client = new net.Socket();

        deferred = createDeferred();
        mockProc = new MockChildProcess('', ['']);
        const output2 = new Observable<Output<string>>(() => {
            /* no op */
        });
        const stubExecutionService2 = ({
            execObservable: () => {
                client.connect(server.getPort());
                return {
                    proc: mockProc,
                    out: output2,
                    dispose: () => {
                        /* no-body */
                    },
                };
            },
        } as unknown) as IPythonExecutionService;

        const stubExecutionFactory2 = ({
            createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
        } as unknown) as IPythonExecutionFactory;
        server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
        const uuid = server.createUUID();
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid,
        };
        const payloadChunk = PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY(uuid);

        await server.serverReady();

        server.onRunDataReceived(({ data }) => {
            eventData = eventData + data;
        });
        client.on('connect', () => {
            console.log('Socket connected, local port:', client.localPort);
            for (const line of payloadChunk.payloadArray) {
                client.write(line);
            }
            client.end();
        });
        client.on('close', () => {
            console.log('Socket connection exit:');
            deferred.resolve();
        });
        client.on('error', (error) => {
            console.log('Socket connection error:', error);
        });

        server.sendCommand(options);
        await deferred.promise;
        const expectedResult = payloadChunk.data;
        assert.deepStrictEqual(eventData, expectedResult);
    });

    // test('sendCommand should add the port to the command being sent and add the correct extra spawn variables', async () => {
    //     deferred2 = createDeferred();
    //     execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    //     execFactory
    //         .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
    //         .returns(() => {
    //             deferred2.resolve();
    //             return Promise.resolve(execService.object);
    //         });
    //     server = new PythonTestServer(execFactory.object, debugLauncher);
    //     await server.serverReady();
    //     server.sendCommand(BASE_TEST_COMMAND_OPTIONS, '56789');
    //     // add in await and trigger
    //     await deferred2.promise;
    //     mockProc.trigger('close');

    //     const port = server.getPort();
    //     const expectedArgs = ['myscript', '--port', `${port}`, '--uuid', FAKE_UUID, '-foo', 'foo'];
    //     execService.verify((x) => x.execObservable(expectedArgs, BASE_SPAWN_OPTIONS), typeMoq.Times.once());
    // });

    // test('sendCommand should write to an output channel if it is provided as an option', async () => {
    //     const output2: string[] = [];
    //     const outChannel = {
    //         appendLine: (str: string) => {
    //             output2.push(str);
    //         },
    //     } as OutputChannel;
    //     const options = {
    //         command: {
    //             script: 'myscript',
    //             args: ['-foo', 'foo'],
    //         },
    //         workspaceFolder: Uri.file('/foo/bar'),
    //         cwd: '/foo/bar',
    //         uuid: FAKE_UUID,
    //         outChannel,
    //     };
    //     deferred = createDeferred();
    //     execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    //     execFactory
    //         .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
    //         .returns(() => {
    //             deferred.resolve();
    //             return Promise.resolve(execService.object);
    //         });

    //     server = new PythonTestServer(execFactory.object, debugLauncher);
    //     await server.serverReady();

    //     server.sendCommand(options);
    //     // add in await and trigger
    //     await deferred.promise;
    //     mockProc.trigger('close');

    //     const port = server.getPort();
    //     const expected = ['python', 'myscript', '--port', `${port}`, '--uuid', FAKE_UUID, '-foo', 'foo'].join(' ');

    //     assert.deepStrictEqual(output2, [expected]);
    // });

    // test('If script execution fails during sendCommand, an onDataReceived event should be fired with the "error" status', async () => {
    //     let eventData: { status: string; errors: string[] } | undefined;
    //     stubExecutionService = ({
    //         execObservable: () => {
    //             throw new Error('Failed to execute');
    //         },
    //     } as unknown) as IPythonExecutionService;
    //     const options = {
    //         command: { script: 'myscript', args: ['-foo', 'foo'] },
    //         workspaceFolder: Uri.file('/foo/bar'),
    //         cwd: '/foo/bar',
    //         uuid: FAKE_UUID,
    //     };

    //     server = new PythonTestServer(stubExecutionFactory, debugLauncher);
    //     await server.serverReady();

    //     server.onDataReceived(({ data }) => {
    //         eventData = JSON.parse(data);
    //     });

    //     await server.sendCommand(options);

    //     assert.notEqual(eventData, undefined);
    //     assert.deepStrictEqual(eventData?.status, 'error');
    //     assert.deepStrictEqual(eventData?.errors, ['Failed to execute']);
    // });

    //     test('If the server receives malformed data, it should display a log message, and not fire an event', async () => {
    //         deferred2 = createDeferred();
    //         execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    //         execFactory
    //             .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
    //             .returns(() => {
    //                 deferred2.resolve();
    //                 return Promise.resolve(execService.object);
    //             });
    //         server = new PythonTestServer(execFactory.object, debugLauncher);
    //         await server.serverReady();
    //         let eventData: string | undefined;
    //         const client = new net.Socket();
    //         const options = {
    //             command: { script: 'myscript', args: ['-foo', 'foo'] },
    //             workspaceFolder: Uri.file('/foo/bar'),
    //             cwd: '/foo/bar',
    //             uuid: FAKE_UUID,
    //         };
    //         mockProc = new MockChildProcess('', ['']);
    //         const output2 = new Observable<Output<string>>(() => {
    //             /* no op */
    //         });
    //         const stubExecutionService2 = ({
    //             execObservable: () => {
    //                 client.connect(server.getPort());
    //                 return {
    //                     proc: mockProc,
    //                     out: output2,
    //                     dispose: () => {
    //                         /* no-body */
    //                     },
    //                 };
    //             },
    //         } as unknown) as IPythonExecutionService;

    //         const stubExecutionFactory2 = ({
    //             createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
    //         } as unknown) as IPythonExecutionFactory;

    //         deferred = createDeferred();
    //         server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
    //         await server.serverReady();
    //         server.onDataReceived(({ data }) => {
    //             eventData = data;
    //             deferred.resolve();
    //         });

    //         client.on('connect', () => {
    //             console.log('Socket connected, local port:', client.localPort);
    //             client.write('malformed data');
    //             client.end();
    //         });
    //         client.on('error', (error) => {
    //             console.log('Socket connection error:', error);
    //         });

    //         server.sendCommand(options);
    //         // add in await and trigger
    //         await deferred.promise;
    //         mockProc.trigger('close');

    //         assert.deepStrictEqual(eventData, '');
    //     });

    //     test('If the server doesnt recognize the UUID it should ignore it', async () => {
    //         let eventData: string | undefined;
    //         const client = new net.Socket();
    //         const options = {
    //             command: { script: 'myscript', args: ['-foo', 'foo'] },
    //             workspaceFolder: Uri.file('/foo/bar'),
    //             cwd: '/foo/bar',
    //             uuid: FAKE_UUID,
    //         };

    //         deferred = createDeferred();
    //         mockProc = new MockChildProcess('', ['']);
    //         const output = new Observable<Output<string>>(() => {
    //             /* no op */
    //         });
    //         const stubExecutionService2 = ({
    //             execObservable: () => {
    //                 client.connect(server.getPort());
    //                 return {
    //                     proc: mockProc,
    //                     out: output,
    //                     dispose: () => {
    //                         /* no-body */
    //                     },
    //                 };
    //             },
    //         } as unknown) as IPythonExecutionService;

    //         const stubExecutionFactory2 = ({
    //             createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
    //         } as unknown) as IPythonExecutionFactory;
    //         server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
    //         await server.serverReady();
    //         server.onDataReceived(({ data }) => {
    //             eventData = data;
    //             deferred.resolve();
    //         });

    //         client.on('connect', () => {
    //             console.log('Socket connected, local port:', client.localPort);
    //             client.write('{"Request-uuid": "unknown-uuid"}');
    //             client.end();
    //         });
    //         client.on('error', (error) => {
    //             console.log('Socket connection error:', error);
    //         });

    //         server.sendCommand(options);
    //         await deferred.promise;
    //         assert.deepStrictEqual(eventData, '');
    //     });

    //     // required to have "tests" or "results"
    //     // the heading length not being equal and yes being equal
    //     // multiple payloads
    //     test('Error if payload does not have a content length header', async () => {
    //         let eventData: string | undefined;
    //         const client = new net.Socket();
    //         const options = {
    //             command: { script: 'myscript', args: ['-foo', 'foo'] },
    //             workspaceFolder: Uri.file('/foo/bar'),
    //             cwd: '/foo/bar',
    //             uuid: FAKE_UUID,
    //         };
    //         deferred = createDeferred();
    //         mockProc = new MockChildProcess('', ['']);
    //         const output = new Observable<Output<string>>(() => {
    //             /* no op */
    //         });
    //         const stubExecutionService2 = ({
    //             execObservable: () => {
    //                 client.connect(server.getPort());
    //                 return {
    //                     proc: mockProc,
    //                     out: output,
    //                     dispose: () => {
    //                         /* no-body */
    //                     },
    //                 };
    //             },
    //         } as unknown) as IPythonExecutionService;

    //         const stubExecutionFactory2 = ({
    //             createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
    //         } as unknown) as IPythonExecutionFactory;
    //         server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
    //         await server.serverReady();
    //         server.onDataReceived(({ data }) => {
    //             eventData = data;
    //             deferred.resolve();
    //         });

    //         client.on('connect', () => {
    //             console.log('Socket connected, local port:', client.localPort);
    //             client.write('{"not content length": "5"}');
    //             client.end();
    //         });
    //         client.on('error', (error) => {
    //             console.log('Socket connection error:', error);
    //         });

    //         server.sendCommand(options);
    //         await deferred.promise;
    //         assert.deepStrictEqual(eventData, '');
    //     });

    //     const testData = [
    //         {
    //             testName: 'fires discovery correctly on test payload',
    //             payload: `Content-Length: 52
    // Content-Type: application/json
    // Request-uuid: UUID_HERE

    // {"cwd": "path", "status": "success", "tests": "xyz"}`,
    //             expectedResult: '{"cwd": "path", "status": "success", "tests": "xyz"}',
    //         },
    //         // Add more test data as needed
    //     ];

    //     testData.forEach(({ testName, payload, expectedResult }) => {
    //         test(`test: ${testName}`, async () => {
    //             // Your test logic here
    //             let eventData: string | undefined;
    //             const client = new net.Socket();

    //             const options = {
    //                 command: { script: 'myscript', args: ['-foo', 'foo'] },
    //                 workspaceFolder: Uri.file('/foo/bar'),
    //                 cwd: '/foo/bar',
    //                 uuid: FAKE_UUID,
    //             };
    //             deferred = createDeferred();
    //             mockProc = new MockChildProcess('', ['']);
    //             const output = new Observable<Output<string>>(() => {
    //                 /* no op */
    //             });
    //             const stubExecutionService2 = ({
    //                 execObservable: () => {
    //                     client.connect(server.getPort());
    //                     return {
    //                         proc: mockProc,
    //                         out: output,
    //                         dispose: () => {
    //                             /* no-body */
    //                         },
    //                     };
    //                 },
    //             } as unknown) as IPythonExecutionService;
    //             const stubExecutionFactory2 = ({
    //                 createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
    //             } as unknown) as IPythonExecutionFactory;

    //             server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
    //             await server.serverReady();
    //             const uuid = server.createUUID();
    //             payload = payload.replace('UUID_HERE', uuid);
    //             server.onDiscoveryDataReceived(({ data }) => {
    //                 eventData = data;
    //                 deferred.resolve();
    //             });

    //             client.on('connect', () => {
    //                 console.log('Socket connected, local port:', client.localPort);
    //                 client.write(payload);
    //                 client.end();
    //             });
    //             client.on('error', (error) => {
    //                 console.log('Socket connection error:', error);
    //             });

    //             server.sendCommand(options);
    //             await deferred.promise;
    //             assert.deepStrictEqual(eventData, expectedResult);
    //         });
    //     });

    //     test('Calls run resolver if the result header is in the payload', async () => {
    //         let eventData: string | undefined;
    //         const client = new net.Socket();

    //         deferred = createDeferred();
    //         mockProc = new MockChildProcess('', ['']);
    //         const output = new Observable<Output<string>>(() => {
    //             /* no op */
    //         });
    //         const stubExecutionService2 = ({
    //             execObservable: () => {
    //                 client.connect(server.getPort());
    //                 return {
    //                     proc: mockProc,
    //                     out: output,
    //                     dispose: () => {
    //                         /* no-body */
    //                     },
    //                 };
    //             },
    //         } as unknown) as IPythonExecutionService;

    //         const stubExecutionFactory2 = ({
    //             createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
    //         } as unknown) as IPythonExecutionFactory;
    //         server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
    //         const options = {
    //             command: { script: 'myscript', args: ['-foo', 'foo'] },
    //             workspaceFolder: Uri.file('/foo/bar'),
    //             cwd: '/foo/bar',
    //             uuid: FAKE_UUID,
    //         };

    //         await server.serverReady();
    //         const uuid = server.createUUID();
    //         server.onRunDataReceived(({ data }) => {
    //             eventData = data;
    //             deferred.resolve();
    //         });

    //         const payload = `Content-Length: 87
    // Content-Type: application/json
    // Request-uuid: ${uuid}

    // {"cwd": "path", "status": "success", "result": "xyz", "not_found": null, "error": null}`;

    //         client.on('connect', () => {
    //             console.log('Socket connected, local port:', client.localPort);
    //             client.write(payload);
    //             client.end();
    //         });
    //         client.on('error', (error) => {
    //             console.log('Socket connection error:', error);
    //         });

    //         server.sendCommand(options);
    //         await deferred.promise;
    //         const expectedResult =
    //             '{"cwd": "path", "status": "success", "result": "xyz", "not_found": null, "error": null}';
    //         assert.deepStrictEqual(eventData, expectedResult);
    //     });
});