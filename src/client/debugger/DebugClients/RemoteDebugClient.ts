import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArgumentsV1, BaseAttachRequestArguments, IPythonProcess } from '../Common/Contracts';
import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { RemoteDebugServer } from '../DebugServers/RemoteDebugServer';
import { RemoteDebugServerV2 } from '../DebugServers/RemoteDebugServerv2';
import { DebugClient, DebugType } from './DebugClient';

export class RemoteDebugClient<T extends BaseAttachRequestArguments> extends DebugClient<T> {
    private pythonProcess?: IPythonProcess;
    private debugServer?: BaseDebugServer;
    // tslint:disable-next-line:no-any
    constructor(args: T, debugSession: DebugSession) {
        super(args, debugSession);
    }

    public CreateDebugServer(pythonProcess?: IPythonProcess): BaseDebugServer {
        if (this.args.type === 'pythonExperimental') {
            // tslint:disable-next-line:no-any
            this.debugServer = new RemoteDebugServerV2(this.debugSession, undefined as any, this.args);
        } else {
            this.pythonProcess = pythonProcess!;
            this.debugServer = new RemoteDebugServer(this.debugSession, this.pythonProcess!, this.args as {} as AttachRequestArgumentsV1);
        }
        return this.debugServer!;
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
