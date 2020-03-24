// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { Slot } from '@phosphor/signaling';
import { expect } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { RawSession } from '../../../client/datascience/raw-kernel/rawSession';
import { IJMPConnection, IJMPConnectionInfo } from '../../../client/datascience/types';
import { MockJMPConnection } from './mockJMP';
import { buildStatusMessage } from './rawKernel.unit.test';

// tslint:disable: max-func-body-length
suite('Data Science - RawSession', () => {
    let rawSession: RawSession;
    let connectInfo: IJMPConnectionInfo;

    suite('RawSession - basic JMP', () => {
        let jmpConnection: IJMPConnection;
        setup(() => {
            jmpConnection = mock<IJMPConnection>();
            when(jmpConnection.connect(anything())).thenResolve();
            when(jmpConnection.subscribe(anything())).thenReturn();
            rawSession = new RawSession(instance(jmpConnection));

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

        test('RawSession construct', async () => {
            // Kernel status should be unknown
            expect(rawSession.kernel.status).to.equal('unknown');

            // The ID of the session is not the same as the kernel client id
            expect(rawSession.kernel.clientId).to.not.equal(rawSession.id);
        });

        test('RawSession connect', async () => {
            await rawSession.connect(connectInfo);

            // Did we hook up our connection
            verify(jmpConnection.connect(deepEqual(connectInfo))).once();
            verify(jmpConnection.subscribe(anything())).once();
            // The ID of the session is not the same as the kernel client id
            expect(rawSession.kernel.clientId).to.not.equal(rawSession.id);
            expect(rawSession.kernel.id).to.not.equal(rawSession.id);
        });

        test('RawSession dispose', async () => {
            // Kernel status should be unknown
            expect(rawSession.kernel.status).to.equal('unknown');

            // The ID of the session is not the same as the kernel client id
            expect(rawSession.kernel.clientId).to.not.equal(rawSession.id);
            expect(rawSession.kernel.id).to.not.equal(rawSession.id);
        });
    });

    suite('RawSession - mock JMP', () => {
        let mockJmpConnection: MockJMPConnection;
        setup(() => {
            mockJmpConnection = new MockJMPConnection();
            rawSession = new RawSession(mockJmpConnection);

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

        test('RawSession status updates', async () => {
            await rawSession.connect(connectInfo);

            const statusChanges = ['busy', 'idle'];
            let statusHit = 0;
            const statusHandler: Slot<RawSession, Kernel.Status> = (_sender: RawSession, args: Kernel.Status) => {
                const targetStatus = statusChanges[statusHit];
                expect(rawSession.kernel.status).to.equal(targetStatus);
                expect(args).to.equal(targetStatus);
                statusHit = statusHit + 1;
            };
            rawSession.statusChanged.connect(statusHandler);

            // Create a future for an execute code request
            const code = 'print("hello world")';
            const executeContent: KernelMessage.IExecuteRequestMsg['content'] = {
                code
            };
            const future = rawSession.kernel.requestExecute(executeContent, true, undefined);

            // 1. First message is iopub busy status
            const iopubBusyMessage = buildStatusMessage('busy', rawSession.kernel.clientId, future.msg.header);
            mockJmpConnection.messageBack(iopubBusyMessage);

            // 2. an idle message
            const iopubIdleMessage = buildStatusMessage('idle', rawSession.kernel.clientId, future.msg.header);
            mockJmpConnection.messageBack(iopubIdleMessage);

            // 3. Last thing back is a reply message
            const replyOptions: KernelMessage.IOptions<KernelMessage.IExecuteReplyMsg> = {
                channel: 'shell',
                session: rawSession.kernel.clientId,
                msgType: 'execute_reply',
                content: { status: 'ok', execution_count: 1, payload: [], user_expressions: {} }
            };
            const replyMessage = KernelMessage.createMessage<KernelMessage.IExecuteReplyMsg>(replyOptions);
            replyMessage.parent_header = future.msg.header;
            mockJmpConnection.messageBack(replyMessage);

            await future.done;

            // Did we hit the status changes that we expect
            expect(statusHit).to.equal(statusChanges.length);
        });
    });
});
