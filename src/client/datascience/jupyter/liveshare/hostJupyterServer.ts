// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Observable } from 'rxjs/Observable';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import { LiveShare, LiveShareCommands } from '../../constants';
import { ICell, IJupyterSessionManager, InterruptResult, IDataScience } from '../../types';
import { JupyterServerBase } from '../jupyterServerBase';
import { ServerResponse, ServerResponseType, IResponseMapping } from './types';
import { ICatchupRequest } from './types';

export class HostJupyterServer extends JupyterServerBase {
    private service: Promise<vsls.SharedService | undefined>;
    private responseBacklog : { responseTime: number, response: ServerResponse }[] = [];

    constructor(
        dataScience: IDataScience,
        logger: ILogger,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManager) {
        super(dataScience, logger, disposableRegistry, asyncRegistry, configService, sessionManager);
        this.service = this.startSharedService();
    }

    public async dispose(): Promise<void> {
        await super.dispose();
        const api = await vsls.getApiAsync();
        api.unshareService(LiveShare.JupyterServerSharedService);
    }

    public executeObservable(code: string, file: string, line: number, id?: string): Observable<ICell[]> {
        try {
            const result = super.executeObservable(code, file, line, id);

            // Generate a new id or use the one passed in to identify everything that happened
            const newId = id ? id : uuid();
            const time = Date.now();

            // Generate a series of responses for each result
            result.forEach(n => this.postResult(ServerResponseType.ExecuteObservable, { type: ServerResponseType.ExecuteObservable, code, time, id: newId, cells: n }))
                .then(v => this.postResult(ServerResponseType.ExecuteObservable, { type: ServerResponseType.ExecuteObservable, code, time, id: newId, cells: undefined }));

            return result;
        } catch (exc) {
            this.postResult(ServerResponseType.Exception, {type: ServerResponseType.Exception, time: Date.now(), message: exc.toString()});
            throw exc;
        }

    }

    public async restartKernel(): Promise<void> {
        try {
            const time = Date.now();
            await super.restartKernel();
            this.postResult(ServerResponseType.Restart, {type: ServerResponseType.Restart, time});
        } catch (exc) {
            this.postResult(ServerResponseType.Exception, {type: ServerResponseType.Exception, time: Date.now(), message: exc.toString()});
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
            this.postResult(ServerResponseType.Exception, {type: ServerResponseType.Exception, time: Date.now(), message: exc.toString()});
            throw exc;
        }
    }

    private async startSharedService() : Promise<vsls.SharedService | undefined> {
        const api = await vsls.getApiAsync();

        if (api) {
            const service = await api.shareService(LiveShare.JupyterServerSharedService);

            // Listen to the request for responses
            service.onNotify(LiveShareCommands.catchupRequest, (args: object) => this.onCatchupRequest(service, args));

            return service;
        }
    }

    private onCatchupRequest(service: vsls.SharedService, args: object) {
        if (args.hasOwnProperty('since')) {
            const request = args as ICatchupRequest;

            // Send results for all of the responses that are after the start time
            this.responseBacklog.forEach(r => {
                if (r.responseTime >= request.since) {
                    service.notify(LiveShareCommands.serverResponse, r.response);

                    // Keep them in the response backlog as another guest may need them too
                }
            });
        }

    }

    private async postResult<R extends IResponseMapping, T extends keyof R>(type: T, result: R[T]) : Promise<void> {
        const service = await this.service;
        const typedResult = ((result as any) as ServerResponse);
        service.notify(LiveShareCommands.serverResponse, typedResult);

        // Need to also save in memory for those guests that are in the middle of starting up
        this.responseBacklog.push({ responseTime: Date.now(), response: typedResult });
    }
}
