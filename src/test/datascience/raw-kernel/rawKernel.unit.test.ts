// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { KernelMessage } from '@jupyterlab/services';
import { assert, expect } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { RawKernel } from '../../../client/datascience/raw-kernel/rawKernel';
import { IJMPConnection, IJMPConnectionInfo } from '../../../client/datascience/types';

// tslint:disable: max-func-body-length
suite('Data Science - RawKernel', () => {
    let rawKernel: RawKernel;
    let jmpConnection: IJMPConnection;
    let connectInfo: IJMPConnectionInfo;

    setup(() => {
        jmpConnection = mock<IJMPConnection>();
        when(jmpConnection.connect(anything(), anything())).thenResolve();
        when(jmpConnection.subscribe(anything())).thenReturn();
        rawKernel = new RawKernel(instance(jmpConnection));

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
    });

    test('RawKernel connect should connect and subscribe to JMP', async () => {
        await rawKernel.connect(connectInfo);
        verify(jmpConnection.connect(deepEqual(connectInfo), anything())).once();
        verify(jmpConnection.subscribe(anything())).once();
    });

    test('RawKernel dispose should dispose the jmp', async () => {
        when(jmpConnection.dispose()).thenReturn();

        await rawKernel.connect(connectInfo);

        // Dispose our kernel
        rawKernel.dispose();

        verify(jmpConnection.dispose()).once();
        assert.isTrue(rawKernel.isDisposed);
    });

    test('RawKernel requestExecute should pass a valid execute message to JMP', async () => {
        when(jmpConnection.sendMessage(anything())).thenReturn();

        await rawKernel.connect(connectInfo);

        const code = 'print("hello world")';
        const executeContent: KernelMessage.IExecuteRequestMsg['content'] = {
            code
        };
        const future = rawKernel.requestExecute(executeContent, true, undefined);

        // Verify that we sent a message to jmp
        verify(jmpConnection.sendMessage(anything())).once();

        // We don't need a detailed verification on the jmp message sent, as that same
        // message is set in the future which we can examine now
        expect(future.msg.header.msg_type).to.equal('execute_request');
        expect(future.msg.channel).to.equal('shell');
        expect(future.msg.content.code).to.equal(code);
    });

    test('RawKernel dispose should also dispose of any futures', async () => {
        when(jmpConnection.sendMessage(anything())).thenReturn();
        when(jmpConnection.dispose()).thenReturn();

        await rawKernel.connect(connectInfo);

        const code = 'print("hello world")';
        const executeContent: KernelMessage.IExecuteRequestMsg['content'] = {
            code
        };
        const future = rawKernel.requestExecute(executeContent, true, undefined);
        future.done.catch(reason => {
            const error = reason as Error;
            expect(error.message).to.equal('Disposed Future');
        });

        // Dispose the rawKernel, the done promise on the future should reject with an Error
        rawKernel.dispose();

        expect(future.isDisposed).to.equal(true, 'Future was not disposed on RawKernel dispose');
    });
});
