// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../../common/application/types';
import { CancellationError } from '../../../common/cancellation';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import * as localize from '../../../common/utils/localize';
import { LiveShare, LiveShareCommands } from '../../constants';
import {
    ICell,
    IConnection,
    IDataScience,
    IJupyterSessionManager,
    INotebookServer,
    INotebookServerLaunchInfo,
    InterruptResult
} from '../../types';
import { LiveShareParticipantDefault, LiveShareParticipantGuest } from './liveShareParticipantMixin';
import {
    IExecuteObservableResponse,
    IInterruptResponse,
    ILiveShareParticipant,
    IServerResponse,
    ServerResponseType
} from './types';

export class GuestJupyterServer
    extends LiveShareParticipantGuest(LiveShareParticipantDefault, LiveShare.JupyterServerSharedService)
    implements INotebookServer, ILiveShareParticipant {
    private launchInfo : INotebookServerLaunchInfo | undefined;
    private responseQueue : IServerResponse [] = [];
    private waitingQueue : { deferred: Deferred<IServerResponse>; predicate(r: IServerResponse) : boolean }[] = [];

    constructor(
        liveShare: ILiveShareApi,
        private dataScience: IDataScience,
        logger: ILogger,
        private disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManager) {
        super(liveShare);
    }

    public async connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void> {
        this.launchInfo = launchInfo;
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

    public async execute(code: string, file: string, line: number, id: string, cancelToken?: CancellationToken): Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook
        const observable = this.executeObservable(code, file, line, id);
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

    public executeObservable(code: string, file: string, line: number, id: string): Observable<ICell[]> {
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

    public async restartKernel(): Promise<void> {
        await this.waitForResponse(ServerResponseType.Restart);
    }

    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        const response = await this.waitForResponse(ServerResponseType.Restart);
        return (response as IInterruptResponse).result;
    }

    // Return a copy of the connection information that this server used to connect with
    public getConnectionInfo(): IConnection | undefined {
        if (this.launchInfo) {
            return this.launchInfo.connectionInfo;
        }

        return undefined;
    }

    public getLaunchInfo(): INotebookServerLaunchInfo | undefined {
        return this.launchInfo;
    }

    public async getSysInfo() : Promise<ICell | undefined> {
        // This is a special case. Ask the shared server
        const service = await this.waitForService();
        if (service) {
            const result = await service.request(LiveShareCommands.getSysInfo, []);
            return (result as ICell);
        }
    }

    public async onAttach(api: vsls.LiveShare | null) : Promise<void> {
        if (api) {
            const service = await this.waitForService();

            // Wait for sync up
            const synced = service ? await service.request(LiveShareCommands.syncRequest, []) : undefined;
            if (!synced && api.session && api.session.role !== vsls.Role.None) {
                throw new Error(localize.DataScience.liveShareSyncFailure());
            }

            if (service) {
                // Listen to responses
                service.onNotify(LiveShareCommands.serverResponse, this.onServerResponse);

                // Request all of the responses since this guest was started. We likely missed a bunch
                service.notify(LiveShareCommands.catchupRequest, { since: this.dataScience.activationStartTime });
            }
        }
    }

    private onServerResponse = (args: Object) => {
        // Args should be of type ServerResponse. Stick in our queue if so.
        if (args.hasOwnProperty('type')) {
            this.responseQueue.push(args as IServerResponse);

            // Check for any waiters.
            this.dispatchResponses();
        }
    }

    private async waitForObservable(subscriber: Subscriber<ICell[]>, code: string, file: string, line: number, id: string) : Promise<void> {
        let pos = 0;
        let foundId = id;
        let cells: ICell[] | undefined = [];
        while (cells !== undefined) {
            // Find all matches in order
            const response = await this.waitForSpecificResponse<IExecuteObservableResponse>(r => {
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
            cells = response.cells;
        }
        subscriber.complete();
    }

    private waitForSpecificResponse<T extends IServerResponse>(predicate: (response: T) => boolean) : Promise<T> {
        // See if we have any responses right now with this type
        const index = this.responseQueue.findIndex(r => predicate(r as T));
        if (index >= 0) {
            // Pull off the match
            const match = this.responseQueue[index];

            // Remove from the response queue every response before this one as we're not going
            // to be asking for them anymore. (they should be old requests)
            this.responseQueue = this.responseQueue.length > index + 1 ? this.responseQueue.slice(index + 1) : [];

            // Return this single item
            return Promise.resolve(match as T);
        } else {
            // We have to wait for a new input to happen
            const waitable = { deferred: createDeferred<T>(), predicate };
            this.waitingQueue.push(waitable);
            return waitable.deferred.promise;
        }
    }

    private waitForResponse(type: ServerResponseType) : Promise<IServerResponse> {
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
                this.waitingQueue.splice(matchIndex, 1);
                this.responseQueue.splice(i, 1);
                i -= 1; // Offset the addition as we removed this item
            }
        }
    }
}
