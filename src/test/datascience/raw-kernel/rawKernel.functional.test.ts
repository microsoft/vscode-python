// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { KernelMessage } from '@jupyterlab/services';
import { assert } from 'chai';
import * as uuid from 'uuid/v4';
import { IPythonExecutionFactory, ObservableExecutionResult } from '../../../client/common/process/types';
import { createDeferred } from '../../../client/common/utils/async';
import { IJMPConnection } from '../../../client/datascience/types';
import { DataScienceIocContainer } from '../dataScienceIocContainer';

// tslint:disable:no-any no-multiline-string max-func-body-length no-console max-classes-per-file trailing-comma
suite('DataScience raw kernel tests', () => {
    let ioc: DataScienceIocContainer;
    let enchannelConnection: IJMPConnection;
    let connectionInfo: any;
    let kernelResult: ObservableExecutionResult<string>;
    const connectionReturned = createDeferred();
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
            kernelResult = env.execObservable(
                [
                    '-c',
                    'import jupyter_client;km,kc = jupyter_client.manager.start_new_kernel(kernel_name="python3");print(km.get_connection_info())'
                ],
                { throwOnStdErr: true }
            );
            kernelResult.out.subscribe(out => {
                connectionInfo = JSON.parse(out.out.replace(/b*\'/g, '"'));
                connectionReturned.resolve();
            });
        }
    });

    teardown(async () => {
        kernelResult.proc?.kill();
        await ioc.dispose();
    });

    function createShutdownMessage(sessionId: string): KernelMessage.IMessage<'shutdown_request'> {
        return {
            channel: 'control',
            content: {},
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
        await connectionReturned.promise;
        const sessionId = uuid();
        await enchannelConnection.connect(connectionInfo, sessionId);
        enchannelConnection.subscribe(msg => {
            assert.equal(msg.header.msg_type, 'shutdown_reply', 'Shutdown reply not sent');
        });
        enchannelConnection.sendMessage(createShutdownMessage(sessionId));
    });
});
