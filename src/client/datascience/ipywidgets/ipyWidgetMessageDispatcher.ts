// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as util from 'util';
import { Event, EventEmitter, Uri } from 'vscode';
import { traceError, traceInfo } from '../../common/logger';
import { IDisposable } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { deserializeDataViews, serializeDataViews } from '../../common/utils/serializers';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages,
    IPyWidgetMessages
} from '../interactive-common/interactiveWindowTypes';
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
    private kernelRestartHandlerAttached?: boolean;
    private kernelSocketInfo?: KernelSocketInformation;
    private kernelWasConnectedAtleastOnce?: boolean;
    private disposed = false;
    private pendingMessages: string[] = [];
    private subscribedToKernelSocket: boolean = false;
    constructor(private readonly notebookProvider: INotebookProvider, public readonly notebookIdentity: Uri) {
        // Always register this comm target.
        // Possible auto start is disabled, and when cell is executed with widget stuff, this comm target will not have
        // been reigstered, in which case kaboom. As we know this is always required, pre-register this.
        this.pendingTargetNames.add('jupyter.widget');
        notebookProvider.onNotebookCreated(
            (e) => {
                if (e.identity.toString() === notebookIdentity.toString()) {
                    this.initialize().ignoreErrors();
                }
            },
            this,
            this.disposables
        );
    }
    public dispose() {
        this.disposed = true;
        while (this.disposables.length) {
            const disposable = this.disposables.shift();
            disposable?.dispose(); // NOSONAR
        }
    }

    public receiveMessage(message: IPyWidgetMessage | { message: InteractiveWindowMessages.RestartKernel }): void {
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
            // case InteractiveWindowMessages.RestartKernel:
            // Bug in code, we send this same message from extension side when already restarting.
            //     // When restarting a kernel do not send anything to kernel, as it doesn't exist anymore.
            //     this.raisePostMessage(IPyWidgetMessages.IPyWidgets_onRestartKernel, undefined);
            //     this.kernelSocketInfo = undefined;
            //     while (this.pendingMessages.length) {
            //         this.pendingMessages.shift();
            //     }
            //     break;
            case IPyWidgetMessages.IPyWidgets_registerCommTarget:
                this.registerCommTarget(message.payload).ignoreErrors();
                break;

            default:
                break;
        }
    }
    public sendRawPayloadToKernelSocket(payload?: any) {
        this.pendingMessages.push(payload);
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
            this.subscribeToKernelSocket(notebook);
            this.registerCommTargets(notebook);
        }
    }
    protected raisePostMessage<M extends IInteractiveWindowMapping, T extends keyof IInteractiveWindowMapping>(
        message: IPyWidgetMessages,
        payload: M[T]
    ) {
        this._postMessageEmitter.fire({ message, payload });
    }
    private subscribeToKernelSocket(notebook: INotebook) {
        if (this.subscribedToKernelSocket) {
            return;
        }
        this.subscribedToKernelSocket = true;
        // Listen to changes to kernel socket (e.g. restarts or changes to kernel).
        notebook.kernelSocket.subscribe((info) => {
            // Remove old handlers.
            this.kernelSocketInfo?.socket?.removeListener('message', this.onKernelSocketMessage.bind(this)); // NOSONAR

            if (this.kernelWasConnectedAtleastOnce) {
                // this means we restarted the kernel and we now have new information.
                // Discard all of the messages upto this point.
                while (this.pendingMessages.length) {
                    this.pendingMessages.shift();
                }
                // When restarting a kernel do not send anything to kernel, as it doesn't exist anymore.
                this.raisePostMessage(IPyWidgetMessages.IPyWidgets_onRestartKernel, undefined);
            }
            if (!info || !info.socket) {
                // No kernel socket information, hence nothing much we can do.
                this.kernelSocketInfo = undefined;
                return;
            }

            this.kernelWasConnectedAtleastOnce = true;
            this.kernelSocketInfo = info;
            this.kernelSocketInfo.socket?.addListener('message', this.onKernelSocketMessage.bind(this)); // NOSONAR
            this.sendKernelOptions();
            // Since we have connected to a kernel, send any pending messages.
            this.registerCommTargets(notebook);
            this.sendPendingMessages();
        });
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
        while (this.pendingMessages.length) {
            try {
                this.kernelSocketInfo.socket?.send(this.pendingMessages[0]); // NOSONAR
                this.pendingMessages.shift();
            } catch (ex) {
                traceError('Failed to send message to Kernel', ex);
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

        this.subscribeToKernelSocket(this.notebook);
        this.registerCommTargets(this.notebook);
    }
}
