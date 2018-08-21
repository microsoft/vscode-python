import { DebugSession } from 'vscode-debugadapter';
import { BaseAttachRequestArguments, IPythonProcess } from '../Common/Contracts';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { RemoteDebugServerV2 } from '../DebugServers/RemoteDebugServerv2';
import { DebugClient, DebugType } from './DebugClient';

export class RemoteDebugClient<T extends BaseAttachRequestArguments> extends DebugClient<T> {
    private pythonProcess?: IPythonProcess;
    private debugServer?: BaseDebugServer;
    // tslint:disable-next-line:no-any
    constructor(args: T, debugSession: DebugSession) {
        super(args, debugSession);
    }

    public CreateDebugServer(_pythonProcess?: IPythonProcess): BaseDebugServer {
        // tslint:disable-next-line:no-any
        this.debugServer = new RemoteDebugServerV2(this.debugSession, undefined as any, this.args);
        return this.debugServer;
    }
    public get DebugType(): DebugType {
        return DebugType.Remote;
    }

    public Stop() {
        if (this.pythonProcess) {
            this.pythonProcess.Detach();
        }
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
    }

}
