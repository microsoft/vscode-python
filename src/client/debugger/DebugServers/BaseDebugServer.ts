// tslint:disable:quotemark ordered-imports no-any no-empty
'use strict';

import { DebugSession } from 'vscode-debugadapter';
import { IPythonProcess, IDebugServer } from '../Common/Contracts';
import { EventEmitter } from 'events';
import { Socket } from 'net';
import { Deferred, createDeferred } from '../../../utils/async';

export abstract class BaseDebugServer extends EventEmitter {
    protected clientSocket: Deferred<Socket>;
    public get client(): Promise<Socket> {
        return this.clientSocket.promise;
    }
    protected pythonProcess: IPythonProcess;
    protected debugSession: DebugSession;

    protected isRunning: boolean = false;
    public get IsRunning(): boolean {
        if (this.isRunning === undefined) {
            return false;
        }
        return this.isRunning;
    }
    protected debugClientConnected: Deferred<boolean>;
    public get DebugClientConnected(): Promise<boolean> {
        return this.debugClientConnected.promise;
    }
    constructor(debugSession: DebugSession, pythonProcess?: IPythonProcess) {
        super();
        this.debugSession = debugSession;
        this.pythonProcess = pythonProcess!;
        this.debugClientConnected = createDeferred<boolean>();
        this.clientSocket = createDeferred<Socket>();
    }

    public abstract Start(): Promise<IDebugServer>;
    public abstract Stop();
}
