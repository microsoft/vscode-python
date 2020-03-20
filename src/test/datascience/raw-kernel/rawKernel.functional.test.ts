// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { KernelMessage } from '@jupyterlab/services';
import { assert } from 'chai';
import * as fs from 'fs-extra';
import { noop } from 'jquery';
import * as os from 'os';
import * as path from 'path';
import { Observable } from 'rxjs';
import * as uuid from 'uuid/v4';
import { IPythonExecutionFactory, ObservableExecutionResult } from '../../../client/common/process/types';
import { createDeferred } from '../../../client/common/utils/async';
import { IJMPConnection } from '../../../client/datascience/types';
import { DataScienceIocContainer } from '../dataScienceIocContainer';

// tslint:disable:no-any no-multiline-string max-func-body-length no-console max-classes-per-file trailing-comma
suite('DataScience raw kernel tests', () => {
    let ioc: DataScienceIocContainer;
    let enchannelConnection: IJMPConnection;
    let connectionFile: string;
    let kernelProcResult: ObservableExecutionResult<string>;
    let messageObservable: Observable<KernelMessage.IMessage<KernelMessage.MessageType>>;
    let sessionId: string;
    const connectionInfo = {
        shell_port: 57718,
        iopub_port: 57719,
        stdin_port: 57720,
        control_port: 57721,
        hb_port: 57722,
        ip: '127.0.0.1',
        key: 'c29c2121-d277576c2c035f0aceeb5068',
        transport: 'tcp',
        signature_scheme: 'hmac-sha256',
        kernel_name: 'python3',
        version: 5.1
    };
    setup(async function() {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        await ioc.activate();
        if (ioc.mockJupyter) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            enchannelConnection = ioc.get<IJMPConnection>(IJMPConnection);

            // Find our jupyter interpreter
            const interpreter = await ioc.getJupyterCapableInterpreter();
            assert.ok(interpreter, 'No jupyter interpreter found');
            // Start our kernel
            const execFactory = ioc.get<IPythonExecutionFactory>(IPythonExecutionFactory);
            const env = await execFactory.createActivatedEnvironment({ interpreter });

            connectionFile = path.join(os.tmpdir(), `tmp_${Date.now()}_k.json`);
            await fs.writeFile(connectionFile, JSON.stringify(connectionInfo), { encoding: 'utf-8', flag: 'w' });

            // Keep kernel alive while the tests are running.
            kernelProcResult = env.execObservable(['-m', 'ipykernel_launcher', '-f', connectionFile], {
                throwOnStdErr: false
            });
            kernelProcResult.out.subscribe(
                out => {
                    console.log(out.out);
                },
                error => {
                    console.error(error);
                },
                () => {
                    enchannelConnection.dispose();
                }
            );
            sessionId = uuid();
            await enchannelConnection.connect(connectionInfo, sessionId);
            messageObservable = new Observable(subscriber => {
                enchannelConnection.subscribe(subscriber.next.bind(subscriber));
            });
        }
    });

    teardown(async () => {
        kernelProcResult?.proc?.kill();
        try {
            await fs.remove(connectionFile);
        } catch {
            noop();
        }
        enchannelConnection.dispose();
        await ioc.dispose();
    });

    function createShutdownMessage(): KernelMessage.IMessage<'shutdown_request'> {
        return {
            channel: 'control',
            content: {
                restart: false
            },
            header: {
                date: Date.now().toString(),
                msg_id: uuid(),
                msg_type: 'shutdown_request',
                session: sessionId,
                username: 'user',
                version: '5.1'
            },
            parent_header: {},
            metadata: {}
        };
    }

    function sendMessage(
        message: KernelMessage.IMessage<KernelMessage.MessageType>
    ): Promise<KernelMessage.IMessage<KernelMessage.MessageType>[]> {
        const waiter = createDeferred<KernelMessage.IMessage<KernelMessage.MessageType>[]>();
        const replies: KernelMessage.IMessage<KernelMessage.MessageType>[] = [];

        const subscr = messageObservable.subscribe(m => {
            replies.push(m);
            if (m.header.msg_type === 'status' && (m.content as any).execution_state === 'idle') {
                waiter.resolve(replies);
            } else if (m.header.msg_type === 'shutdown_reply') {
                // Special case, status may never come after this.
                waiter.resolve(replies);
            }
        });
        enchannelConnection.sendMessage(message);
        return waiter.promise.then(m => {
            subscr.unsubscribe();
            return m;
        });
    }

    // tslint:disable-next-line: no-function-expression
    test('Basic connection', async function() {
        const replies = await sendMessage(createShutdownMessage());
        assert.ok(
            replies.find(r => r.header.msg_type === 'shutdown_reply'),
            'Reply not sent for shutdown'
        );
    });

    test('Basic request', async function() {});
});
