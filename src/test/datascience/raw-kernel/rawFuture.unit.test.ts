// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { KernelMessage } from '@jupyterlab/services';
import { expect } from 'chai';
import * as uuid from 'uuid/v4';
import { RawFuture } from '../../../client/datascience/raw-kernel/rawFuture';

// tslint:disable: max-func-body-length
suite('Data Science - RawFuture', () => {
    let rawFuture: RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>;
    let executeMessage: KernelMessage.IExecuteRequestMsg;
    let sessionID: string;

    setup(() => {
        sessionID = uuid();
        // Create an execute request message
        const executeOptions: KernelMessage.IOptions<KernelMessage.IExecuteRequestMsg> = {
            session: sessionID,
            channel: 'shell',
            msgType: 'execute_request',
            username: 'vscode',
            content: { code: 'print("hello world")' }
        };
        executeMessage = KernelMessage.createMessage<KernelMessage.IExecuteRequestMsg>(executeOptions);
        rawFuture = new RawFuture(executeMessage, true);
    });

    test('Check our reply message channel', async () => {
        const replyOptions: KernelMessage.IOptions<KernelMessage.IExecuteReplyMsg> = {
            channel: 'shell',
            session: sessionID,
            msgType: 'execute_reply',
            content: { status: 'ok', execution_count: 1, payload: [], user_expressions: {} }
        };
        const replyMessage = KernelMessage.createMessage<KernelMessage.IExecuteReplyMsg>(replyOptions);
        replyMessage.parent_header = executeMessage.header;

        // Verify that the reply message matches the one we sent
        rawFuture.onReply = msg => {
            expect(msg.header.msg_id).to.equal(replyMessage.header.msg_id);
        };

        await rawFuture.handleMessage(replyMessage);

        // Now take the same message and mangle the parent header,
        // This message should not be sent as it doesn't match the request
        replyMessage.header.msg_id = uuid();
        replyMessage.parent_header.msg_id = 'junk';

        await rawFuture.handleMessage(replyMessage);
    });

    test('Check our IOPub message channel', async () => {
        const ioPubMessageOptions: KernelMessage.IOptions<KernelMessage.IStreamMsg> = {
            session: sessionID,
            msgType: 'stream',
            channel: 'iopub',
            content: { name: 'stdout', text: 'hello' }
        };
        const ioPubMessage = KernelMessage.createMessage<KernelMessage.IStreamMsg>(ioPubMessageOptions);
        ioPubMessage.parent_header = executeMessage.header;

        // Verify that the iopub message matches the one we sent
        rawFuture.onIOPub = msg => {
            expect(msg.header.msg_id).to.equal(ioPubMessage.header.msg_id);
        };

        await rawFuture.handleMessage(ioPubMessage);
    });
});
