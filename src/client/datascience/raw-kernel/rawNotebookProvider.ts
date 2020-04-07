// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ILiveShareApi } from '../../common/application/types';
// RAWKERNEL: Enable when experiment is in
//import { LocalZMQKernel } from '../../common/experimentGroups';
import '../../common/extensions';
import { traceError, traceInfo } from '../../common/logger';
import { IAsyncDisposableRegistry, IConfigurationService, IExperimentsManager, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { sendTelemetryEvent } from '../../telemetry';
import { Settings, Telemetry } from '../constants';
import { INotebook, IRawConnection, IRawNotebookProvider } from '../types';

class RawConnection implements IRawConnection {
    public readonly type = 'raw';
    public readonly localLaunch = true;
    public readonly valid = true;
    public readonly displayName = localize.DataScience.rawConnectionDisplayName();
    private eventEmitter: EventEmitter<number> = new EventEmitter<number>();

    public dispose() {
        noop();
    }
    public get disconnected(): Event<number> {
        return this.eventEmitter.event;
    }
}

export class RawNotebookProviderBase implements IRawNotebookProvider {
    public get id(): string {
        return this._id;
    }
    // Keep track of the notebooks that we have provided
    private notebooks = new Map<string, Promise<INotebook>>();
    private _zmqSupported: boolean | undefined;
    private rawConnection = new RawConnection();
    private _id = uuid();

    constructor(
        _liveShare: ILiveShareApi,
        private asyncRegistry: IAsyncDisposableRegistry,
        private configuration: IConfigurationService,
        _experimentsManager: IExperimentsManager
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
        identity: Uri,
        resource: Resource,
        notebookMetadata: nbformat.INotebookMetadata,
        cancelToken: CancellationToken
    ): Promise<INotebook> {
        return this.createNotebookInstance(resource, identity, notebookMetadata, cancelToken);
    }

    public async getNotebook(identity: Uri): Promise<INotebook | undefined> {
        return this.notebooks.get(identity.toString());
    }

    public dispose(): Promise<void> {
        throw new Error('Not implemented');
    }

    // This may be a bit of a noop in the raw case
    public getDisposedError(): Error {
        return new Error(localize.DataScience.rawConnectionBrokenError());
    }

    protected getConnection(): IRawConnection {
        return this.rawConnection;
    }

    protected setNotebook(identity: Uri, notebook: Promise<INotebook>) {
        const removeNotebook = () => {
            if (this.notebooks.get(identity.toString()) === notebook) {
                this.notebooks.delete(identity.toString());
            }
        };

        notebook
            .then(nb => {
                const oldDispose = nb.dispose;
                nb.dispose = () => {
                    this.notebooks.delete(identity.toString());
                    return oldDispose();
                };
            })
            .catch(removeNotebook);

        // Save the notebook
        this.notebooks.set(identity.toString(), notebook);
    }

    protected createNotebookInstance(
        _resource: Resource,
        _identity: Uri,
        _notebookMetadata?: nbformat.INotebookMetadata,
        _cancelToken?: CancellationToken
    ): Promise<INotebook> {
        throw new Error('You forgot to override createNotebookInstance');
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
        return false;
        // RAWKERNEL: Current experiements are loading from a local cache which doesn't include
        // my new experiment value, so I can't even opt into it
        //return this.experimentsManager.inExperiment(LocalZMQKernel.experiment);
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
}
