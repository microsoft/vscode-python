import {BaseDebugServer} from "../DebugServers/BaseDebugServer";
import {LocalDebugServer} from "../DebugServers/LocalDebugServer";
import {IPythonProcess, IPythonThread, IDebugServer} from "../Common/Contracts";
import {DebugSession, OutputEvent} from "vscode-debugadapter";
import * as path from "path";
import * as child_process from "child_process";
import {DjangoApp, LaunchRequestArguments, AttachRequestArguments} from "../Common/Contracts";
import {EventEmitter} from 'events';

export enum DebugType {
    Local,
    Remote,
    RunLocal
}
export abstract class DebugClient extends EventEmitter {
    protected debugSession: DebugSession;
    constructor(protected args: any, debugSession: DebugSession) {
        super();
        this.debugSession = debugSession;
    }
    public abstract CreateDebugServer(pythonProcess: IPythonProcess): BaseDebugServer;
    public get DebugType(): DebugType {
        return DebugType.Local;
    }

    public Stop() {
    }

    public LaunchApplicationToDebug(dbgServer: IDebugServer, processErrored: (error: any) => void): Promise<any> {
        return Promise.resolve();
    }
}
