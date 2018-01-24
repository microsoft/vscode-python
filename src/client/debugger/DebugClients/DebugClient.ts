// tslint:disable:quotemark ordered-imports no-any no-empty

import { BaseDebugServer } from "../DebugServers/BaseDebugServer";
import { IPythonProcess, IDebugServer } from "../Common/Contracts";
import { DebugSession } from "vscode-debugadapter";
import { EventEmitter } from 'events';

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
