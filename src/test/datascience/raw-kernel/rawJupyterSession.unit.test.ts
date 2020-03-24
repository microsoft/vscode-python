// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as sinon from 'sinon';
import { mock } from 'ts-mockito';
import { RawJupyterSession } from '../../../client/datascience/raw-kernel/rawJupyterSession';
import { IJMPConnection, IJMPConnectionInfo } from '../../../client/datascience/types';

// Note: The jupyterSession.unit.test.ts tests cover much of the base class functionality
// and lower level is handled by RawFuture, RawKernel, and RawSession
// tslint:disable: max-func-body-length
suite('Data Science - RawJupyterSession', () => {
    let rawJupyterSession: RawJupyterSession;
    let jmpConnection: IJMPConnection;
    let connectInfo: IJMPConnectionInfo;

    setup(() => {
        jmpConnection = mock<IJMPConnection>();
        connectInfo = {
            version: 0,
            transport: 'tcp',
            ip: '127.0.0.1',
            shell_port: 55196,
            iopub_port: 55197,
            stdin_port: 55198,
            hb_port: 55200,
            control_port: 55199,
            signature_scheme: 'hmac-sha256',
            key: 'adaf9032-487d222a85026db284c3d5e7'
        };
        rawJupyterSession = new RawJupyterSession(jmpConnection);
    });

    test('RawJupyterSession - connect', async () => {
        await rawJupyterSession.connect(connectInfo);

        assert.isTrue(rawJupyterSession.isConnected);
    });

    test('RawJupyterSession - shutdown on dispose', async () => {
        const shutdown = sinon.stub(rawJupyterSession, 'shutdown');
        shutdown.resolves();
        await rawJupyterSession.dispose();
        assert.isTrue(shutdown.calledOnce);
    });
});
