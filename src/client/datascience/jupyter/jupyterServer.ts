// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';
import * as vsls from 'vsls/vscode';

import { nbformat } from '@jupyterlab/coreutils';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as vscode from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { CancellationError } from '../../common/cancellation';
import {
    IAsyncDisposable,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    ILogger
} from '../../common/types';
import { createDeferred, Deferred, sleep } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { generateCells } from '../cellFactory';
import { concatMultilineString, stripComments } from '../common';
import {
    CellState,
    ICell,
    IConnection,
    IJupyterKernelSpec,
    IJupyterSession,
    IJupyterSessionManager,
    INotebookServer,
    InterruptResult,
    IDataScience
} from '../types';
import { JupyterServerBase } from './jupyterServerBase';
import { HostJupyterServer } from './liveshare/hostJupyterServer';
import { GuestJupyterServer } from './liveshare/guestJupyterServer';
import { RoleBasedFactory } from './liveshare/roleBasedFactory';



@injectable()
export class JupyterServer implements INotebookServer {
    private serverFactory: RoleBasedFactory<INotebookServer>;

    private connInfo : IConnection | undefined;

    constructor(
        @inject(IDataScience) private dataScience: IDataScience,
        @inject(ILogger) private logger: ILogger,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IAsyncDisposableRegistry) private asyncRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IJupyterSessionManager) private sessionManager: IJupyterSessionManager) {
        this.serverFactory = new RoleBasedFactory<INotebookServer>(
            JupyterServerBase,
            HostJupyterServer,
            GuestJupyterServer,
            dataScience,
            logger,
            disposableRegistry,
            asyncRegistry,
            configService,
            sessionManager
        )
    }

    public async connect(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, usingDarkTheme: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<void> {
        this.connInfo = connInfo;
        const server = await this.serverFactory.get();
        return server.connect(connInfo, kernelSpec, usingDarkTheme, cancelToken, workingDir);
    }

    public async shutdown(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.shutdown();
    }

    public async dispose(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.dispose();
    }

    public async waitForIdle(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.waitForIdle();
    }

    public async execute(code: string, file: string, line: number, cancelToken?: CancellationToken): Promise<ICell[]> {
        const server = await this.serverFactory.get();
        return server.execute(code, file, line, cancelToken);
    }

    public async setInitialDirectory(directory: string): Promise<void> {
        const server = await this.serverFactory.get();
        return server.setInitialDirectory(directory);
    }

    public executeObservable(code: string, file: string, line: number, id?: string): Observable<ICell[]> {
        // Create a wrapper observable around the actual server (because we have to wait for a promise)
        return new Observable<ICell[]>(subscriber => {
            this.serverFactory.get().then(s => {
                s.executeObservable(code, file, line, id)
                    .forEach(n => subscriber.next(n))
                    .then(f => subscriber.complete());
            },
            r => {
                subscriber.error(r);
                subscriber.complete();
            });
        });
    }

    public async executeSilently(code: string, cancelToken?: CancellationToken): Promise<void> {
        const server = await this.serverFactory.get();
        return server.dispose();
    }

    public async restartKernel(): Promise<void> {
        const server = await this.serverFactory.get();
        return server.restartKernel();
    }

    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        const server = await this.serverFactory.get();
        return server.interruptKernel(timeoutMs);
    }

    // Return a copy of the connection information that this server used to connect with
    public getConnectionInfo(): IConnection | undefined {
        return this.connInfo;
    }

    public async getSysInfo() : Promise<ICell> {
        const server = await this.serverFactory.get();
        return server.getSysInfo();
    }
}
