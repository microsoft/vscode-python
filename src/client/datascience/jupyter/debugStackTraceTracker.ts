import { DebugProtocol } from 'vscode-debugprotocol';

export class DebugStackTraceTracker {
    protected topMostFrameId = 0;
    protected stackFrameRequestSequenceNumber: number = -1; // Keep track of the sequence number

    public onDidSendMessage(message: DebugProtocol.Response) {
        if (
            message.type === 'response' &&
            message.command === 'stackTrace' &&
            message.body.stackFrames[0] &&
            message.request_seq === this.stackFrameRequestSequenceNumber
        ) {
            // This should be the top frame. We need to use this to compute the value of a variable
            this.topMostFrameId = message.body.stackFrames[0].id;
        }
    }

    public onWillReceiveMessage(message: DebugProtocol.Request) {
        if (message.type === 'request' && message.command === 'stackTrace' && message.arguments.startFrame === 0) {
            // VSCode sometimes sends multiple stackTrace requests. The true topmost frame is determined
            // based on the response to a stackTrace request where the startFrame is 0 (i.e. this request
            // retrieves all frames). Here, remember the sequence number of the outgoing request whose
            // startFrame === 0, and update this.topMostFrameId only when we receive the response with a
            // matching sequence number.
            this.stackFrameRequestSequenceNumber = message.seq;
        }
    }
}
