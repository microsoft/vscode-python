// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as util from 'util';
import { Event, EventEmitter, Uri } from 'vscode';
import { traceInfo } from '../../common/logger';
import { IDisposable } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { deserializeDataViews, serializeDataViews } from '../../common/utils/serializers';
import { IInteractiveWindowMapping, IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';
import { INotebook, INotebookProvider, KernelSocketInformation } from '../types';
import { IIPyWidgetMessageDispatcher, IPyWidgetMessage } from './types';

// tslint:disable: no-any
/**
 * This class maps between messages from the react code and talking to a real kernel.
 */
export class IPyWidgetMessageDispatcher implements IIPyWidgetMessageDispatcher {
    public get postMessage(): Event<IPyWidgetMessage> {
        return this._postMessageEmitter.event;
    }
    private readonly commTargetsRegistered = new Set<string>();
    private jupyterLab?: typeof import('@jupyterlab/services');
    private pendingTargetNames = new Set<string>();
    private notebook?: INotebook;
    private _postMessageEmitter = new EventEmitter<IPyWidgetMessage>();

    private readonly disposables: IDisposable[] = [];
    private kernelRestartHandlerAttached = false;
    private kernelSocketInfo?: KernelSocketInformation;
    private disposed = false;
    private queuedMessages: string[] = [];
    private readonly uiIsReady = createDeferred();
    constructor(private readonly notebookProvider: INotebookProvider, public readonly notebookIdentity: Uri) {
        // Always register this comm target.
        // Possible auto start is disabled, and when cell is executed with widget stuff, this comm target will not have
        // been reigstered, in which case kaboom. As we know this is always required, pre-register this.
        this.pendingTargetNames.add('jupyter.widget');
        notebookProvider.onNotebookCreated((e) => {
            if (e.identity.toString() === notebookIdentity.toString()) {
                this.initialize().ignoreErrors();
            }
        });
    }
    public dispose() {
        this.disposed = true;
        while (this.disposables.length) {
            const disposable = this.disposables.shift();
            disposable?.dispose(); // NOSONAR
        }
    }

    public receiveMessage(message: IPyWidgetMessage): void {
        traceInfo(`IPyWidgetMessage: ${util.inspect(message)}`);
        switch (message.message) {
            case IPyWidgetMessages.IPyWidgets_Ready:
                this.sendKernelOptions();
                this.initialize().ignoreErrors();
                break;
            case IPyWidgetMessages.IPyWidgets_msg:
                this.sendRawPayloadToKernelSocket(message.payload);
                break;
            case IPyWidgetMessages.IPyWidgets_binary_msg:
                this.sendRawPayloadToKernelSocket(deserializeDataViews(message.payload)![0]);
                break;
            case IPyWidgetMessages.IPyWidgets_registerCommTarget:
                this.uiIsReady.resolve();
                this.registerCommTarget(message.payload).ignoreErrors();

                break;

            default:
                break;
        }
    }
    public sendRawPayloadToKernelSocket(payload?: any) {
        this.queuedMessages.push(payload);
        this.sendPendingMessages();
    }
    public async registerCommTarget(targetName: string) {
        this.pendingTargetNames.add(targetName);
        await this.initialize();
    }

    public async initialize() {
        if (!this.jupyterLab) {
            // Lazy load jupyter lab for faster extension loading.
            // tslint:disable-next-line:no-require-imports
            this.jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services'); // NOSONAR
        }

        // If we have any pending targets, register them now
        const notebook = await this.getNotebook();
        if (notebook) {
            this.initilizeKernelSocket(notebook);
            this.registerCommTargets(notebook);
        }
    }
    protected raisePostMessage<M extends IInteractiveWindowMapping, T extends keyof IInteractiveWindowMapping>(
        message: IPyWidgetMessages,
        payload: M[T]
    ) {
        this._postMessageEmitter.fire({ message, payload });
    }

    private initilizeKernelSocket(notebook: INotebook) {
        notebook.kernelSocket
            .then((info) => {
                if (info.socket === this.kernelSocketInfo?.socket) {
                    return;
                }
                // Remove old handlers.
                this.kernelSocketInfo?.socket?.removeListener('message', this.onKernelSocketMessage.bind(this));
                this.kernelSocketInfo = info;
                this.kernelSocketInfo.socket.addListener('message', this.onKernelSocketMessage.bind(this));

                this.sendKernelOptions();
                // Since we have connected to a kernel, send any pending messages.
                this.registerCommTargets(notebook);
                this.sendPendingMessages();
            })
            .ignoreErrors();
    }
    /**
     * Pass this information to UI layer so it can create a dummy kernel with same information.
     * Information includes kernel connection info (client id, user name, model, etc).
     */
    private sendKernelOptions() {
        if (!this.kernelSocketInfo) {
            return;
        }
        this.raisePostMessage(IPyWidgetMessages.IPyWidgets_kernelOptions, this.kernelSocketInfo.options);
    }
    private onKernelSocketMessage(message: any) {
        if (typeof message === 'string') {
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_msg, message);
        } else {
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_binary_msg, serializeDataViews([message]));
        }
    }
    private sendPendingMessages() {
        if (!this.notebook || !this.kernelSocketInfo) {
            return;
        }
        while (this.queuedMessages.length) {
            try {
                this.kernelSocketInfo.socket.send(this.queuedMessages[0]);
                this.queuedMessages.shift();
            } catch (ex) {
                return;
            }
        }
    }

    private registerCommTargets(notebook: INotebook) {
        while (this.pendingTargetNames.size > 0) {
            const targetNames = Array.from([...this.pendingTargetNames.values()]);
            const targetName = targetNames.shift();
            if (!targetName) {
                continue;
            }
            if (this.commTargetsRegistered.has(targetName)) {
                // Already registered.
                return;
            }

            this.commTargetsRegistered.add(targetName);
            this.pendingTargetNames.delete(targetName);
            notebook.registerCommTarget(targetName, noop);
        }
    }

    private async getNotebook(): Promise<INotebook | undefined> {
        if (this.notebookIdentity && !this.notebook) {
            this.notebook = await this.notebookProvider.getOrCreateNotebook({
                identity: this.notebookIdentity,
                getOnly: true
            });
        }
        if (this.notebook && !this.kernelRestartHandlerAttached) {
            this.kernelRestartHandlerAttached = true;
            this.disposables.push(this.notebook.onKernelRestarted(this.handleKernelRestarts, this));
        }
        return this.notebook;
    }
    /**
     * When a kernel restarts, we need to ensure the comm targets are re-registered.
     * This must happen before anything else is processed.
     */
    private async handleKernelRestarts() {
        if (this.disposed || this.commTargetsRegistered.size === 0 || !this.notebook) {
            return;
        }
        // Ensure we re-register the comm targets.
        Array.from(this.commTargetsRegistered.keys()).forEach((targetName) => {
            this.commTargetsRegistered.delete(targetName);
            this.pendingTargetNames.add(targetName);
        });

        this.initilizeKernelSocket(this.notebook);
        this.registerCommTargets(this.notebook);
    }
}
