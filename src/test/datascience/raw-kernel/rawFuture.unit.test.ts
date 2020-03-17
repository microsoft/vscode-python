import { KernelMessage } from '@jupyterlab/services';
import { executeRequest } from '@nteract/messaging';
import { assert, expect } from 'chai';
import { noop } from '../../../client/common/utils/misc';
import { RawFuture } from '../../../client/datascience/raw-kernel/rawFuture';


suite('Data Science - RawFuture', () => {
    let rawFuture: RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>;

    setup(() => {
        // Create an execute request message for our future
        const executeReq = executeRequest('print("hello world")');

        //const options: KernelMessage.IOptions<KernelMessage.IExecuteReplyMsg> = {
        //session: 'testsessionid',
        //channel: 'shell', msgType: 'execute_reply', content: {}
        //};
        //const exeReq = KernelMessage.createMessage<KernelMessage.IExecuteReplyMsg>(options);

        const options: KernelMessage.IOptions<KernelMessage.IExecuteRequestMsg> = {
            session: 'testsessionid',
            channel: 'shell', msgType: 'execute_request', content: { code: 'print("hello world")' }
        };
        const exeReq = KernelMessage.createMessage<KernelMessage.IExecuteRequestMsg>(options);

        //const options2: KernelMessage.IOptions<KernelMessage.Message> = {
        //session: 'testsessionid',
        //channel: 'shell', msgType: 'execute_reply', content: {}
        //};
        //const bareRequest = KernelMessage.createMessage<KernelMessage.Message>(options2);
        // IANHU: can I use this with enchannel type?

        // Might need to move this into each test if we are creating / testing different
        // types of rawFutures
        //rawFuture = new RawFuture(executeReq, true);
        //rawFuture = new RawFuture(executeReq as any, true);

        // IANHU: Use JupyterLab Messaging, not nteract for message creation?
    });

    test('IANHU Dispose of RawFuture', async () => {
        // Hook up handlers
        rawFuture.onIOPub = (msg => { console.log(msg); });
        rawFuture.onReply = (msg => { console.log(msg); });
        rawFuture.onStdin = (msg => { console.log(msg); });

        // Dispose of the RawFuture
        rawFuture.dispose();

        // Did we disconnect our handlers?
        expect(rawFuture.onIOPub).equals(noop, 'Did not disconnect handler on dispose');
        assert(rawFuture.onIOPub === noop, 'Did not disconnect hander on dispose');
        assert(rawFuture.onReply === noop, 'Did not disconnect hander on dispose');
        assert(rawFuture.onStdin === noop, 'Did not disconnect hander on dispose');
    });
});