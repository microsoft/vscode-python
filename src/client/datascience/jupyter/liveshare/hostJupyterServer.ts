// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../../common/application/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import { Identifiers, LiveShare, LiveShareCommands } from '../../constants';
import { ICell, IDataScience, IJupyterSessionManager, INotebookServer, InterruptResult } from '../../types';
import { JupyterServerBase } from '../jupyterServer';
import { LiveShareParticipantHost } from './liveShareParticipantMixin';
import { IRoleBasedObject } from './roleBasedFactory';
import { IResponseMapping, IServerResponse, ServerResponseType } from './types';

// tslint:disable:no-any

export class HostJupyterServer
    extends LiveShareParticipantHost(JupyterServerBase, LiveShare.JupyterServerSharedService)
    implements IRoleBasedObject, INotebookServer {
    private responseBacklog : IServerResponse[] = [];
    private catchupPendingCount : number = 0;
    constructor(
        liveShare: ILiveShareApi,
        dataScience: IDataScience,
        logger: ILogger,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManager) {
        super(liveShare, dataScience, logger, disposableRegistry, asyncRegistry, configService, sessionManager);
    }

    public async dispose(): Promise<void> {
        await super.dispose();
        const api = await this.api;
        return this.onDetach(api) ;
    }

    public async onDetach(api: vsls.LiveShare | null) : Promise<void> {
        if (api) {
            return api.unshareService(LiveShare.JupyterServerSharedService);
        }
    }

    public async onAttach(api: vsls.LiveShare | null) : Promise<void> {
        if (api) {
            const service = await this.waitForService();

            // Attach event handlers to different requests
            if (service) {
                service.onRequest(LiveShareCommands.syncRequest, (args: object, cancellation: CancellationToken) => this.onSync());
                service.onRequest(LiveShareCommands.getSysInfo, (args: any[], cancellation: CancellationToken) => this.onGetSysInfoRequest(cancellation));
                service.onNotify(LiveShareCommands.catchupRequest, (args: object) => this.onCatchupRequest(args));
            }
        }
    }

    public async onPeerChange(ev: vsls.PeersChangeEvent) : Promise<void> {
        // Keep track of the number of guests that need to do a catchup request
        this.catchupPendingCount +=
            ev.added.filter(e => e.role === vsls.Role.Guest).length -
            ev.removed.filter(e => e.role === vsls.Role.Guest).length;
    }

    public executeObservable(code: string, file: string, line: number, id: string): Observable<ICell[]> {
        try {
            const inner = super.executeObservable(code, file, line, id);

            // Wrap the observable returned so we can listen to it too
            return this.wrapObservableResult(code, inner, id);

        } catch (exc) {
            this.postException(exc);
            throw exc;
        }

    }

    public async restartKernel(): Promise<void> {
        try {
            const time = Date.now();
            await super.restartKernel();
            return this.postResult(ServerResponseType.Restart, {type: ServerResponseType.Restart, time});
        } catch (exc) {
            this.postException(exc);
            throw exc;
        }
    }

    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        try {
            const time = Date.now();
            const result = await super.interruptKernel(timeoutMs);
            this.postResult(ServerResponseType.Interrupt, {type: ServerResponseType.Interrupt, time, result});
            return result;
        } catch (exc) {
            this.postException(exc);
            throw exc;
        }
    }

    private translateCellForGuest(cell: ICell) : ICell {
        const copy = {...cell};
        if (this.role === vsls.Role.Host && this.finishedApi && copy.file !== Identifiers.EmptyFileName) {
            copy.file = this.finishedApi.convertLocalUriToShared(vscode.Uri.file(copy.file)).fsPath;
        }
        return copy;
    }

    private onSync() : Promise<any> {
        return Promise.resolve(true);
    }

    private onGetSysInfoRequest(cancellation: CancellationToken) : Promise<any> {
        // Get the sys info from our local server
        return super.getSysInfo();
    }

    private async onCatchupRequest(args: object) : Promise<void> {
        if (args.hasOwnProperty('since')) {
            const service = await this.waitForService();
            if (service) {
                // Send results for all responses that are left.
                this.responseBacklog.forEach(r => {
                    service.notify(LiveShareCommands.serverResponse, r);
                });

                // Eliminate old responses if possible.
                this.catchupPendingCount -= 1;
                if (this.catchupPendingCount <= 0) {
                    this.responseBacklog = [];
                }
            }
        }
    }

    private wrapObservableResult(code: string, observable: Observable<ICell[]>, id: string) : Observable<ICell[]> {
        return new Observable(subscriber => {
            let pos = 0;

            // Listen to all of the events on the observable passed in.
            observable.subscribe(cells => {
                // Forward to the next listener
                subscriber.next(cells);

                // Send across to the guest side
                try {
                    const translated = cells.map(c => this.translateCellForGuest(c));
                    this.postObservableNext(code, pos, translated, id);
                    pos += 1;
                } catch (e) {
                    subscriber.error(e);
                    this.postException(e);
                }
            },
            e => {
                subscriber.error(e);
                this.postException(e);
            },
            () => {
                subscriber.complete();
                this.postObservableComplete(code, pos, id);
            });
        });
    }

    private postObservableNext(code: string, pos: number, cells: ICell[], id: string) {
        this.postResult(ServerResponseType.ExecuteObservable, { code, pos, type: ServerResponseType.ExecuteObservable, cells, id, time: Date.now() });
    }

    private postObservableComplete(code: string, pos: number, id: string) {
        this.postResult(ServerResponseType.ExecuteObservable, { code, pos, type: ServerResponseType.ExecuteObservable, cells: undefined, id, time: Date.now() });
    }

    private postException(exc: any) {
        this.postResult(ServerResponseType.Exception, {type: ServerResponseType.Exception, time: Date.now(), message: exc.toString()});
    }

    private postResult<R extends IResponseMapping, T extends keyof R>(type: T, result: R[T]) : void {
            const typedResult = ((result as any) as IServerResponse);
            if (typedResult) {
                this.waitForService().then(s => {
                    if (s) {
                        s.notify(LiveShareCommands.serverResponse, typedResult);
                    }
                }).ignoreErrors();

                // Need to also save in memory for those guests that are in the middle of starting up
                this.responseBacklog.push(typedResult);
            }
    }
}
