// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri } from 'vscode';
import { IDisposable } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { IInteractiveWindowMapping, IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';
import { INotebook, INotebookProvider } from '../types';
import { restoreBuffers, serializeDataViews } from './serialization';
import { IIPyWidgetMessageDispatcher, IPyWidgetMessage } from './types';

// tslint:disable: no-any
/**
 * This class maps between messages from the react code and talking to a real kernel.
 */
export class IPyWidgetMessageDispatcher implements IIPyWidgetMessageDispatcher {
    public get postMessage(): Event<IPyWidgetMessage> {
        return this._postMessageEmitter.event;
    }
    private readonly commTargetsRegistered = new Map<string, KernelMessage.ICommOpenMsg | undefined>();
    private ioPubCallbackRegistered: boolean = false;
    private jupyterLab?: typeof import('@jupyterlab/services');
    private pendingTargetNames = new Set<string>();
    private notebook?: INotebook;
    private _postMessageEmitter = new EventEmitter<IPyWidgetMessage>();
    private messageHooks = new Map<string, (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>>();
    private messageHookRequests = new Map<string, Deferred<boolean>>();
    private pendingReplies = new Map<string, Deferred<void>>();
    private pendingShellMessages = new Set<string>();

    private readonly disposables: IDisposable[] = [];
    private kernelRestartHandlerAttached = false;
    private disposed = false;
    constructor(private readonly notebookProvider: INotebookProvider, public readonly notebookIdentity: Uri) {}
    public dispose() {
        this.disposed = true;
        while (this.disposables.length) {
            const disposable = this.disposables.shift();
            disposable?.dispose(); // NOSONAR
        }
    }

    public receiveMessage(message: IPyWidgetMessage): void {
        switch (message.message) {
            case IPyWidgetMessages.IPyWidgets_ShellSend:
                this.sendIPythonShellMsg(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_registerCommTarget:
                this.registerCommTarget(message.payload).ignoreErrors();
                break;

            case IPyWidgetMessages.IPyWidgets_RequestCommInfo_request:
                this.requestCommInfo(message.payload).ignoreErrors();
                break;

            case IPyWidgetMessages.IPyWidgets_RegisterMessageHook:
                this.registerMessageHook(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_RemoveMessageHook:
                this.removeMessageHook(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_MessageHookResponse:
                this.handleMessageHookResponse(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_comm_msg_reply:
                this.handlePendingReply(message.payload);
                break;

            default:
                break;
        }
    }
    public sendIPythonShellMsg(payload: {
        // tslint:disable: no-any
        data: any;
        metadata: any;
        commId: string;
        requestId: string;
        buffers?: any;
        msgType: string;
        targetName?: string;
    }) {
        if (this.notebook) {
            this.pendingShellMessages.add(payload.requestId);
            const future = this.notebook.sendCommMessage(
                restoreBuffers(payload.buffers),
                { data: payload.data, comm_id: payload.commId, target_name: payload.targetName },
                payload.metadata,
                payload.requestId
            );
            const requestId = payload.requestId;
            future.done
                .then((reply) => {
                    this.raisePostMessage(IPyWidgetMessages.IPyWidgets_ShellSend_resolve, {
                        requestId,
                        msg: reply
                    });
                    this.pendingShellMessages.delete(requestId);
                    future.dispose();
                })
                .catch((ex) => {
                    this.raisePostMessage(IPyWidgetMessages.IPyWidgets_ShellSend_reject, { requestId, msg: ex });
                });
            future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                this.raisePostMessage(IPyWidgetMessages.IPyWidgets_ShellSend_onIOPub, { requestId, msg });
                return this.waitForCommMessage(msg as KernelMessage.ICommMsgMsg); // NOSONAR
            };
            future.onReply = (reply: KernelMessage.IShellMessage) => {
                this.raisePostMessage(IPyWidgetMessages.IPyWidgets_ShellSend_reply, { requestId, msg: reply });
            };
        }
    }
    public async registerCommTarget(targetName: string) {
        this.pendingTargetNames.add(targetName);
        await this.initialize();
    }

    public async initialize() {
        if (!this.jupyterLab) {
            // tslint:disable-next-line:no-require-imports
            this.jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services'); // NOSONAR
        }

        // If we have any pending targets, register them now
        const notebook = await this.getNotebook();
        if (notebook) {
            this.registerCommTargets(notebook);

            // If we haven't registered for a comm target, then do not handle messages.
            if (!this.commTargetsRegistered.size) {
                return;
            }

            // Sign up for io pub messages (could probably do a better job here. Do we want all display data messages?)
            if (!this.ioPubCallbackRegistered) {
                this.ioPubCallbackRegistered = true;
                notebook.registerIOPubListener(this.handleOnIOPub.bind(this));
            }
        }
    }
    protected raisePostMessage<M extends IInteractiveWindowMapping, T extends keyof IInteractiveWindowMapping>(
        message: IPyWidgetMessages,
        payload: M[T]
    ) {
        // Only serialize the message portion
        // tslint:disable-next-line: no-any
        const oldPayload = payload as any;
        const newPayload = oldPayload.msg
            ? { ...oldPayload, msg: serializeDataViews(oldPayload.msg) }
            : serializeDataViews(oldPayload);
        this._postMessageEmitter.fire({ message, payload: newPayload });
    }

    private async waitForCommMessage(msg: KernelMessage.ICommMsgMsg) {
        const promise = createDeferred<void>();
        if (KernelMessage.isCommMsgMsg(msg)) {
            this.pendingReplies.set(msg.header.msg_id, promise);
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_comm_msg, msg);
        } else {
            promise.resolve();
        }
        return promise.promise;
    }

    private registerCommTargets(notebook: INotebook) {
        const registerHandler = async (targetName: string, _comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => {
            // Keep track of this so we can re-broadcast this to other ipywidgets from other views.
            this.commTargetsRegistered.set(targetName, msg);
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_comm_open, msg);
        };
        while (this.pendingTargetNames.size > 0) {
            const targetNames = Array.from([...this.pendingTargetNames.values()]);
            const targetName = targetNames.shift();
            if (!targetName) {
                continue;
            }
            if (this.commTargetsRegistered.get(targetName)) {
                // Already registered.
                const msg = this.commTargetsRegistered.get(targetName)!;
                this.raisePostMessage(IPyWidgetMessages.IPyWidgets_comm_open, msg);
                return;
            }

            this.commTargetsRegistered.set(targetName, undefined);
            this.pendingTargetNames.delete(targetName);
            notebook.registerCommTarget(targetName, registerHandler.bind(this, targetName));
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
        this.registerCommTargets(this.notebook);
    }
    private async requestCommInfo(args: { requestId: string; msg: KernelMessage.ICommInfoRequestMsg['content'] }) {
        const notebook = await this.getNotebook();
        if (notebook) {
            const result = await notebook.requestCommInfo(args.msg);
            if (result) {
                this.raisePostMessage(IPyWidgetMessages.IPyWidgets_RequestCommInfo_reply, {
                    requestId: args.requestId,
                    msg: result
                });
            }
        }
    }

    private registerMessageHook(msgId: string) {
        // This has to be synchronous or we don't register the hook fast enough
        // Meaning DO NOT wait for anything here.
        if (this.notebook && !this.messageHooks.has(msgId)) {
            const callback = this.messageHookCallback.bind(this);
            this.messageHooks.set(msgId, callback);
            this.notebook.registerMessageHook(msgId, callback);
        }
    }

    private removeMessageHook(msgId: string) {
        if (this.notebook && this.messageHooks.has(msgId)) {
            const callback = this.messageHooks.get(msgId);
            this.messageHooks.delete(msgId);
            this.notebook.removeMessageHook(msgId, callback!);
        }
    }

    private async messageHookCallback(msg: KernelMessage.IIOPubMessage): Promise<boolean> {
        const promise = createDeferred<boolean>();
        const requestId = uuid();
        // tslint:disable-next-line: no-any
        const parentId = (msg.parent_header as any).msg_id;
        if (this.messageHooks.has(parentId)) {
            this.messageHookRequests.set(requestId, promise);
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_MessageHookCall, { requestId, parentId, msg });
        } else {
            promise.resolve(true);
        }
        return promise.promise;
    }

    private handleMessageHookResponse(args: { requestId: string; parentId: string; msgType: string; result: boolean }) {
        const promise = this.messageHookRequests.get(args.requestId);
        if (promise) {
            this.messageHookRequests.delete(args.requestId);

            // During a shell message, make sure all messages come out.
            promise.resolve(
                this.pendingShellMessages.has(args.parentId) || args.msgType.includes('comm') ? true : args.result
            );
        }
    }

    private handlePendingReply(msgId: string) {
        if (this.pendingReplies.has(msgId)) {
            const promise = this.pendingReplies.get(msgId);
            promise!.resolve();
            this.pendingReplies.delete(msgId);
        }
    }

    private async handleOnIOPub(msg: KernelMessage.IIOPubMessage) {
        if (this.jupyterLab?.KernelMessage.isDisplayDataMsg(msg)) {
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_display_data_msg, msg);
        } else if (this.jupyterLab?.KernelMessage.isStatusMsg(msg)) {
            // Do nothing.
        } else if (this.jupyterLab?.KernelMessage.isCommOpenMsg(msg)) {
            // Do nothing, handled in the place we have registered for a target.
        } else if (this.jupyterLab?.KernelMessage.isCommMsgMsg(msg)) {
            return this.waitForCommMessage(msg as KernelMessage.ICommMsgMsg); // NOSONAR
        }
    }
}
