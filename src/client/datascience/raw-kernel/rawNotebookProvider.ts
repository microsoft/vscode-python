// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { nbformat } from '@jupyterlab/coreutils';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ILiveShareApi } from '../../common/application/types';
import '../../common/extensions';
import { traceInfo } from '../../common/logger';
import { IAsyncDisposableRegistry, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import {
    ConnectNotebookProviderOptions,
    INotebook,
    IRawConnection,
    IRawNotebookProvider,
    IRawNotebookSupportedService
} from '../types';

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
    private rawConnection: IRawConnection | undefined;
    private _id = uuid();

    constructor(
        _liveShare: ILiveShareApi,
        private asyncRegistry: IAsyncDisposableRegistry,
        private rawNotebookSupportedService: IRawNotebookSupportedService
    ) {
        this.asyncRegistry.push(this);
    }

    public connect(options: ConnectNotebookProviderOptions): Promise<IRawConnection | undefined> {
        // For getOnly, we don't want to create a connection, even though we don't have a server
        // here we only want to be "connected" when requested to mimic jupyter server function
        if (options.getOnly) {
            return Promise.resolve(this.rawConnection);
        }

        // If not get only, create if needed and return
        if (!this.rawConnection) {
            this.rawConnection = new RawConnection();

            // Fire our optional event that we have created a connection
            if (options.onConnectionMade) {
                options.onConnectionMade();
            }
        }
        return Promise.resolve(this.rawConnection);
    }

    // Check to see if we have all that we need for supporting raw kernel launch
    public async supported(): Promise<boolean> {
        return this.rawNotebookSupportedService.supported();
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
        // At the time of getConnection force a connection if not created already
        // should always have happened already, but the check here lets us avoid returning undefined option
        if (!this.rawConnection) {
            this.rawConnection = new RawConnection();
        }
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
}
