// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { KernelMessage } from '@jupyterlab/services';
import * as util from 'util';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri } from 'vscode';
import type { Data as WebSocketData } from 'ws';
import { traceError, traceInfo } from '../../common/logger';
import { IDisposable } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { deserializeDataViews, serializeDataViews } from '../../common/utils/serializers';
import { sendTelemetryEvent } from '../../telemetry';
import { Identifiers, Telemetry } from '../constants';
import { IInteractiveWindowMapping, IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';
import { INotebook, INotebookProvider, KernelSocketInformation } from '../types';
import { WIDGET_MIMETYPE } from './constants';
import { IIPyWidgetMessageDispatcher, IPyWidgetMessage } from './types';

type PendingMessage = {
    resultPromise: Deferred<void>;
    startTime: number;
};

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
    private messageHooks = new Map<string, (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>>();
    private pendingHookRemovals = new Map<string, string>();
    private messageHookRequests = new Map<string, Deferred<boolean>>();

    private readonly disposables: IDisposable[] = [];
    private kernelRestartHandlerAttached?: boolean;
    private kernelSocketInfo?: KernelSocketInformation;
    private sentKernelOptions = false;
    private kernelWasConnectedAtleastOnce?: boolean;
    private disposed = false;
    private pendingMessages: string[] = [];
    private subscribedToKernelSocket: boolean = false;
    private waitingMessageIds = new Map<string, PendingMessage>();
    private totalWaitTime: number = 0;
    private totalWaitedMessages: number = 0;
    private hookCount: number = 0;
    private fullHandleMessage?: { id: string; promise: Deferred<void> };
    /**
     * This will be true if user has executed something that has resulted in the use of ipywidgets.
     * We make this determinination based on whether we see messages coming from backend kernel of a specific shape.
     * E.g. if it contains ipywidget mime type, then widgets are in use.
     */
    private isUsingIPyWidgets?: boolean;
    private readonly deserialize: (data: string | ArrayBuffer) => KernelMessage.IMessage<KernelMessage.MessageType>;

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
        this.mirrorSend = this.mirrorSend.bind(this);
        this.onKernelSocketMessage = this.onKernelSocketMessage.bind(this);
        // tslint:disable-next-line: no-require-imports
        const jupyterLabSerialize = require('@jupyterlab/services/lib/kernel/serialize') as typeof import('@jupyterlab/services/lib/kernel/serialize'); // NOSONAR
        this.deserialize = jupyterLabSerialize.deserialize;
    }
    public dispose() {
        // Send overhead telemetry for our message hooking
        this.sendOverheadTelemetry();
        this.disposed = true;
        while (this.disposables.length) {
            const disposable = this.disposables.shift();
            disposable?.dispose(); // NOSONAR
        }
    }

    public receiveMessage(message: IPyWidgetMessage): void {
        if (process.env.VSC_PYTHON_LOG_IPYWIDGETS && message.message.includes('IPyWidgets_')) {
            traceInfo(`IPyWidgetMessage: ${util.inspect(message)}`);
        }
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

            case IPyWidgetMessages.IPyWidgets_msg_received:
                this.onKernelSocketResponse(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_registerCommTarget:
                this.registerCommTarget(message.payload).ignoreErrors();
                break;

            case IPyWidgetMessages.IPyWidgets_RegisterMessageHook:
                this.registerMessageHook(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_RemoveMessageHook:
                this.possiblyRemoveMessageHook(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_MessageHookResult:
                this.handleMessageHookResponse(message.payload);
                break;

            case IPyWidgetMessages.IPyWidgets_iopub_msg_handled:
                this.iopubMessageHandled(message.payload);
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
            this.kernelSocketInfo?.socket?.removeReceiveHook(this.onKernelSocketMessage); // NOSONAR
            this.kernelSocketInfo?.socket?.removeSendHook(this.mirrorSend); // NOSONAR

            if (this.kernelWasConnectedAtleastOnce) {
                // this means we restarted the kernel and we now have new information.
                // Discard all of the messages upto this point.
                while (this.pendingMessages.length) {
                    this.pendingMessages.shift();
                }
                this.sentKernelOptions = false;
                this.waitingMessageIds.forEach((d) => d.resultPromise.resolve());
                this.waitingMessageIds.clear();
                this.messageHookRequests.forEach((m) => m.resolve(false));
                this.messageHookRequests.clear();
                this.messageHooks.clear();
                this.sendRestartKernel();
            }
            if (!info || !info.socket) {
                // No kernel socket information, hence nothing much we can do.
                this.kernelSocketInfo = undefined;
                return;
            }

            this.kernelWasConnectedAtleastOnce = true;
            this.kernelSocketInfo = info;
            this.kernelSocketInfo.socket?.addReceiveHook(this.onKernelSocketMessage); // NOSONAR
            this.kernelSocketInfo.socket?.addSendHook(this.mirrorSend); // NOSONAR
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
        if (!this.sentKernelOptions) {
            this.sentKernelOptions = true;
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_kernelOptions, this.kernelSocketInfo.options);
        }
    }
    private async mirrorSend(data: any, _cb?: (err?: Error) => void): Promise<void> {
        // If this is shell control message, mirror to the other side. This is how
        // we get the kernel in the UI to have the same set of futures we have on this side
        if (typeof data === 'string') {
            const startTime = Date.now();
            // tslint:disable-next-line: no-require-imports
            const msg = this.deserialize(data);
            if (msg.channel === 'shell' && msg.header.msg_type === 'execute_request') {
                const promise = this.mirrorExecuteRequest(msg as KernelMessage.IExecuteRequestMsg); // NOSONAR
                // If there are no ipywidgets thusfar in the notebook, then no need to synchronize messages.
                if (this.isUsingIPyWidgets) {
                    await promise;
                }
                this.totalWaitTime = Date.now() - startTime;
                this.totalWaitedMessages += 1;
            }
        }
    }

    private sendRestartKernel() {
        this.raisePostMessage(IPyWidgetMessages.IPyWidgets_onRestartKernel, undefined);
    }

    private mirrorExecuteRequest(msg: KernelMessage.IExecuteRequestMsg) {
        const promise = createDeferred<void>();
        this.waitingMessageIds.set(msg.header.msg_id, { startTime: Date.now(), resultPromise: promise });
        this.raisePostMessage(IPyWidgetMessages.IPyWidgets_mirror_execute, { id: msg.header.msg_id, msg });
        return promise.promise;
    }

    // Determine if a message can just be added into the message queue or if we need to wait for it to be
    // fully handled on both the UI and extension side before we process the next message incoming
    private messageNeedsFullHandle(message: any) {
        // We only get a handled callback for iopub messages, so this channel must be iopub
        if (message.channel === 'iopub') {
            if (message.header?.msg_type === 'comm_msg') {
                // IOPub comm messages need to be fully handled
                return true;
            }
        }

        return false;
    }

    // Callback from the UI kernel when an iopubMessage has been fully handled
    private iopubMessageHandled(payload: any) {
        const msgId = payload.id;
        // We don't fully handle all iopub messages, so check our id here
        if (this.fullHandleMessage && this.fullHandleMessage.id === msgId) {
            this.fullHandleMessage.promise.resolve();
            this.fullHandleMessage = undefined;
        }
    }

    private async onKernelSocketMessage(data: WebSocketData): Promise<void> {
        // Hooks expect serialized data as this normally comes from a WebSocket
        let message;

        if (!this.isUsingIPyWidgets) {
            if (!message) {
                message = this.deserialize(data as any) as any;
            }

            // Check for hints that would indicate whether ipywidgest are used in outputs.
            if (
                message.content &&
                message.content.data &&
                (message.content.data[WIDGET_MIMETYPE] || message.content.target_name === Identifiers.DefaultCommTarget)
            ) {
                this.isUsingIPyWidgets = true;
            }
        }

        const msgUuid = uuid();
        const promise = createDeferred<void>();
        this.waitingMessageIds.set(msgUuid, { startTime: Date.now(), resultPromise: promise });

        // Check if we need to fully handle this message on UI and Extension side before we move to the next
        if (this.isUsingIPyWidgets) {
            if (!message) {
                message = this.deserialize(data as any) as any;
            }
            if (this.messageNeedsFullHandle(message)) {
                this.fullHandleMessage = { id: message.header.msg_id, promise: createDeferred<void>() };
            }
        }

        if (typeof data === 'string') {
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_msg, { id: msgUuid, data });
        } else {
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_binary_msg, {
                id: msgUuid,
                data: serializeDataViews([data as any])
            });
        }

        // There are three handling states that we have for messages here
        // 1. If we have not detected ipywidget usage at all, we just forward messages to the kernel
        // 2. If we have detected ipywidget usage. We wait on our message to be received, but not
        //      possibly processed yet by the UI kernel. This make sure our ordering is in sync
        // 3. For iopub comm messages we wait for them to be fully handled by the UI kernel
        //      and the Extension kernel as they may be required to do things like
        //      register message hooks on both sides before we process the nextExtension message

        // If there are no ipywidgets thusfar in the notebook, then no need to synchronize messages.
        if (this.isUsingIPyWidgets) {
            await promise.promise;

            // Comm specific iopub messages we need to wait until they are full handled
            // by both the UI and extension side before we move forward
            if (this.fullHandleMessage) {
                await this.fullHandleMessage.promise.promise;
                this.fullHandleMessage = undefined;
            }
        }
    }
    private onKernelSocketResponse(payload: { id: string }) {
        const pending = this.waitingMessageIds.get(payload.id);
        if (pending) {
            this.waitingMessageIds.delete(payload.id);
            this.totalWaitTime += Date.now() - pending.startTime;
            this.totalWaitedMessages += 1;
            pending.resultPromise.resolve();
        }
    }
    private sendPendingMessages() {
        if (!this.notebook || !this.kernelSocketInfo) {
            return;
        }
        while (this.pendingMessages.length) {
            try {
                this.kernelSocketInfo.socket?.sendToRealKernel(this.pendingMessages[0]); // NOSONAR
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

            traceInfo(`Registering commtarget ${targetName}`);
            this.commTargetsRegistered.add(targetName);
            this.pendingTargetNames.delete(targetName);

            // Skip the predefined target. It should have been registered
            // inside the kernel on startup. However we
            // still need to track it here.
            if (targetName !== Identifiers.DefaultCommTarget) {
                notebook.registerCommTarget(targetName, noop);
            }
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

    private registerMessageHook(msgId: string) {
        try {
            if (this.notebook && !this.messageHooks.has(msgId)) {
                this.hookCount += 1;
                const callback = this.messageHookCallback.bind(this);
                this.messageHooks.set(msgId, callback);
                this.notebook.registerMessageHook(msgId, callback);
            }
        } finally {
            // Regardless of if we registered successfully or not, send back a message to the UI
            // that we are done with extension side handling of this message
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_ExtensionOperationHandled, {
                id: msgId,
                type: IPyWidgetMessages.IPyWidgets_RegisterMessageHook
            });
        }
    }

    private possiblyRemoveMessageHook(args: { hookMsgId: string; lastHookedMsgId: string | undefined }) {
        // Message hooks might need to be removed after a certain message is processed.
        try {
            if (args.lastHookedMsgId) {
                this.pendingHookRemovals.set(args.lastHookedMsgId, args.hookMsgId);
            } else {
                this.removeMessageHook(args.hookMsgId);
            }
        } finally {
            // Regardless of if we removed the hook, added to pending removals or just failed, send back a message to the UI
            // that we are done with extension side handling of this message
            this.raisePostMessage(IPyWidgetMessages.IPyWidgets_ExtensionOperationHandled, {
                id: args.hookMsgId,
                type: IPyWidgetMessages.IPyWidgets_RemoveMessageHook
            });
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

        // Might have a pending removal. We may have delayed removing a message hook until a message was actually
        // processed.
        if (this.pendingHookRemovals.has(msg.header.msg_id)) {
            const hookId = this.pendingHookRemovals.get(msg.header.msg_id);
            this.pendingHookRemovals.delete(msg.header.msg_id);
            this.removeMessageHook(hookId!);
        }

        return promise.promise;
    }

    private handleMessageHookResponse(args: { requestId: string; parentId: string; msgType: string; result: boolean }) {
        const promise = this.messageHookRequests.get(args.requestId);
        if (promise) {
            this.messageHookRequests.delete(args.requestId);

            // During a comm message, make sure all messages come out.
            promise.resolve(args.msgType.includes('comm') ? true : args.result);
        }
    }

    private sendOverheadTelemetry() {
        sendTelemetryEvent(Telemetry.IPyWidgetOverhead, 0, {
            totalOverheadInMs: this.totalWaitTime,
            numberOfMessagesWaitedOn: this.totalWaitedMessages,
            averageWaitTime: this.totalWaitTime / this.totalWaitedMessages,
            numberOfRegisteredHooks: this.hookCount
        });
    }
}
