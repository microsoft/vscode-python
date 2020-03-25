import { Kernel, KernelMessage } from '@jupyterlab/services';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Uri } from 'vscode';
import { traceInfo } from '../../common/logger';
import { IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import {
    IInteractiveWindowMapping,
    INotebookIdentity,
    InteractiveWindowMessages,
    IPyWidgetMessages
} from '../interactive-common/interactiveWindowTypes';
import { IInteractiveWindowListener, INotebook, INotebookProvider } from '../types';

@injectable()
// This class handles all of the ipywidgets communication with the notebook
export class IpywidgetHandler implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }
    private pendingTargetNames: string[] = [];
    private notebookIdentity: Uri | undefined;
    private notebookInitializedForIpyWidgets: boolean = false;
    private notebook: INotebook | undefined;

    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    private messageHooks = new Map<string, (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>>();
    private messageHookRequests = new Map<string, Deferred<boolean>>();
    private pendingReplies = new Map<string, Deferred<void>>();
    private pendingShellMessages = new Set<string>();

    constructor(
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        disposables.push(
            notebookProvider.onNotebookCreated(async e => {
                if (e.identity.toString() === this.notebookIdentity?.toString()) {
                    await this.initialize();
                }
            })
        );
    }

    public dispose() {
        noop();
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any): void {
        if (message.includes('IPyWidgets')) {
            traceInfo(`IPyWidget message: ${message}`);
        }
        switch (message) {
            case InteractiveWindowMessages.NotebookIdentity:
                this.handleMessage(message, payload, this.saveIdentity);
                break;

            case IPyWidgetMessages.IPyWidgets_ShellSend:
                this.handleMessage(message, payload, this.sendIPythonShellMsg);
                break;

            case IPyWidgetMessages.IPyWidgets_registerCommTarget:
                this.handleMessage(message, payload, this.attemptToRegisterCommTarget);
                break;

            case IPyWidgetMessages.IPyWidgets_RequestCommInfo_request:
                this.handleMessage(message, payload, this.requestCommInfo);
                break;

            case IPyWidgetMessages.IPyWidgets_RegisterMessageHook:
                this.handleMessage(message, payload, this.registerMessageHook);
                break;

            case IPyWidgetMessages.IPyWidgets_RemoveMessageHook:
                this.handleMessage(message, payload, this.removeMessageHook);
                break;

            case IPyWidgetMessages.IPyWidgets_MessageHookResponse:
                this.handleMessage(message, payload, this.handleMessageHookResponse);
                break;

            case IPyWidgetMessages.IPyWidgets_comm_msg_reply:
                this.handleMessage(message, payload, this.handlePendingReply);
                break;

            default:
                break;
        }
    }

    private async requestCommInfo(args: { requestId: string; msg: KernelMessage.ICommInfoRequestMsg['content'] }) {
        const notebook = await this.getNotebook();
        if (notebook) {
            this.notebook = notebook;
            const result = await notebook.requestCommInfo(args.msg);
            if (result) {
                this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_RequestCommInfo_reply, {
                    requestId: args.requestId,
                    msg: result
                });
            }
        }
    }

    private registerMessageHook(msgId: string) {
        // This has to be synchronous or we don't register the hook fast enough
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
            this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_MessageHookCall, { requestId, parentId, msg });
        } else {
            promise.resolve(true);
        }
        return promise.promise;
    }

    private async handleMessageHookResponse(args: { requestId: string; parentId: string; result: boolean }) {
        const promise = this.messageHookRequests.get(args.requestId);
        if (promise) {
            this.messageHookRequests.delete(args.requestId);

            // During a shell message, make sure all messages come out.
            promise.resolve(this.pendingShellMessages.has(args.parentId) ? true : args.result);
        }
    }

    private handlePendingReply(msgId: string) {
        if (this.pendingReplies.has(msgId)) {
            const promise = this.pendingReplies.get(msgId);
            promise!.resolve();
            this.pendingReplies.delete(msgId);
        }
    }

    private postMessageToWebView<M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]) {
        // First send to our listeners
        this.postEmitter.fire({ message: type.toString(), payload });
    }

    private async attemptToRegisterCommTarget(targetName: string) {
        const notebook = await this.getNotebook();
        if (!notebook) {
            this.pendingTargetNames.push(targetName);
        } else {
            this.registerCommTargets(notebook, [...this.pendingTargetNames, targetName]);
            this.pendingTargetNames = [];
        }
    }

    private registerCommTargets(notebook: INotebook, targetNames: string[]) {
        targetNames.forEach(t => notebook.registerCommTarget(t, this.onCommTargetCallback.bind(this)));
    }

    private onCommTargetCallback(_comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) {
        // tslint:disable-next-line: no-any
        const newMsg = this.serializeDataViews(msg as any);
        this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_comm_open, newMsg as KernelMessage.ICommOpenMsg);
    }

    private serializeDataViews(msg: KernelMessage.IIOPubMessage): KernelMessage.IIOPubMessage {
        if (!Array.isArray(msg.buffers) || msg.buffers.length === 0) {
            return msg;
        }
        // tslint:disable-next-line: no-any
        const newBufferView: any[] = [];
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < msg.buffers.length; i += 1) {
            const item = msg.buffers[i];
            if ('buffer' in item && 'byteOffset' in item) {
                // It is an ArrayBufferView
                // tslint:disable-next-line: no-any
                const buffer = Array.apply(null, new Uint8Array(item.buffer as any) as any);
                newBufferView.push({
                    ...item,
                    byteLength: item.byteLength,
                    byteOffset: item.byteOffset,
                    buffer
                    // tslint:disable-next-line: no-any
                } as any);
            } else {
                // tslint:disable-next-line: no-any
                newBufferView.push(Array.apply(null, new Uint8Array(item as any) as any) as any);
            }
        }

        return {
            ...msg,
            buffers: newBufferView
        };
    }

    private async sendIPythonShellMsg(payload: {
        // tslint:disable: no-any
        data: any;
        metadata: any;
        commId: string;
        requestId: string;
        buffers?: any;
        msgType: string;
        targetName?: string;
    }) {
        const notebook = await this.getNotebook();
        if (notebook) {
            this.pendingShellMessages.add(payload.requestId);
            const future = notebook.sendCommMessage(
                this.restoreBuffers(payload.buffers),
                { data: payload.data, comm_id: payload.commId, target_name: payload.targetName },
                payload.metadata,
                payload.requestId
            );
            const requestId = payload.requestId;
            future.done
                .then(reply => {
                    this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_ShellSend_resolve, {
                        requestId,
                        msg: reply
                    });
                    this.pendingShellMessages.delete(requestId);
                    future.dispose();
                })
                .catch(ex => {
                    this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_ShellSend_reject, { requestId, msg: ex });
                });

            future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_ShellSend_onIOPub, { requestId, msg });
                return this.postCommMessage(msg as KernelMessage.ICommMsgMsg);
            };
            future.onReply = (reply: KernelMessage.IShellMessage) => {
                this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_ShellSend_reply, { requestId, msg: reply });
            };
        }
    }

    private async postCommMessage(msg: KernelMessage.ICommMsgMsg) {
        const promise = createDeferred<void>();
        if (KernelMessage.isCommMsgMsg(msg)) {
            this.pendingReplies.set(msg.header.msg_id, promise);
            this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_comm_msg, msg);
        } else {
            promise.resolve();
        }
        return promise.promise;
    }

    private restoreBuffers(buffers?: (ArrayBuffer | ArrayBufferView)[] | undefined) {
        if (!buffers || !Array.isArray(buffers) || buffers.length === 0) {
            return buffers || [];
        }
        // tslint:disable-next-line: prefer-for-of no-any
        const newBuffers: any[] = [];
        // tslint:disable-next-line: prefer-for-of no-any
        for (let i = 0; i < buffers.length; i += 1) {
            const item = buffers[i];
            if ('buffer' in item && 'byteOffset' in item) {
                const buffer = new Uint8Array(item.buffer).buffer;
                // It is an ArrayBufferView
                // tslint:disable-next-line: no-any
                const bufferView = new DataView(buffer, item.byteOffset, item.byteLength);
                newBuffers.push(bufferView);
            } else {
                const buffer = new Uint8Array(item).buffer;
                // tslint:disable-next-line: no-any
                newBuffers.push(buffer);
            }
        }
        return newBuffers;
    }

    private async getNotebook(): Promise<INotebook | undefined> {
        if (this.notebookIdentity && !this.notebook) {
            this.notebook = await this.notebookProvider.getOrCreateNotebook({
                identity: this.notebookIdentity,
                getOnly: true
            });
        }
        return this.notebook;
    }

    private async saveIdentity(args: INotebookIdentity) {
        this.notebookIdentity = Uri.parse(args.resource);

        await this.initialize();
    }

    private async initialize() {
        if (this.notebookInitializedForIpyWidgets) {
            return;
        }

        // If we have any pending targets, register them now
        const notebook = await this.getNotebook();
        if (!notebook) {
            return;
        }

        this.notebookInitializedForIpyWidgets = true;

        if (this.pendingTargetNames.length > 0) {
            this.registerCommTargets(notebook, this.pendingTargetNames);
            this.pendingTargetNames = [];
        }

        // Sign up for io pub messages (could probably do a better job here. Do we want all display data messages?)
        notebook.registerIOPubListener(this.handleOnIOPub.bind(this));
    }

    private async handleOnIOPub(msg: KernelMessage.IIOPubMessage): Promise<void> {
        if (KernelMessage.isDisplayDataMsg(msg)) {
            this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_display_data_msg, msg);
        } else if (KernelMessage.isStatusMsg(msg)) {
            // Do nothing.
        } else if (KernelMessage.isCommOpenMsg(msg)) {
            // Do nothing, handled in the place we have registered for a target.
        } else if (KernelMessage.isCommMsgMsg(msg)) {
            // tslint:disable-next-line: no-any
            const newMsg = this.serializeDataViews(msg as any);
            return this.postCommMessage(newMsg as KernelMessage.ICommMsgMsg);
        }
    }

    private handleMessage<M extends IInteractiveWindowMapping, T extends keyof M>(
        _message: T,
        // tslint:disable-next-line:no-any
        payload: any,
        handler: (args: M[T]) => void
    ) {
        const args = payload as M[T];
        handler.bind(this)(args);
    }
}
