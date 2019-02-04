// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Observable } from 'rxjs/Observable';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode-jsonrpc';
import * as vsls from 'vsls/vscode';

import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, ILogger } from '../../../common/types';
import { LiveShare, LiveShareJupyterCommands } from '../../constants';
import { ICell, IJupyterSessionManager, InterruptResult } from '../../types';
import { JupyterServerBase } from '../jupyterServerBase';
import { ServerResponse, ServerResponseType } from './serverResponse';

export class HostJupyterServer extends JupyterServerBase {
    private service: Promise<vsls.SharedService | undefined>;

    constructor(
        logger: ILogger,
        disposableRegistry: IDisposableRegistry,
        asyncRegistry: IAsyncDisposableRegistry,
        configService: IConfigurationService,
        sessionManager: IJupyterSessionManager) {
        super(logger, disposableRegistry, asyncRegistry, configService, sessionManager);
        this.service = this.startSharedService();
    }

    public async dispose(): Promise<void> {
        await super.dispose();
        const api = await vsls.getApiAsync();
        api.unshareService(LiveShare.JupyterServerSharedService);
    }

    public async execute(code: string, file: string, line: number, cancelToken?: CancellationToken): Promise<ICell[]> {
        try {
            const result = await super.execute(code, file, line, cancelToken);

            // Send the result to the guest side too
            await this.postResult({ type: ServerResponseType.Execute, cells: result });
            return result;
        } catch(exc) {
            await this.postResult({type: ServerResponseType.Exception, message: exc.toString()});
            throw exc;
        }
    }

    public executeObservable(code: string, file: string, line: number, id?: string): Observable<ICell[]> {
        try {
            const result = super.executeObservable(code, file, line, id);

            // Generate a new id or use the one passed in to identify everything that happened
            const newId = id ? id : uuid();

            // Generate a series of responses for each result
            result.forEach(n => this.postResult({ type: ServerResponseType.ExecuteObservable, id: newId, cells: n }))
                .then(v => this.postResult({ type: ServerResponseType.ExecuteObservable, id: newId, cells: undefined }));

            return result;
        } catch (exc) {
            this.postResult({type: ServerResponseType.Exception, message: exc.toString()});
            throw exc;
        }

    }

    public async restartKernel(): Promise<void> {
        try {
            await super.restartKernel();
            this.postResult({type: ServerResponseType.Restart});
        } catch (exc) {
            this.postResult({type: ServerResponseType.Exception, message: exc.toString()});
            throw exc;
        }
    }

    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        try {
            const result = await super.interruptKernel(timeoutMs);
            this.postResult({type: ServerResponseType.Interrupt, result});
            return result;
        } catch (exc) {
            this.postResult({type: ServerResponseType.Exception, message: exc.toString()});
            throw exc;
        }
    }

    private async startSharedService() : Promise<vsls.SharedService | undefined> {
        const api = await vsls.getApiAsync();

        if (api) {
            return api.shareService(LiveShare.JupyterServerSharedService);
        }
    }

    private async postResult<T extends ServerResponse>(result: T) : Promise<void> {
        const service = await this.service;
        service.notify(LiveShareJupyterCommands.serverResponse, result);
    }


}
