import { KernelMessage } from '@jupyterlab/services';
//import { Channels } from '@nteract/messaging';
//import { createMainChannel } from 'enchannel-zmq-backend';
import { IJMPConnection, IJMPConnectionInfo } from '../types';

export class EnchannelJMPConnection implements IJMPConnection {
    //private mainChannel: Channels | undefined;

    public async connect(_connectInfo: IJMPConnectionInfo, _sessionID: string): Promise<void> {
        // tslint:disable-next-line:no-any
        //this.mainChannel = await createMainChannel(connectInfo as any, undefined, sessionID);
    }
    public sendMessage(_message: KernelMessage.IMessage): void {
        //if (this.mainChannel) {
        //// jupyterlab types and enchannel types seem to have small changes
        //// with how they are defined, just use an any cast for now, but they appear to be the
        //// same actual object
        //// tslint:disable-next-line:no-any
        //this.mainChannel.next(message as any);
        //}
    }
    public subscribe(_handlerFunc: (message: KernelMessage.IMessage) => void) {
        //if (this.mainChannel) {
        //// tslint:disable-next-line:no-any
        //this.mainChannel.subscribe(handlerFunc as any);
        //}
    }

    public dispose(): void {
        //if (this.mainChannel) {
        //this.mainChannel.unsubscribe();
        //}
    }
}
