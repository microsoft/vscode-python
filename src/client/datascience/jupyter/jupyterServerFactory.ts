// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, multiInject, optional } from 'inversify';
import { Observable } from 'rxjs/Observable';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../common/application/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../common/types';
import {
    ICell,
    IConnection,
    IDataScience,
    IJupyterSessionManager,
    INotebookCompletion,
    INotebookExecutionLogger,
    INotebookServer,
    INotebookServerLaunchInfo,
    InterruptResult
} from '../types';
import { GuestJupyterServer } from './liveshare/guestJupyterServer';
import { HostJupyterServer } from './liveshare/hostJupyterServer';
import { IRoleBasedObject, RoleBasedFactory } from './liveshare/roleBasedFactory';
import { ILiveShareHasRole } from './liveshare/types';

interface IJupyterServerInterface extends IRoleBasedObject, INotebookServer {

}

// tslint:disable:callable-types
type JupyterServerClassType = {
    new(liveShare: ILiveShareApi,
        dataScience: IDataScience,
        logger: ILogger,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManager,
        loggers: INotebookExecutionLogger[]
    ): IJupyterServerInterface;
};
// tslint:enable:callable-types

@injectable()
export class JupyterServerFactory implements INotebookServer, ILiveShareHasRole {
    private serverFactory: RoleBasedFactory<IJupyterServerInterface, JupyterServerClassType>;

    private launchInfo: INotebookServerLaunchInfo | undefined;
    private _id: string = uuid();

    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IDataScience) dataScience: IDataScience,
        @inject(ILogger) logger: ILogger,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IJupyterSessionManager) sessionManager: IJupyterSessionManager,
        @multiInject(INotebookExecutionLogger) @optional() loggers: INotebookExecutionLogger[] | undefined) {
        this.serverFactory = new RoleBasedFactory<IJupyterServerInterface, JupyterServerClassType>(
            liveShare,
            HostJupyterServer,
            GuestJupyterServer,
            liveShare,
            dataScience,
            logger,
            disposableRegistry,
            asyncRegistry,
            configService,
            sessionManager,
            loggers ? loggers : []
        );
    }

    public get role(): vsls.Role {
        return this.serverFactory.role;
    }

    public get id(): string {
        return this._id;
    }

    public async connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void> {
        this.launchInfo = launchInfo;
        const server = await this.serverFactory.get();
        return server.connect(launchInfo, cancelToken);
    }

    public async shutdown(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.shutdown();
    }

    public async dispose(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.dispose();
    }

    public async waitForIdle(timeoutMs: number): Promise<void> {
        const server = await this.serverFactory.get();
        return server.waitForIdle(timeoutMs);
    }

    public async execute(code: string, file: string, line: number, id: string, cancelToken?: CancellationToken, silent?: boolean): Promise<ICell[]> {
        const server = await this.serverFactory.get();
        return server.execute(code, file, line, id, cancelToken, silent);
    }

    public async setInitialDirectory(directory: string): Promise<void> {
        const server = await this.serverFactory.get();
        return server.setInitialDirectory(directory);
    }

    public async setMatplotLibStyle(useDark: boolean): Promise<void> {
        const server = await this.serverFactory.get();
        return server.setMatplotLibStyle(useDark);
    }

    public executeObservable(code: string, file: string, line: number, id: string, silent: boolean = false): Observable<ICell[]> {
        // Create a wrapper observable around the actual server (because we have to wait for a promise)
        return new Observable<ICell[]>(subscriber => {
            this.serverFactory.get().then(s => {
                s.executeObservable(code, file, line, id, silent)
                    .forEach(n => {
                        subscriber.next(n); // Separate lines so can break on this call.
                    }, Promise)
                    .then(_f => {
                        subscriber.complete();
                    })
                    .catch(e => subscriber.error(e));
            },
                r => {
                    subscriber.error(r);
                    subscriber.complete();
                });
        });
    }

    public async restartKernel(timeoutMs: number): Promise<void> {
        const server = await this.serverFactory.get();
        return server.restartKernel(timeoutMs);
    }

    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        const server = await this.serverFactory.get();
        return server.interruptKernel(timeoutMs);
    }

    // Return a copy of the connection information that this server used to connect with
    public getConnectionInfo(): IConnection | undefined {
        if (this.launchInfo) {
            return this.launchInfo.connectionInfo;
        }

        return undefined;
    }

    public async waitForConnect(): Promise<INotebookServerLaunchInfo | undefined> {
        const server = await this.serverFactory.get();
        return server.waitForConnect();
    }

    public async getSysInfo(): Promise<ICell | undefined> {
        const server = await this.serverFactory.get();
        return server.getSysInfo();
    }

    public async getCompletion(cellCode: string, offsetInCode: number, cancelToken?: CancellationToken): Promise<INotebookCompletion> {
        const server = await this.serverFactory.get();
        return server.getCompletion(cellCode, offsetInCode, cancelToken);
    }
}
