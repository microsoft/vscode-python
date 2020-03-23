// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import { Event, EventEmitter, Uri } from 'vscode';
import { IDisposable } from '../../common/types';
import { IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';
import { INotebook, INotebookProvider } from '../types';
import { restoreBuffers, serializeDataViews } from './serialization';
import { IIPyWidgetMessageDispatcher, IPyWidgetMessage } from './types';

export class IPyWidgetMessageDispatcher implements IIPyWidgetMessageDispatcher {
    public get onMessage(): Event<IPyWidgetMessage> {
        return this._onMessage.event;
    }
    private readonly commTargetsRegistered = new Map<string, KernelMessage.ICommOpenMsg | undefined>();
    private ioPubCallbackRegistered: boolean = false;
    private jupyterLab?: typeof import('@jupyterlab/services');
    private pendingTargetNames = new Set<string>();
    private notebook?: INotebook;
    private _onMessage = new EventEmitter<IPyWidgetMessage>();
    private readonly disposables: IDisposable[] = [];
    constructor(private readonly notebookProvider: INotebookProvider, public readonly notebookIdentity: Uri) {}
    public dispose() {
        while (this.disposables.length) {
            const disposable = this.disposables.shift();
            disposable?.dispose();
        }
    }
    public async sendIPythonShellMsg(payload: {
        // tslint:disable: no-any
        data: any;
        metadata: any;
        commId: string;
        requestId: string;
        buffers?: any;
        msgType: string;
        targetName?: string;
    }) {
        await this.getNotebook();
        const notebook = this.notebook;
        if (notebook) {
            const future = notebook.sendCommMessage(
                restoreBuffers(payload.buffers),
                { data: payload.data, comm_id: payload.commId, target_name: payload.targetName },
                payload.metadata,
                payload.requestId
            );
            const requestId = payload.requestId;
            future.done
                .then(reply => {
                    this.raiseOnMessage({
                        message: IPyWidgetMessages.IPyWidgets_ShellSend_resolve,
                        payload: {
                            requestId,
                            msg: reply
                        }
                    });
                })
                .catch(ex => {
                    this.raiseOnMessage({
                        message: IPyWidgetMessages.IPyWidgets_ShellSend_reject,
                        payload: { requestId, msg: ex }
                    });
                });
            future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                this.raiseOnMessage({
                    message: IPyWidgetMessages.IPyWidgets_ShellSend_onIOPub,
                    payload: { requestId, msg }
                });

                if (this.jupyterLab?.KernelMessage.isCommMsgMsg(msg)) {
                    this.raiseOnMessage({
                        message: IPyWidgetMessages.IPyWidgets_comm_msg,
                        payload: msg as KernelMessage.ICommMsgMsg
                    });
                }
            };
            future.onReply = (reply: KernelMessage.IShellMessage) => {
                this.raiseOnMessage({
                    message: IPyWidgetMessages.IPyWidgets_ShellSend_reply,
                    payload: { requestId, msg: reply }
                });
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
            this.jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');
        }

        // If we have any pending targets, register them now
        await this.getNotebook();

        this.registerCommTargets();

        // If we haven't registered for a comm target, then do not handle messages.
        if (!this.commTargetsRegistered.size) {
            return;
        }
        if (!this.ioPubCallbackRegistered && this.notebook) {
            this.ioPubCallbackRegistered = true;
            // Sign up for io pub messages (could probably do a better job here. Do we want all display data messages?)
            this.notebook.ioPub(this.handleOnIOPub, this, this.disposables);
        }
    }
    protected raiseOnMessage(message: IPyWidgetMessage) {
        // tslint:disable-neinitializext-line: no-any
        serializeDataViews(message.payload as any);
        this._onMessage.fire(message);
    }
    private registerCommTargets() {
        const notebook = this.notebook;
        if (!notebook) {
            return;
        }
        while (this.pendingTargetNames.size > 0) {
            const targetNames = Array.from([...this.pendingTargetNames.values()]);
            const targetName = targetNames.shift();
            if (!targetName) {
                continue;
            }
            if (this.commTargetsRegistered.get(targetName)) {
                // Already registered.
                const msg = this.commTargetsRegistered.get(targetName)!;
                this.raiseOnMessage({ message: IPyWidgetMessages.IPyWidgets_comm_open, payload: msg });
                return;
            }

            this.commTargetsRegistered.set(targetName, undefined);
            this.pendingTargetNames.delete(targetName);
            notebook.registerCommTarget(targetName, (_comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => {
                // Keep track of this so we can re-broadcast this to other ipywidgets from other views.
                this.commTargetsRegistered.set(targetName, msg);
                this.raiseOnMessage({ message: IPyWidgetMessages.IPyWidgets_comm_open, payload: msg });
            });
        }
    }

    private async getNotebook(): Promise<void> {
        if (this.notebookIdentity && !this.notebook) {
            this.notebook = await this.notebookProvider.getOrCreateNotebook({
                identity: this.notebookIdentity,
                getOnly: true
            });
        }
    }

    private handleOnIOPub(data: { msg: KernelMessage.IIOPubMessage; requestId: string }) {
        if (this.jupyterLab?.KernelMessage.isDisplayDataMsg(data.msg)) {
            this.raiseOnMessage({ message: IPyWidgetMessages.IPyWidgets_display_data_msg, payload: data.msg });
        } else if (this.jupyterLab?.KernelMessage.isStatusMsg(data.msg)) {
            // Do nothing.
        } else if (this.jupyterLab?.KernelMessage.isCommOpenMsg(data.msg)) {
            // Do nothing, handled in the place we have registered for a target.
        } else if (this.jupyterLab?.KernelMessage.isCommMsgMsg(data.msg)) {
            this.raiseOnMessage({ message: IPyWidgetMessages.IPyWidgets_comm_msg, payload: data.msg });
        }
    }
}
