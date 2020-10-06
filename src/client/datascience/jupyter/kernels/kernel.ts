// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import * as uuid from 'uuid/v4';
import {
    CancellationToken,
    CancellationTokenSource,
    Event,
    EventEmitter,
    NotebookCell,
    NotebookDocument,
    Uri
} from 'vscode';
import { ServerStatus } from '../../../../datascience-ui/interactive-common/mainState';
import { IApplicationShell, ICommandManager, IVSCodeNotebook } from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { noop } from '../../../common/utils/misc';
import { IInterpreterService } from '../../../interpreter/contracts';
import { CodeSnippets } from '../../constants';
import { getDefaultNotebookContent, updateNotebookMetadata } from '../../notebookStorage/baseModel';
import {
    IDataScienceErrorHandler,
    INotebook,
    INotebookEditorProvider,
    INotebookProvider,
    INotebookProviderConnection,
    InterruptResult,
    KernelSocketInformation
} from '../../types';
import { isPythonKernelConnection } from './helpers';
import { KernelExecution } from './kernelExecution';
import type { IKernel, IKernelProvider, IKernelSelectionUsage, KernelConnectionMetadata } from './types';

export class Kernel implements IKernel {
    get connection(): INotebookProviderConnection | undefined {
        return this.notebook?.connection;
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
        return this.notebook?.status ?? ServerStatus.NotStarted;
    }
    get disposed(): boolean {
        return this._disposed === true || this.notebook?.disposed === true;
    }
    get kernelSocket(): Observable<KernelSocketInformation | undefined> {
        return this._kernelSocket.asObservable();
    }
    private notebook?: INotebook;
    private _disposed?: boolean;
    private readonly _kernelSocket = new Subject<KernelSocketInformation | undefined>();
    private readonly _onStatusChanged = new EventEmitter<ServerStatus>();
    private readonly _onRestarted = new EventEmitter<void>();
    private readonly _onDisposed = new EventEmitter<void>();
    private _notebookPromise?: Promise<INotebook | undefined>;
    private readonly hookedNotebookForEvents = new WeakSet<INotebook>();
    private restarting?: Deferred<void>;
    private readonly kernelValidated = new Map<string, { kernel: IKernel; promise: Promise<void> }>();
    private readonly kernelExecution: KernelExecution;
    private startCancellation = new CancellationTokenSource();
    constructor(
        public readonly uri: Uri,
        public readonly metadata: Readonly<KernelConnectionMetadata>,
        private readonly notebookProvider: INotebookProvider,
        private readonly disposables: IDisposableRegistry,
        private readonly launchTimeout: number,
        commandManager: ICommandManager,
        interpreterService: IInterpreterService,
        private readonly errorHandler: IDataScienceErrorHandler,
        editorProvider: INotebookEditorProvider,
        private readonly kernelProvider: IKernelProvider,
        private readonly kernelSelectionUsage: IKernelSelectionUsage,
        appShell: IApplicationShell,
        vscNotebook: IVSCodeNotebook
    ) {
        this.kernelExecution = new KernelExecution(
            kernelProvider,
            commandManager,
            interpreterService,
            errorHandler,
            editorProvider,
            kernelSelectionUsage,
            appShell,
            vscNotebook
        );
    }
    public async executeCell(cell: NotebookCell): Promise<void> {
        await this.start({ disableUI: false, token: this.startCancellation.token });
        await this.kernelExecution.executeCell(cell);
    }
    public async executeAllCells(document: NotebookDocument): Promise<void> {
        await this.start({ disableUI: false, token: this.startCancellation.token });
        await this.kernelExecution.executeAllCells(document);
    }
    public async cancelCell(cell: NotebookCell) {
        this.startCancellation.cancel();
        await this.kernelExecution.cancelCell(cell);
    }
    public async cancelAllCells(document: NotebookDocument) {
        this.startCancellation.cancel();
        this.kernelExecution.cancelAllCells(document);
    }
    public async start(options?: { disableUI?: boolean; token?: CancellationToken }): Promise<void> {
        if (this.restarting) {
            await this.restarting.promise;
        }
        if (this._notebookPromise) {
            await this._notebookPromise;
            return;
        } else {
            await this.validate(this.uri);
            const metadata = ((getDefaultNotebookContent().metadata || {}) as unknown) as nbformat.INotebookMetadata;
            updateNotebookMetadata(metadata, this.metadata);

            this._notebookPromise = this.notebookProvider.getOrCreateNotebook({
                identity: this.uri,
                resource: this.uri,
                disableUI: options?.disableUI,
                getOnly: false,
                metadata,
                token: options?.token
            });

            this._notebookPromise
                .then((nb) => (this.kernelExecution.notebook = this.notebook = nb))
                .catch((ex) => {
                    traceError('failed to create INotebook in kernel', ex);
                    this._notebookPromise = undefined;
                    this.startCancellation.cancel();
                    this.errorHandler.handleError(ex).ignoreErrors(); // Just a notification, so don't await this
                });
            await this._notebookPromise;
            await this.initializeAfterStart();
        }
    }
    public async interrupt(): Promise<InterruptResult> {
        if (this.restarting) {
            await this.restarting.promise;
        }
        if (!this.notebook) {
            throw new Error('No notebook to interrupt');
        }
        return this.notebook.interruptKernel(this.launchTimeout);
    }
    public async dispose(): Promise<void> {
        this.restarting = undefined;
        this._notebookPromise = undefined;
        if (this.notebook) {
            await this.notebook.dispose();
            this._disposed = true;
            this._onDisposed.fire();
            this._onStatusChanged.fire(ServerStatus.Dead);
            this.notebook = undefined;
            this.kernelExecution.notebook = undefined;
        }
        this.kernelExecution.dispose();
    }
    public async restart(): Promise<void> {
        if (this.restarting) {
            return this.restarting.promise;
        }
        if (this.notebook) {
            this.restarting = createDeferred<void>();
            try {
                await this.notebook.restartKernel(this.launchTimeout);
                await this.initializeAfterStart();
                this.restarting.resolve();
            } catch (ex) {
                this.restarting.reject(ex);
            } finally {
                this.restarting = undefined;
            }
        }
    }
    private async validate(uri: Uri): Promise<void> {
        const kernel = this.kernelProvider.get(uri);
        if (!kernel) {
            return;
        }
        const key = uri.toString();
        if (!this.kernelValidated.get(key)) {
            const promise = new Promise<void>((resolve) =>
                this.kernelSelectionUsage
                    .useSelectedKernel(kernel?.metadata, uri, 'raw')
                    .finally(() => {
                        // If still using the same promise, then remove the exception information.
                        // Basically if there's an exception, then we cannot use the kernel and a message would have been displayed.
                        // We don't want to cache such a promise, as its possible the user later installs the dependencies.
                        if (this.kernelValidated.get(key)?.kernel === kernel) {
                            this.kernelValidated.delete(key);
                        }
                    })
                    .finally(resolve)
                    .catch(noop)
            );

            this.kernelValidated.set(key, { kernel, promise });
        }
        await this.kernelValidated.get(key)!.promise;
    }
    private async initializeAfterStart() {
        if (!this.notebook) {
            return;
        }
        this.disableJedi();
        if (!this.hookedNotebookForEvents.has(this.notebook)) {
            this.hookedNotebookForEvents.add(this.notebook);
            this.notebook.kernelSocket.subscribe(this._kernelSocket);
            this.notebook.onDisposed(() => {
                this._notebookPromise = undefined;
                this._onDisposed.fire();
            });
            this.notebook.onKernelRestarted(() => {
                this._onRestarted.fire();
            });
            this.notebook.onSessionStatusChanged((e) => this._onStatusChanged.fire(e), this, this.disposables);
        }
        if (isPythonKernelConnection(this.metadata)) {
            await this.notebook.setLaunchingFile(this.uri.fsPath);
        }
        await this.notebook.waitForIdle(this.launchTimeout);
    }

    private disableJedi() {
        if (isPythonKernelConnection(this.metadata) && this.notebook) {
            this.notebook.executeObservable(CodeSnippets.disableJedi, this.uri.fsPath, 0, uuid(), true);
        }
    }
}
