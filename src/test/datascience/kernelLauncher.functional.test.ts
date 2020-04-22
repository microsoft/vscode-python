// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import { Uri } from 'vscode';

import { KernelMessage } from '@jupyterlab/services';
import { Observable } from 'rxjs';
import * as uuid from 'uuid/v4';
import { IFileSystem } from '../../client/common/platform/types';
import { IPythonExecutionFactory } from '../../client/common/process/types';
import { Resource } from '../../client/common/types';
import { createDeferred } from '../../client/common/utils/async';
import { JupyterZMQBinariesNotFoundError } from '../../client/datascience/jupyter/jupyterZMQBinariesNotFoundError';
import { KernelLauncher } from '../../client/datascience/kernel-launcher/kernelLauncher';
import { IKernelConnection, IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { IJMPConnection, IJupyterKernelSpec } from '../../client/datascience/types';
import { IInterpreterService, PythonInterpreter } from '../../client/interpreter/contracts';
import { PYTHON_PATH, sleep, waitForCondition } from '../common';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { MockKernelFinder } from './mockKernelFinder';

suite('DataScience - Kernel Launcher', () => {
    let ioc: DataScienceIocContainer;
    let kernelLauncher: KernelLauncher;
    let pythonInterpreter: PythonInterpreter | undefined;
    let resource: Resource;
    let kernelName: string;
    let kernelFinder: MockKernelFinder;

    setup(async () => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        kernelFinder = new MockKernelFinder(ioc.serviceContainer.get<IKernelFinder>(IKernelFinder));
        const executionFactory = ioc.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const file = ioc.serviceContainer.get<IFileSystem>(IFileSystem);
        const interpreterService = ioc.serviceContainer.get<IInterpreterService>(IInterpreterService);
        kernelLauncher = new KernelLauncher(kernelFinder, executionFactory, interpreterService, file);

        pythonInterpreter = await ioc.getJupyterCapableInterpreter();
        resource = Uri.file(PYTHON_PATH);
        kernelName = 'Python 3';
    });

    test('Launch from resource', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(resource, kernelName);
            const exited = new Promise<boolean>((resolve) => kernel.exited(() => resolve(true)));

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');

            // It should not exit.
            assert.isRejected(
                waitForCondition(() => exited, 5_000, 'Timeout'),
                'Timeout'
            );

            // Upon disposing, we should get an exit event within 100ms or less.
            // If this happens, then we know a process existed.
            kernel.dispose();
            assert.isRejected(
                waitForCondition(() => exited, 100, 'Timeout'),
                'Timeout'
            );
        }
    }).timeout(10_000);

    function createExecutionMessage(code: string, sessionId: string): KernelMessage.IExecuteRequestMsg {
        return {
            channel: 'shell',
            content: {
                code,
                silent: false,
                store_history: false
            },
            header: {
                date: Date.now().toString(),
                msg_id: uuid(),
                msg_type: 'execute_request',
                session: sessionId,
                username: 'user',
                version: '5.1'
            },
            parent_header: {},
            metadata: {}
        };
    }

    function sendMessage(
        enchannelConnection: IJMPConnection,
        messageObservable: Observable<KernelMessage.IMessage>,
        message: KernelMessage.IMessage<KernelMessage.MessageType>
    ): Promise<KernelMessage.IMessage<KernelMessage.MessageType>[]> {
        const waiter = createDeferred<KernelMessage.IMessage<KernelMessage.MessageType>[]>();
        const replies: KernelMessage.IMessage<KernelMessage.MessageType>[] = [];
        let expectedReplyType = 'status';
        switch (message.header.msg_type) {
            case 'shutdown_request':
                expectedReplyType = 'shutdown_reply';
                break;

            case 'execute_request':
                expectedReplyType = 'execute_reply';
                break;

            case 'inspect_request':
                expectedReplyType = 'inspect_reply';
                break;
            default:
                break;
        }
        let foundReply = false;
        let foundIdle = false;
        const subscr = messageObservable.subscribe((m) => {
            replies.push(m);
            if (m.header.msg_type === 'status') {
                // tslint:disable-next-line: no-any
                foundIdle = (m.content as any).execution_state === 'idle';
            } else if (m.header.msg_type === expectedReplyType) {
                foundReply = true;
            }

            if (m.header.msg_type === 'shutdown_reply') {
                // Special case, status may never come after this.
                waiter.resolve(replies);
            }
            if (!waiter.resolved && foundReply && foundIdle) {
                waiter.resolve(replies);
            }
        });
        enchannelConnection.sendMessage(message);
        return waiter.promise.then((m) => {
            subscr.unsubscribe();
            return m;
        });
    }

    test('Launch with environment', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING || !pythonInterpreter) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const spec: IJupyterKernelSpec = {
                name: 'foo',
                language: 'python',
                path: pythonInterpreter.path,
                display_name: pythonInterpreter.displayName || 'foo',
                argv: [pythonInterpreter.path, '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
                env: {
                    TEST_VAR: '1'
                }
            };
            kernelFinder.addKernelSpec(pythonInterpreter.path, spec);

            const kernel = await kernelLauncher.launch(resource, kernelName);
            const exited = new Promise<boolean>((resolve) => kernel.exited(() => resolve(true)));

            // It should not exit.
            assert.isRejected(
                waitForCondition(() => exited, 5_000, 'Timeout'),
                'Timeout'
            );

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');

            // Send a request to print out the env vars
            const sessionId = uuid();
            const enchannelConnection = ioc.get<IJMPConnection>(IJMPConnection);
            const messageObservable = new Observable<KernelMessage.IMessage>((subscriber) => {
                enchannelConnection.subscribe(subscriber.next.bind(subscriber));
            });
            await enchannelConnection.connect(kernel.connection);
            const result = await sendMessage(
                enchannelConnection,
                messageObservable,
                createExecutionMessage('import os\nprint(os.getenv("TEST_VAR"))', sessionId)
            );
            assert.ok(result, 'No result returned');
            // Should have a stream output message
            const output = result.find((r) => r.header.msg_type === 'stream') as KernelMessage.IStreamMsg;
            assert.ok(output, 'no stream output');
            assert.equal(output.content.text, '1\n', 'Wrong content found on message');

            // Upon disposing, we should get an exit event within 100ms or less.
            // If this happens, then we know a process existed.
            kernel.dispose();
            assert.isRejected(
                waitForCondition(() => exited, 100, 'Timeout'),
                'Timeout'
            );
        }
    });

    test('Bind with ZMQ', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(resource, kernelName);

            try {
                const zmq = await import('zeromq');
                const sock = new zmq.Pull();

                sock.connect(`tcp://${kernel.connection!.ip}:${kernel.connection!.stdin_port}`);
                sock.receive().ignoreErrors(); // This will never return unless the kenrel process sends something. Just used for testing the API is available
                await sleep(50);
                sock.close();
            } catch (e) {
                throw new JupyterZMQBinariesNotFoundError(e.toString());
            } finally {
                kernel.dispose();
            }
        }
    });
});
