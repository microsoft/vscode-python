// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ILiveShareApi } from '../../common/application/types';
import { LocalZMQKernel } from '../../common/experiments/groups';
import '../../common/extensions';
import { traceError, traceInfo } from '../../common/logger';
import { IAsyncDisposableRegistry, IConfigurationService, IExperimentsManager, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Settings, Telemetry } from '../constants';
import { INotebook, IRawConnection, IRawNotebookProvider } from '../types';

export class RawConnection implements IRawConnection {
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
    private rawConnection = new RawConnection();
    private _id = uuid();
    private _zmqSupported: boolean | undefined;

    constructor(
        _liveShare: ILiveShareApi,
        private asyncRegistry: IAsyncDisposableRegistry,
        private configuration: IConfigurationService,
        private experimentsManager: IExperimentsManager
    ) {
        this.asyncRegistry.push(this);
    }

    public connect(): Promise<IRawConnection> {
        return Promise.resolve(this.rawConnection);
    }

    // Check to see if we have all that we need for supporting raw kernel launch
    public async supported(): Promise<boolean> {
        return this.localLaunch() && this.experimentEnabled() && (await this.zmqSupported()) ? true : false;
    }

    @captureTelemetry(Telemetry.RawKernelCreatingNotebook, undefined, true)
    public async createNotebook(
        identity: Uri,
        resource: Resource,
        disableUI: boolean,
        notebookMetadata: nbformat.INotebookMetadata,
        cancelToken?: CancellationToken
    ): Promise<INotebook> {
        return this.createNotebookInstance(resource, identity, disableUI, notebookMetadata, cancelToken);
    }

    public async getNotebook(identity: Uri): Promise<INotebook | undefined> {
        return this.notebooks.get(identity.toString());
    }

    public async dispose(): Promise<void> {
        traceInfo(`Shutting down notebooks for ${this.id}`);
        const notebooks = await Promise.all([...this.notebooks.values()]);
        await Promise.all(notebooks.map((n) => n?.dispose()));
    }

    // This may be a bit of a noop in the raw case
    public getDisposedError(): Error {
        return new Error(localize.DataScience.rawConnectionBrokenError());
    }

    protected getNotebooks(): Promise<INotebook>[] {
        return [...this.notebooks.values()];
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
            .then((nb) => {
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
        _disableUI?: boolean,
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

    // Enable if we are in our experiment or in the insiders channel
    private experimentEnabled(): boolean {
        return (
            this.experimentsManager.inExperiment(LocalZMQKernel.experiment) ||
            (this.configuration.getSettings().insidersChannel &&
                this.configuration.getSettings().insidersChannel !== 'off')
        );
    }

    // Check to see if this machine supports our local ZMQ launching
    private async zmqSupported(): Promise<boolean> {
        if (this._zmqSupported !== undefined) {
            return this._zmqSupported;
        }

        try {
            await import('zeromq');
            traceInfo(`ZMQ install verified.`);
            sendTelemetryEvent(Telemetry.ZMQSupported);
            this._zmqSupported = true;
        } catch (e) {
            traceError(`Exception while attempting zmq :`, e);
            sendTelemetryEvent(Telemetry.ZMQNotSupported);
            this._zmqSupported = false;
        }

        return this._zmqSupported;
    }
}
