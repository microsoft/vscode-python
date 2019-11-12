import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { RemoteDebugServerV2 } from '../DebugServers/RemoteDebugServerv2';
import { DebugClient, DebugType } from './DebugClient';

export class RemoteDebugClient<T extends AttachRequestArguments | LaunchRequestArguments> extends DebugClient<T> {
    private debugServer?: BaseDebugServer;
    // tslint:disable-next-line:no-any
    constructor(args: T, debugSession: DebugSession) {
        super(args, debugSession);
    }

    public CreateDebugServer(): BaseDebugServer {
        this.debugServer = new RemoteDebugServerV2(this.debugSession, this.args);
        return this.debugServer;
    }
    public get DebugType(): DebugType {
        return DebugType.Remote;
    }

    public Stop() {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
    }
}
