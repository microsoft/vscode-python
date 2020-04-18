// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { KernelMessage } from '@jupyterlab/services';
import { expect } from 'chai';
import * as uuid from 'uuid/v4';
import { noop } from '../../../client/common/utils/misc';
import { RawFuture } from '../../../client/datascience/raw-kernel/rawFuture';
import { buildExecuteReplyMessage, buildStatusMessage } from './rawKernel.unit.test';

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
        rawFuture = new RawFuture(executeMessage, true, true);
    });

    test('RawFuture dispose', async () => {
        // Set up some handlers
        rawFuture.onReply = (_msg) => {
            noop();
        };
        rawFuture.onIOPub = (_msg) => {
            noop();
        };
        rawFuture.onStdin = (_msg) => {
            noop();
        };

        rawFuture.done.catch((reason) => {
            const error = reason as Error;
            expect(error.message).to.equal('Disposed Future');
        });

        // dispose of the future
        rawFuture.dispose();

        expect(rawFuture.onReply).to.equal(noop);
        expect(rawFuture.onIOPub).to.equal(noop);
        expect(rawFuture.onStdin).to.equal(noop);
        expect(rawFuture.isDisposed).to.equal(true, 'Done promise not rejected ;on dispose');
    });

    test('RawFuture Check future expect reply off', async () => {
        // Since expect reply is turned off, the done should be resolved without a reply message
        rawFuture = new RawFuture(executeMessage, false, true);

        const idleMessage = buildStatusMessage('idle', sessionID, executeMessage.header);

        await rawFuture.handleMessage(idleMessage);

        await rawFuture.done;
    });

    test('RawFuture Check future expect reply on, dispose on done on', async () => {
        // Since expect reply is turned on, the done should be resolved with a reply and an idle status
        const idleMessage = buildStatusMessage('idle', sessionID, executeMessage.header);
        const replyMessage = buildExecuteReplyMessage(sessionID, executeMessage.header);

        await rawFuture.handleMessage(idleMessage);
        await rawFuture.handleMessage(replyMessage);

        await rawFuture.done;
        expect(rawFuture.isDisposed).to.equal(true, 'Future not disposed on done');
    });

    test('RawFuture Check future dispose on done off', async () => {
        // Turn off dispose on done
        rawFuture = new RawFuture(executeMessage, true, false);

        const idleMessage = buildStatusMessage('idle', sessionID, executeMessage.header);
        const replyMessage = buildExecuteReplyMessage(sessionID, executeMessage.header);

        await rawFuture.handleMessage(idleMessage);
        await rawFuture.handleMessage(replyMessage);

        await rawFuture.done;
        expect(rawFuture.isDisposed).to.equal(false, 'Future disposed when dispose on done turned off');
        rawFuture.dispose();
        expect(rawFuture.isDisposed).to.equal(true, 'Future not disposed when dispose called');
    });

    test('RawFuture Check our reply message channel', async () => {
        const replyOptions: KernelMessage.IOptions<KernelMessage.IExecuteReplyMsg> = {
            channel: 'shell',
            session: sessionID,
            msgType: 'execute_reply',
            content: { status: 'ok', execution_count: 1, payload: [], user_expressions: {} }
        };
        const replyMessage = KernelMessage.createMessage<KernelMessage.IExecuteReplyMsg>(replyOptions);
        replyMessage.parent_header = executeMessage.header;

        // Verify that the reply message matches the one we sent
        rawFuture.onReply = (msg) => {
            expect(msg.header.msg_id).to.equal(replyMessage.header.msg_id);
        };

        await rawFuture.handleMessage(replyMessage);

        // Now take the same message and mangle the parent header,
        // This message should not be sent as it doesn't match the request
        replyMessage.header.msg_id = uuid();
        replyMessage.parent_header.msg_id = 'junk';

        await rawFuture.handleMessage(replyMessage);
    });

    test('RawFuture Check our IOPub message channel', async () => {
        const ioPubMessageOptions: KernelMessage.IOptions<KernelMessage.IStreamMsg> = {
            session: sessionID,
            msgType: 'stream',
            channel: 'iopub',
            content: { name: 'stdout', text: 'hello' }
        };
        const ioPubMessage = KernelMessage.createMessage<KernelMessage.IStreamMsg>(ioPubMessageOptions);
        ioPubMessage.parent_header = executeMessage.header;

        // Verify that the iopub message matches the one we sent
        rawFuture.onIOPub = (msg) => {
            expect(msg.header.msg_id).to.equal(ioPubMessage.header.msg_id);
        };

        await rawFuture.handleMessage(ioPubMessage);
    });
});
