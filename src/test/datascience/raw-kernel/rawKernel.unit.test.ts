// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//import { assert } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
//import * as typemoq from 'typemoq';
//import { noop } from '../../../client/common/utils/misc';
import { RawKernel } from '../../../client/datascience/raw-kernel/rawKernel';
import { IJMPConnection, IJMPConnectionInfo } from '../../../client/datascience/types';

// tslint:disable: max-func-body-length
suite('Data Science - RawKernel', () => {
    let rawKernel: RawKernel;
    let jmpConnection: IJMPConnection;

    setup(() => {
        jmpConnection = mock<IJMPConnection>();
        when(jmpConnection.connect(anything(), anything())).thenResolve();
        when(jmpConnection.subscribe(anything())).thenReturn();
        rawKernel = new RawKernel(instance(jmpConnection));
    });

    test('IANHU Connect should connect and subscribe to JMP', async () => {
        const connectInfo: IJMPConnectionInfo = {
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
        await rawKernel.connect(connectInfo);
        verify(jmpConnection.connect(deepEqual(connectInfo), anything())).once();
        //verify(jmpConnection.connect(anything(), anything())).once();
        verify(jmpConnection.subscribe(anything())).once();
    });
});
