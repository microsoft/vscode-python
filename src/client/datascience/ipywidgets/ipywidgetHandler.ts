import { Kernel, KernelMessage } from '@jupyterlab/services';
import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { IDisposableRegistry } from '../../common/types';
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

    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();

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

            default:
                break;
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
        this.serializeDataViews(msg as any);
        this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_comm_open, msg);
    }

    private serializeDataViews(msg: KernelMessage.IIOPubMessage) {
        if (!Array.isArray(msg.buffers) || msg.buffers.length === 0) {
            return;
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

        msg.buffers = newBufferView;
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
                })
                .catch(ex => {
                    this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_ShellSend_reject, { requestId, msg: ex });
                });
            future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                this.serializeDataViews(msg);
                this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_ShellSend_onIOPub, { requestId, msg });

                if (KernelMessage.isCommMsgMsg(msg)) {
                    this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_comm_msg, msg as KernelMessage.ICommMsgMsg);
                }
            };
            future.onReply = (reply: KernelMessage.IShellMessage) => {
                this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_ShellSend_reply, { requestId, msg: reply });
            };
        }
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
        if (this.notebookIdentity) {
            return this.notebookProvider.getOrCreateNotebook({ identity: this.notebookIdentity, getOnly: true });
        }
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
        notebook.ioPub(this.handleOnIOPub.bind(this));
    }

    private handleOnIOPub(data: { msg: KernelMessage.IIOPubMessage; requestId: string }) {
        if (KernelMessage.isDisplayDataMsg(data.msg)) {
            this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_display_data_msg, data.msg);
        } else if (KernelMessage.isStatusMsg(data.msg)) {
            // Do nothing.
        } else if (KernelMessage.isCommOpenMsg(data.msg)) {
            // Do nothing, handled in the place we have registered for a target.
        } else if (KernelMessage.isCommMsgMsg(data.msg)) {
            // tslint:disable-next-line: no-any
            this.serializeDataViews(data.msg as any);
            this.postMessageToWebView(IPyWidgetMessages.IPyWidgets_comm_msg, data.msg as KernelMessage.ICommMsgMsg);
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
