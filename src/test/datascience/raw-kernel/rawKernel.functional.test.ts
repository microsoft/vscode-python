// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { KernelMessage } from '@jupyterlab/services';
import { assert } from 'chai';
import * as fs from 'fs-extra';
import { noop } from 'jquery';
import * as os from 'os';
import * as path from 'path';
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
        }
    });

    teardown(async () => {
        kernelProcResult?.proc?.kill();
        try {
            await fs.remove(connectionFile);
        } catch {
            noop();
        }
        await ioc.dispose();
    });

    function createShutdownMessage(sessionId: string): KernelMessage.IMessage<'shutdown_request'> {
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

    // tslint:disable-next-line: no-function-expression
    test('Basic iopub', async function() {
        const reply = createDeferred();
        await enchannelConnection.connect(connectionInfo);
        enchannelConnection.subscribe(msg => {
            if (msg.header.msg_type === 'status') {
                reply.resolve();
            }
        });
        enchannelConnection.sendMessage(createShutdownMessage(uuid()));
        await reply.promise;
    });
});
