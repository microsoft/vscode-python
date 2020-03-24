// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { Slot } from '@phosphor/signaling';
import { assert, expect } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as uuid from 'uuid/v4';
import { RawKernel } from '../../../client/datascience/raw-kernel/rawKernel';
import { IJMPConnection, IJMPConnectionInfo } from '../../../client/datascience/types';
import { MockJMPConnection } from './mockJMP';

// tslint:disable: max-func-body-length
suite('Data Science - RawKernel', () => {
    let rawKernel: RawKernel;
    let jmpConnection: IJMPConnection;
    let connectInfo: IJMPConnectionInfo;

    suite('RawKernel basic mock jmp', () => {
        setup(() => {
            jmpConnection = mock<IJMPConnection>();
            when(jmpConnection.connect(anything())).thenResolve();
            when(jmpConnection.subscribe(anything())).thenReturn();
            rawKernel = new RawKernel(instance(jmpConnection), uuid());

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
            verify(jmpConnection.connect(deepEqual(connectInfo))).once();
            verify(jmpConnection.subscribe(anything())).once();
            // Verify that we have a client id an a kernel id
            expect(rawKernel.id).to.not.equal(rawKernel.clientId);
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

    // These suite of tests need to use a mock jmp connection to send back messages as needed
    suite('RawKernel advanced mock jmp', () => {
        let mockJmpConnection: MockJMPConnection;

        setup(() => {
            mockJmpConnection = new MockJMPConnection();
            rawKernel = new RawKernel(mockJmpConnection, uuid());
        });

        test('RawKernel executeRequest messages', async () => {
            await rawKernel.connect(connectInfo);

            // Check our status at the start
            expect(rawKernel.status).to.equal('unknown');

            // Create a future for an execute code request
            const code = 'print("hello world")';
            const executeContent: KernelMessage.IExecuteRequestMsg['content'] = {
                code
            };
            const future = rawKernel.requestExecute(executeContent, true, undefined);

            // First message is iopub busy status
            const iopubBusyMessage = buildStatusMessage('busy', rawKernel.clientId, future.msg.header);

            // Post the message
            mockJmpConnection.messageBack(iopubBusyMessage);

            // Next iopub execute input
            const iopubExecuteInputOptions: KernelMessage.IOptions<KernelMessage.IExecuteInputMsg> = {
                channel: 'iopub',
                session: rawKernel.clientId,
                msgType: 'execute_input',
                content: { code, execution_count: 1 }
            };
            const iopubExecuteInputMessage = KernelMessage.createMessage<KernelMessage.IExecuteInputMsg>(
                iopubExecuteInputOptions
            );
            iopubExecuteInputMessage.parent_header = future.msg.header;

            // Post the message
            mockJmpConnection.messageBack(iopubExecuteInputMessage);

            // Next iopub stream input
            const iopubStreamOptions: KernelMessage.IOptions<KernelMessage.IStreamMsg> = {
                channel: 'iopub',
                session: rawKernel.clientId,
                msgType: 'stream',
                content: { name: 'stdout', text: 'hello' }
            };
            const iopubStreamMessage = KernelMessage.createMessage<KernelMessage.IStreamMsg>(iopubStreamOptions);
            iopubStreamMessage.parent_header = future.msg.header;

            // Post the message
            mockJmpConnection.messageBack(iopubStreamMessage);

            // Finally an idle message
            const iopubIdleMessage = buildStatusMessage('idle', rawKernel.clientId, future.msg.header);

            // Post the message
            mockJmpConnection.messageBack(iopubIdleMessage);

            // Last thing back is a reply message
            const replyOptions: KernelMessage.IOptions<KernelMessage.IExecuteReplyMsg> = {
                channel: 'shell',
                session: rawKernel.clientId,
                msgType: 'execute_reply',
                content: { status: 'ok', execution_count: 1, payload: [], user_expressions: {} }
            };
            const replyMessage = KernelMessage.createMessage<KernelMessage.IExecuteReplyMsg>(replyOptions);
            replyMessage.parent_header = future.msg.header;

            mockJmpConnection.messageBack(replyMessage);

            // Before we await for done we need to set up what we expect to see in our output

            // Check our IOPub Messages
            const iopubMessages = [iopubBusyMessage, iopubExecuteInputMessage, iopubStreamMessage, iopubIdleMessage];
            let iopubHit = 0;
            future.onIOPub = msg => {
                const targetMsg = iopubMessages[iopubHit];
                expect(msg.header.msg_id).to.equal(targetMsg.header.msg_id);
                iopubHit = iopubHit + 1;
            };

            // Check our reply messages
            const replyMessages = [replyMessage];
            let replyHit = 0;
            future.onReply = msg => {
                const targetMsg = replyMessages[replyHit];
                expect(msg.header.msg_id).to.equal(targetMsg.header.msg_id);
                replyHit = replyHit + 1;
            };

            // Check our status changes
            const statusChanges = ['busy', 'idle'];
            let statusHit = 0;
            const statusHandler: Slot<RawKernel, Kernel.Status> = (_sender: RawKernel, args: Kernel.Status) => {
                const targetStatus = statusChanges[statusHit];
                expect(rawKernel.status).to.equal(targetStatus);
                expect(args).to.equal(targetStatus);
                statusHit = statusHit + 1;
            };
            rawKernel.statusChanged.connect(statusHandler);

            await future.done;
            expect(iopubHit).to.equal(iopubMessages.length);
            expect(replyHit).to.equal(replyMessages.length);
            expect(statusHit).to.equal(statusChanges.length);
        });

        test('RawKernel requestInspect messages', async () => {
            await rawKernel.connect(connectInfo);

            // Check our status at the start
            expect(rawKernel.status).to.equal('unknown');

            // Create future for inspect request
            const inspectContent: KernelMessage.IInspectRequestMsg['content'] = {
                code: 'testing',
                cursor_pos: 0,
                detail_level: 0
            };
            const inspectPromise = rawKernel.requestInspect(inspectContent);

            // Pull out our parent header
            const parentHeader = mockJmpConnection.firstHeaderSeen as KernelMessage.IHeader<'inspect_request'>;

            // pump an idle message as we need idle and a reply to be done
            const iopubIdleMessage = buildStatusMessage('idle', rawKernel.clientId, parentHeader);

            // Post the message
            mockJmpConnection.messageBack(iopubIdleMessage);

            // Send a reply message into our connection
            const replyOptions: KernelMessage.IOptions<KernelMessage.IInspectReplyMsg> = {
                channel: 'shell',
                session: rawKernel.clientId,
                msgType: 'inspect_reply',
                parentHeader,
                content: { status: 'ok', found: true, metadata: {}, data: { myData: 'myData' } }
            };
            const replyMessage = KernelMessage.createMessage<KernelMessage.IInspectReplyMsg>(replyOptions);
            mockJmpConnection.messageBack(replyMessage);

            const reply = await inspectPromise;
            expect(reply.header.msg_id).to.equal(replyMessage.header.msg_id);
        });

        test('RawKernel requestComplete messages', async () => {
            await rawKernel.connect(connectInfo);

            // Check our status at the start
            expect(rawKernel.status).to.equal('unknown');

            // Create future for inspect request
            const completeContent: KernelMessage.ICompleteRequestMsg['content'] = {
                code: 'testing',
                cursor_pos: 0
            };
            const inspectPromise = rawKernel.requestComplete(completeContent);

            // Pull out our parent header
            const parentHeader = mockJmpConnection.firstHeaderSeen as KernelMessage.IHeader<'complete_request'>;

            // pump an idle message as we need idle and a reply to be done
            const iopubIdleMessage = buildStatusMessage('idle', rawKernel.clientId, parentHeader);

            // Post the message
            mockJmpConnection.messageBack(iopubIdleMessage);

            // Send a reply message into our connection
            const replyOptions: KernelMessage.IOptions<KernelMessage.ICompleteReplyMsg> = {
                channel: 'shell',
                session: rawKernel.clientId,
                msgType: 'complete_reply',
                parentHeader,
                content: { status: 'ok', metadata: {}, cursor_start: 0, cursor_end: 0, matches: ['testing'] }
            };
            const replyMessage = KernelMessage.createMessage<KernelMessage.ICompleteReplyMsg>(replyOptions);
            mockJmpConnection.messageBack(replyMessage);

            const reply = await inspectPromise;
            expect(reply.header.msg_id).to.equal(replyMessage.header.msg_id);
        });

        test('RawKernel sendInput messages', async () => {
            await rawKernel.connect(connectInfo);

            // Check our status at the start
            expect(rawKernel.status).to.equal('unknown');

            // Create future for inspect request
            const inputReplyContent: KernelMessage.IInputReplyMsg['content'] = {
                value: 'input',
                status: 'ok'
            };
            rawKernel.sendInputReply(inputReplyContent);

            expect(mockJmpConnection.messagesSeen.length).to.equal(1);
            const messageIn = mockJmpConnection.messagesSeen[0] as KernelMessage.IInputReplyMsg;
            expect(messageIn.header.msg_type).to.equal('input_reply');
            // Type system kept fussing on the value type, so just any it
            // tslint:disable-next-line:no-any
            expect((messageIn.content as any).value).to.equal('input');
            expect(messageIn.content.status).to.equal('ok');
        });
    });
});

export function buildStatusMessage(status: Kernel.Status, session: string, parentHeader: KernelMessage.IHeader) {
    const iopubStatusOptions: KernelMessage.IOptions<KernelMessage.IStatusMsg> = {
        channel: 'iopub',
        session,
        msgType: 'status',
        parentHeader,
        content: { execution_state: status }
    };
    return KernelMessage.createMessage<KernelMessage.IStatusMsg>(iopubStatusOptions);
}

export function buildExecuteReplyMessage(session: string, parentHeader: KernelMessage.IHeader<'execute_request'>) {
    const replyOptions: KernelMessage.IOptions<KernelMessage.IExecuteReplyMsg> = {
        channel: 'shell',
        session: session,
        msgType: 'execute_reply',
        parentHeader,
        content: { status: 'ok', execution_count: 1, payload: [], user_expressions: {} }
    };
    return KernelMessage.createMessage<KernelMessage.IExecuteReplyMsg>(replyOptions);
}
