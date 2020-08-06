// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import type { KernelMessage } from '@jupyterlab/services';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { CancellationToken, Event, EventEmitter, Uri } from 'vscode';
import { ServerStatus } from '../../../../datascience-ui/interactive-common/mainState';
import { traceError } from '../../../common/logger';
import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { getDefaultNotebookContent, updateNotebookMetadata } from '../../notebookStorage/baseModel';
import type {
    ICell,
    IJupyterKernelSpec,
    INotebook,
    INotebookProvider,
    INotebookProviderConnection,
    InterruptResult,
    KernelSocketInformation
} from '../../types';
import type { IKernel, KernelSelection, LiveKernelModel } from './types';

export class Kernel implements IKernel {
    get connection(): INotebookProviderConnection | undefined {
        return this._notebook?.connection;
    }
    get kernelSpec(): IJupyterKernelSpec | LiveKernelModel | undefined {
        if (this._notebook) {
            return this._notebook.getKernelSpec();
        }
        return this._metadata.kernelSpec || this._metadata.kernelModel;
    }
    get onStatusChanged(): Event<ServerStatus> {
        return this._onStatusChanged.event;
    }
    get onRestarted(): Event<void> {
        return this._onRestarted.event;
    }
    get onDisposed(): Event<void> {
        return this._onDisposed.event;
    }
    get status(): ServerStatus {
        return this._notebook?.status ?? ServerStatus.NotStarted;
    }
    get disposed(): boolean {
        return this._disposed === true || this._notebook?.disposed === true;
    }
    get kernelSocket(): Observable<KernelSocketInformation | undefined> {
        return this._kernelSocket.asObservable();
    }
    private _disposed?: boolean;
    private readonly _kernelSocket = new Subject<KernelSocketInformation | undefined>();
    private readonly _onStatusChanged = new EventEmitter<ServerStatus>();
    private readonly _onRestarted = new EventEmitter<void>();
    private readonly _onDisposed = new EventEmitter<void>();
    private _notebook?: INotebook;
    private _notebookPromise?: Promise<INotebook | undefined>;
    private readonly hookedNotebookForEvents = new WeakSet<INotebook>();
    private restarting?: Deferred<void>;
    constructor(
        public readonly uri: Uri,
        private readonly _metadata: KernelSelection,
        private readonly notebookProvider: INotebookProvider,
        private readonly disposables: IDisposableRegistry,
        private readonly waitForIdleTimeoutMs: number,
        private readonly launchingFile?: string
    ) {}
    public executeObservable(
        code: string,
        file: string,
        line: number,
        id: string,
        silent: boolean
    ): Observable<ICell[]> {
        if (!this._notebook) {
            throw new Error('executeObservable cannot be called if kernel has not been started!');
        }
        this._notebook.clear(id);
        return this._notebook.executeObservable(code, file, line, id, silent);
    }
    public async start(options?: { disableUI?: boolean; token?: CancellationToken }): Promise<void> {
        if (this.restarting) {
            await this.restarting.promise;
        }
        if (this._notebookPromise) {
            await this._notebookPromise;
            return;
        } else {
            const metadata = ((getDefaultNotebookContent().metadata || {}) as unknown) as nbformat.INotebookMetadata;
            updateNotebookMetadata(
                metadata,
                this._metadata.interpreter,
                this._metadata.kernelSpec || this._metadata.kernelModel
            );

            this._notebookPromise = this.notebookProvider.getOrCreateNotebook({
                identity: this.uri,
                resource: this.uri,
                disableUI: options?.disableUI,
                getOnly: false,
                metadata,
                token: options?.token
            });

            this._notebookPromise
                .then((nb) => (this._notebook = nb))
                .catch((ex) => traceError('failed to create INotebook in kernel', ex));
            await this._notebookPromise;
            await this.initializeAfterStart();
        }
    }
    public async interrupt(timeoutInMs: number): Promise<InterruptResult> {
        if (this.restarting) {
            await this.restarting.promise;
        }
        if (!this._notebook) {
            throw new Error('No notebook to interrupt');
        }
        return this._notebook.interruptKernel(timeoutInMs);
    }
    public async dispose(): Promise<void> {
        this.restarting = undefined;
        if (this._notebook) {
            await this._notebook.dispose();
            this._disposed = true;
            this._onDisposed.fire();
            this._onStatusChanged.fire(ServerStatus.Dead);
            this._notebook = undefined;
        }
    }
    public async restart(timeoutInMs: number): Promise<void> {
        if (this.restarting) {
            return this.restarting.promise;
        }
        if (this._notebook) {
            this.restarting = createDeferred<void>();
            try {
                await this._notebook.restartKernel(timeoutInMs);
                await this.initializeAfterStart();
                this.restarting.resolve();
            } catch (ex) {
                this.restarting.reject(ex);
            } finally {
                this.restarting = undefined;
            }
        }
    }
    public registerIOPubListener(listener: (msg: KernelMessage.IIOPubMessage, requestId: string) => void): void {
        if (!this._notebook) {
            throw new Error('Notebook not defined');
        }
        this._notebook.registerIOPubListener(listener);
    }
    private async initializeAfterStart() {
        if (!this._notebook) {
            return;
        }
        if (!this.hookedNotebookForEvents.has(this._notebook)) {
            this.hookedNotebookForEvents.add(this._notebook);
            this._notebook.kernelSocket.subscribe(this._kernelSocket);
            this._notebook.onDisposed(() => {
                this._onDisposed.fire();
            });
            this._notebook.onKernelRestarted(() => {
                this._onRestarted.fire();
            });
            this._notebook.onSessionStatusChanged((e) => this._onStatusChanged.fire(e), this, this.disposables);
        }
        if (this.launchingFile) {
            await this._notebook.setLaunchingFile(this.launchingFile);
        }
        await this._notebook.waitForIdle(this.waitForIdleTimeoutMs);
    }
}
