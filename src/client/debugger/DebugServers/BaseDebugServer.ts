// tslint:disable:quotemark ordered-imports no-any no-empty
"use strict";

import { DebugSession } from "vscode-debugadapter";
import { IPythonProcess, IDebugServer } from "../Common/Contracts";
import { EventEmitter } from "events";
import { Deferred, createDeferred } from '../../common/helpers';

export abstract class BaseDebugServer extends EventEmitter {
    protected pythonProcess: IPythonProcess;
    protected debugSession: DebugSession;

    protected isRunning: boolean;
    public get IsRunning(): boolean {
        return this.isRunning;
    }
    protected debugClientConnected: Deferred<boolean>;
    public get DebugClientConnected(): Promise<boolean> {
        return this.debugClientConnected.promise;
    }
    constructor(debugSession: DebugSession, pythonProcess: IPythonProcess) {
        super();
        this.debugSession = debugSession;
        this.pythonProcess = pythonProcess;
        this.debugClientConnected = createDeferred<boolean>();
    }

    public abstract Start(): Promise<IDebugServer>;
    public abstract Stop();
}
