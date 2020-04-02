// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Event, EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ILiveShareApi } from '../../common/application/types';
import { LocalZMQKernel } from '../../common/experimentGroups';
import '../../common/extensions';
import { traceError, traceInfo } from '../../common/logger';
import { IAsyncDisposableRegistry, IConfigurationService, IExperimentsManager, Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { Settings, Telemetry } from '../constants';
import { INotebook, IRawConnection, IRawNotebookProvider } from '../types';

export class RawNotebookProviderBase implements IRawNotebookProvider {
    // Keep track of the notebooks that we have provided
    private notebooks = new Map<string, Promise<INotebook>>();
    private _zmqSupported: boolean | undefined;
    private rawConnection = new RawConnection();

    constructor(
        _liveShare: ILiveShareApi,
        private asyncRegistry: IAsyncDisposableRegistry,
        private configuration: IConfigurationService,
        private experimentsManager: IExperimentsManager
    ) {
        this.asyncRegistry.push(this);
    }

    // Check to see if this machine supports raw notebooks
    // It needs to be in the experiement, have ZMQ, and be a local launch scenario
    public async supported(): Promise<boolean> {
        const zmqOk = await this.zmqSupported();

        return zmqOk && this.localLaunch() && this.inExperiment() ? true : false;
    }

    public connect(): Promise<IRawConnection> {
        return Promise.resolve(this.rawConnection);
    }

    public async createNotebook(
        _identity: Uri,
        _resource: Resource,
        _notebookMetadata: nbformat.INotebookMetadata,
        _cancelToken: CancellationToken
    ): Promise<INotebook | undefined> {
        throw new Error('Not implemented');
    }

    public async getNotebook(_identity: Uri): Promise<INotebook | undefined> {
        throw new Error('Not implemented');
    }

    public dispose(): Promise<void> {
        throw new Error('Not implemented');
    }

    private localLaunch(): boolean {
        const settings = this.configuration.getSettings(undefined);
        const serverURI: string | undefined = settings.datascience.jupyterServerURI;

        if (!serverURI || serverURI.toLowerCase() === Settings.JupyterServerLocalLaunch) {
            return true;
        }

        return false;
    }

    private inExperiment(): boolean {
        return this.experimentsManager.inExperiment(LocalZMQKernel.experiment);
    }

    private async zmqSupported(): Promise<boolean> {
        if (this._zmqSupported) {
            return this._zmqSupported;
        }

        try {
            await import('zeromq');
            traceInfo(`ZMQ install verified.`);
            this._zmqSupported = true;
        } catch (e) {
            traceError(`Exception while attempting zmq :`, e);
            sendTelemetryEvent(Telemetry.ZMQNotSupported);
            this._zmqSupported = false;
        }

        return this._zmqSupported;
    }

    //protected createNotebookInstance(
    //_resource: Resource,
    //_identity: Uri,
    //_sessionManager: IJupyterSessionManager,
    //_savedSession: IJupyterSession | undefined,
    //_disposableRegistry: IDisposableRegistry,
    //_configService: IConfigurationService,
    //_serviceContainer: IServiceContainer,
    //_notebookMetadata?: nbformat.INotebookMetadata,
    //_cancelToken?: CancellationToken
    //): Promise<INotebook> {
    //throw new Error('You forgot to override createNotebookInstance');
    //}
}

class RawConnection implements IRawConnection {
    public readonly type = 'raw';
    public readonly localLaunch = true;
    public readonly valid = true;
    // IANHU: Localize?
    public readonly displayName = 'Raw Connection';
    private eventEmitter: EventEmitter<number> = new EventEmitter<number>();

    public dispose() {
        noop();
    }
    public get disconnected(): Event<number> {
        return this.eventEmitter.event;
    }
}
