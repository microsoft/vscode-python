// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { CancellationError } from '../../../common/cancellation';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { LiveShare, LiveShareCommands } from '../../constants';
import {
    ICell,
    IConnection,
    IDataScience,
    IJupyterKernelSpec,
    IJupyterSessionManager,
    INotebookServer,
    InterruptResult
} from '../../types';
import { ExecuteObservableResponse, InterruptResponse, ServerResponse, ServerResponseType } from './types';
import { waitForGuestService } from './utils';

export class GuestJupyterServer implements INotebookServer {
    private connInfo : IConnection | undefined;
    private responseQueue : ServerResponse [] = [];
    private waitingQueue : { deferred: Deferred<ServerResponse>; predicate : (r: ServerResponse) => boolean }[] = [];
    private sharedService: Promise<vsls.SharedServiceProxy | undefined>;

    constructor(
        private dataScience: IDataScience,
        private logger: ILogger,
        private disposableRegistry: IDisposableRegistry,
        private asyncRegistry: IAsyncDisposableRegistry,
        private configService: IConfigurationService,
        private sessionManager: IJupyterSessionManager) {
        this.sharedService = this.startSharedServiceProxy();
    }

    public async connect(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, usingDarkTheme: boolean, cancelToken?: CancellationToken, workingDir?: string): Promise<void> {
        this.connInfo = connInfo;
        return Promise.resolve();
    }

    public shutdown(): Promise<void> {
        return Promise.resolve();
    }

    public dispose(): Promise<void> {
        return Promise.resolve();
    }

    public waitForIdle(): Promise<void> {
        return Promise.resolve();
    }

    public async execute(code: string, file: string, line: number, cancelToken?: CancellationToken): Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook
        const observable = this.executeObservable(code, file, line);
        let output: ICell[];

        observable.subscribe(
            (cells: ICell[]) => {
                output = cells;
            },
            (error) => {
                deferred.reject(error);
            },
            () => {
                deferred.resolve(output);
            });

        if (cancelToken) {
            this.disposableRegistry.push(cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError())));
        }

        // Wait for the execution to finish
        return deferred.promise;
    }

    public setInitialDirectory(directory: string): Promise<void> {
        // Ignore this command on this side
        return Promise.resolve();
    }

    public executeObservable(code: string, file: string, line: number, id?: string): Observable<ICell[]> {
        // Create a wrapper observable around the actual server
        return new Observable<ICell[]>(subscriber => {
            // Wait for the observable responses to come in
            this.waitForObservable(subscriber, code, file, line, id)
                .catch(e => {
                    subscriber.error(e);
                    subscriber.complete();
                });
        });
    }

    public async executeSilently(code: string, cancelToken?: CancellationToken): Promise<void> {
        // We don't need the result from this. It should have already happened on the host side
        return Promise.resolve();
    }

    public async restartKernel(): Promise<void> {
        await this.waitForResponse(ServerResponseType.Restart);
    }

    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        const response = await this.waitForResponse(ServerResponseType.Restart);
        return (response as InterruptResponse).result;
    }

    // Return a copy of the connection information that this server used to connect with
    public getConnectionInfo(): IConnection | undefined {
        return this.connInfo;
    }

    public async getSysInfo() : Promise<ICell | undefined> {
        // This is a special case. Ask the shared server
        const server = await this.sharedService;
        if (server) {
            const result = await server.request(LiveShareCommands.getSysInfo, []);
            return (result as ICell);
        }
    }

    private async startSharedServiceProxy() : Promise<vsls.SharedServiceProxy | undefined> {
        const api = await vsls.getApiAsync();

        if (api) {
            // Wait for the host to be setup too.
            const service = await waitForGuestService(api, LiveShare.JupyterServerSharedService);

            // Wait for sync up
            const synced = await service.request(LiveShareCommands.syncRequest, []);
            if (!synced) {
                throw new Error('Synchronization failing on startup');
            }

            // Listen to responses
            service.onNotify(LiveShareCommands.serverResponse, this.onServerResponse);

            // Request all of the responses since this guest was started. We likely missed a bunch
            service.notify(LiveShareCommands.catchupRequest, { since: this.dataScience.activationStartTime });

            return service;
        }
    }

    private onServerResponse = (args: Object) => {
        // Args should be of type ServerResponse. Stick in our queue if so.
        if (args.hasOwnProperty('type')) {
            this.responseQueue.push(args as ServerResponse);

            // Check for any waiters.
            this.dispatchResponses();
        }
    }

    private async waitForObservable(subscriber: Subscriber<ICell[]>, code: string, file: string, line: number, id?: string) : Promise<void> {
        let pos = 0;
        let foundId = id;
        while (pos >= 0) {
            // Find all matches in order
            const response = await this.waitForSpecificResponse<ExecuteObservableResponse>(r => {
                return (r.pos === pos) &&
                    (foundId === r.id || !foundId) &&
                    (code === r.code) &&
                    (!r.cells || (r.cells && r.cells[0].file === file && r.cells[0].line === line));
            });
            if (response.cells) {
                subscriber.next(response.cells);
                pos += 1;
                foundId = response.id;
            }
        }
        subscriber.complete();
    }

    private waitForSpecificResponse<T extends ServerResponse>(predicate: (response: T) => boolean) : Promise<T> {
        // See if we have any responses right now with this type
        const index = this.responseQueue.findIndex(predicate);
        if (index >= 0) {
            // Pull off the match
            const match = this.responseQueue[index];

            // Remove from the response queue if necessary
            this.responseQueue.splice(index, 1);

            // Return this single item
            return Promise.resolve(match as T);
        } else {
            // We have to wait for a new input to happen
            const waitable = { deferred: createDeferred<T>(), predicate };
            this.waitingQueue.push(waitable);
            return waitable.deferred.promise;
        }
    }

    private waitForResponse(type: ServerResponseType) : Promise<ServerResponse> {
        return this.waitForSpecificResponse(r => r.type === type);
    }

    private dispatchResponses() {
        // Look through all of our responses that are queued up and see if they make a
        // waiting promise resolve
        for (let i = 0; i < this.responseQueue.length; i += 1) {
            const response = this.responseQueue[i];
            const matchIndex = this.waitingQueue.findIndex(w => w.predicate(response));
            if (matchIndex >= 0) {
                this.waitingQueue[matchIndex].deferred.resolve(response);
                this.waitingQueue = this.waitingQueue.splice(matchIndex);
                this.responseQueue.splice(i, 1);
                i -= 1; // Offset the addition as we removed this item
            }
        }
    }

    private isAllowed(response: ServerResponse, time: number) : boolean {
        const debug = /--debug|--inspect/.test(process.execArgv.join(' '));
        const range = debug ? LiveShare.ResponseRange * 30 : LiveShare.ResponseRange;
        return Math.abs(response.time - time) < range;
    }
}
