import type { KernelMessage } from '@jupyterlab/services';
import type { Channels } from '@nteract/messaging';
import { injectable } from 'inversify';
import { noop } from '../../common/utils/misc';
import { IJMPConnection, IJMPConnectionInfo } from '../types';

@injectable()
export class EnchannelJMPConnection implements IJMPConnection {
    private mainChannel: Channels | undefined;

    public async connect(connectInfo: IJMPConnectionInfo): Promise<void> {
        // zmq may not load, so do it dynamically
        // tslint:disable-next-line: no-require-imports
        const enchannelZmq6 = (await require('./enchannel-zmq-backend-6/index')) as typeof import('./enchannel-zmq-backend-6/index');

        // tslint:disable-next-line:no-any
        this.mainChannel = await enchannelZmq6.createMainChannel(connectInfo as any);
    }
    public sendMessage(message: KernelMessage.IMessage): void {
        if (this.mainChannel) {
            // jupyterlab types and enchannel types seem to have small changes
            // with how they are defined, just use an any cast for now, but they appear to be the
            // same actual object
            // tslint:disable-next-line:no-any
            this.mainChannel.next(message as any);
        }
    }
    // tslint:disable-next-line: no-any
    public subscribe(handlerFunc: (message: KernelMessage.IMessage) => void, errorHandler?: (exc: any) => void) {
        if (this.mainChannel) {
            // tslint:disable-next-line:no-any
            this.mainChannel.subscribe(handlerFunc as any, errorHandler ? errorHandler : noop);
        }
    }

    public dispose(): void {
        if (this.mainChannel) {
            this.mainChannel.unsubscribe();
            this.mainChannel = undefined;
        }
    }
}
