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
    InterruptResult
} from '../types';
import { JupyterServerBase } from './jupyterServerBase';
import { HostJupyterServer } from './liveshare/hostJupyterServer';
import { GuestJupyterServer } from './liveshare/guestJupyterServer';



@injectable()
export class JupyterServer implements INotebookServer {
    private serverHandler: Deferred<INotebookServer> | undefined;
    private connInfo : IConnection | undefined;

    constructor(
        @inject(ILogger) private logger: ILogger,
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IAsyncDisposableRegistry) private asyncRegistry: IAsyncDisposableRegistry,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IJupyterSessionManager) private sessionManager: IJupyterSessionManager) {
        this.asyncRegistry.push(this);
        vsls.getApiAsync().then(
            v => this.loadServer(v).ignoreErrors(),
            r => this.loadServer(undefined).ignoreErrors()
        );

    }

    public async connect(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, usingDarkTheme: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<void> {
        this.connInfo = connInfo;
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.connect(connInfo, kernelSpec, usingDarkTheme, cancelToken, workingDir);
        }
    }

    public async shutdown(): Promise<void> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.dispose();
        }
    }

    public async dispose(): Promise<void> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.dispose();
        }
    }

    public async waitForIdle(): Promise<void> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.waitForIdle();
        }
    }

    public async execute(code: string, file: string, line: number, cancelToken?: CancellationToken): Promise<ICell[]> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.execute(code, file, line, cancelToken);
        }
    }

    public async setInitialDirectory(directory: string): Promise<void> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.setInitialDirectory(directory);
        }
    }

    public executeObservable(code: string, file: string, line: number, id?: string): Observable<ICell[]> {
        // Create a wrapper observable around the actual server
        return new Observable<ICell[]>(subscriber => {
            if (this.serverHandler) {
                this.serverHandler.promise.then(s => {
                    s.executeObservable(code, file, line, id).forEach(n => subscriber.next(n)).then(f => subscriber.complete());
                },
                r => {
                    subscriber.error(r);
                    subscriber.complete();
                })
            } else {
                subscriber.error(new Error(localize.DataScience.sessionDisposed()));
                subscriber.complete();
            }
        });
    }

    public async executeSilently(code: string, cancelToken?: CancellationToken): Promise<void> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.dispose();
        }
    }

    public async restartKernel(): Promise<void> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.restartKernel();
        }
    }

    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        if (this.serverHandler) {
            const server = await this.serverHandler.promise;
            return server.interruptKernel(timeoutMs);
        }
    }

    // Return a copy of the connection information that this server used to connect with
    public getConnectionInfo(): IConnection | undefined {
        return this.connInfo;
    }

    private async loadServer(api: vsls.LiveShare | undefined) : Promise<void> {
        // Dispose of the last execution handler
        if (this.serverHandler && this.serverHandler.resolved) {
            const current = await this.serverHandler.promise;
            if (current) {
                await current.dispose();
            }
        }

        // Create a new one based on our current state of our live share session
        this.serverHandler = createDeferred<INotebookServer>();
        if (api) {
            api.onDidChangeSession(() => this.loadServer(api));
            if (api.session) {
                if (api.session.role === vsls.Role.Host) {
                    this.serverHandler.resolve(
                        new HostJupyterServer(
                            this.logger,
                            this.disposableRegistry,
                            this.asyncRegistry,
                            this.configService,
                            this.sessionManager));
                } else if (api.session.role === vsls.Role.Guest) {
                    this.serverHandler.resolve(
                        new GuestJupyterServer(
                            this.logger,
                            this.disposableRegistry,
                            this.asyncRegistry,
                            this.configService,
                            this.sessionManager));

                }
            }
        }

        if (!this.serverHandler.resolved) {
            // Just create a base one. We don't have a vsls session active
            this.serverHandler.resolve(
                new JupyterServerBase(
                    this.logger,
                    this.disposableRegistry,
                    this.asyncRegistry,
                    this.configService,
                    this.sessionManager));
        }
    }

}
