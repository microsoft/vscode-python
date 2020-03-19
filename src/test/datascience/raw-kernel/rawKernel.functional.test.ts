// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { KernelMessage } from '@jupyterlab/services';
import { assert } from 'chai';
import * as uuid from 'uuid/v4';
import { IPythonExecutionFactory } from '../../../client/common/process/types';
import { IJMPConnection } from '../../../client/datascience/types';
import { DataScienceIocContainer } from '../dataScienceIocContainer';

// tslint:disable:no-any no-multiline-string max-func-body-length no-console max-classes-per-file trailing-comma
suite('DataScience raw kernel tests', () => {
    let ioc: DataScienceIocContainer;
    let enchannelConnection: IJMPConnection;
    let connectionInfo: any;
    setup(async function() {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        await ioc.activate();
        enchannelConnection = ioc.get<IJMPConnection>(IJMPConnection);
        if (ioc.mockJupyter) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            // Find our jupyter interpreter
            const interpreter = await ioc.getJupyterCapableInterpreter();
            assert.ok(interpreter, 'No jupyter interpreter found');
            // Start our kernel
            const execFactory = ioc.get<IPythonExecutionFactory>(IPythonExecutionFactory);
            const env = await execFactory.createActivatedEnvironment({ interpreter });
            const result = await env.exec(
                [
                    '-c',
                    'import jupyter_client;km,kc = jupyter_client.manager.start_new_kernel(kernel_name="python3");print(km.get_connection_info())'
                ],
                { throwOnStdErr: true }
            );
            connectionInfo = JSON.parse(result.stdout);
        }
    });

    teardown(async () => {
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
        const sessionId = uuid();
        await enchannelConnection.connect(connectionInfo, sessionId);
        enchannelConnection.subscribe(msg => {
            assert.equal(msg.header.msg_type, 'shutdown_reply', 'Shutdown reply not sent');
        });
        enchannelConnection.sendMessage(createShutdownMessage(sessionId));
    });
});
