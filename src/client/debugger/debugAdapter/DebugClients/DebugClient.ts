// tslint:disable:quotemark ordered-imports no-any no-empty

import { BaseDebugServer } from '../DebugServers/BaseDebugServer';
import { IDebugServer } from '../Common/Contracts';
import { DebugSession } from 'vscode-debugadapter';
import { EventEmitter } from 'events';
import { IServiceContainer } from '../../../ioc/types';

export enum DebugType {
    Local,
    Remote,
    RunLocal
}
export abstract class DebugClient<T> extends EventEmitter {
    protected debugSession: DebugSession;
    constructor(protected args: T, debugSession: DebugSession) {
        super();
        this.debugSession = debugSession;
    }
    public abstract CreateDebugServer(serviceContainer?: IServiceContainer): BaseDebugServer;
    public get DebugType(): DebugType {
        return DebugType.Local;
    }

    public Stop() {}

    public LaunchApplicationToDebug(_dbgServer: IDebugServer): Promise<any> {
        return Promise.resolve();
    }
}
