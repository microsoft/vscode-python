// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import * as uuid from 'uuid/v4';
import { noop } from '../../client/common/utils/misc';
import { IPyWidgetMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { ClassicCommShellCallbackManager } from './callbackManager';
import { ClassicComm } from './classicComm';
import { CommTargetCallback, IMessageSender } from './types';

type CommTargetRegisteredHandler = (targetName: string, callback: CommTargetCallback) => void;

/**
 * This is a proxy Kernel that ipython will use to communicate with jupyter.
 * It only requires the `registerCommTarget` method to list to comm messages.
 * That's why we only implement that method.
 *
 * @export
 * @class ProxyKernel
 * @implements {Partial<Kernel.IKernel>}
 */
export class ProxyKernel implements Partial<Kernel.IKernel> {
    private commRegistrationMessagesToSend: string[] = [];
    private readonly handlers: CommTargetRegisteredHandler[] = [];
    private commTargetCallbacks = new Map<string, CommTargetCallback>();
    private commsById = new Map<string, Kernel.IComm>();
    private readonly shellCallbackManager = new ClassicCommShellCallbackManager();
    constructor(private readonly messageSender: IMessageSender) {}
    /**
     * This method is used by ipywidgets manager.
     *
     * @param {string} targetName
     * @param {CommTargetCallback} callback
     * @memberof ProxyKernel
     */
    public registerCommTarget(targetName: string, callback: CommTargetCallback): void {
        this.commRegistrationMessagesToSend.push(targetName);
        this.handlers.forEach(handler => handler(targetName, callback));
        this.commTargetCallbacks.set(targetName, callback);
    }
    public connectToComm(targetName: string, commId: string = uuid()): Kernel.IComm {
        return this.commsById.get(commId) || this.createComm(targetName, commId);
    }
    public dispose() {
        while (this.handlers.shift()) {
            noop();
        }
    }
    public initialize(): void {
        this.commRegistrationMessagesToSend.forEach(targetName =>
            this.messageSender.sendMessage(IPyWidgetMessages.IPyWidgets_registerCommTarget, targetName)
        );
        this.commRegistrationMessagesToSend = [];
    }
    // tslint:disable-next-line: no-any
    public async handleMessageAsync(msg: string, payload?: any): Promise<void> {
        switch (msg) {
            case IPyWidgetMessages.IPyWidgets_comm_msg: {
                // We got a `comm_msg` on the comm channel from kernel.
                // These messages must be given to all widgets, to update their states.
                // The `shell` message was sent using our custom `IComm` component provided to ipywidgets.
                // ipywidgets uses the `IComm.send` method.

                // These messages need to be propagated back on the `onMsg` callback.
                const commMsg = payload as KernelMessage.ICommMsgMsg;
                if (commMsg.content && commMsg.content.comm_id) {
                    const comm = this.commsById.get(commMsg.content.comm_id);
                    if (comm) {
                        const promise = comm.onMsg(commMsg);
                        if (promise) {
                            await promise;
                        }
                    }
                }
                break;
            }
            case IPyWidgetMessages.IPyWidgets_comm_open:
                await this.handleCommOpen(msg, payload);
                break;
            default:
                await this.shellCallbackManager.handleShellCallbacks(msg, payload);
                break;
        }
    }
    protected async onCommOpen(msg: KernelMessage.ICommOpenMsg) {
        if (!msg.content || !msg.content.comm_id || msg.content.target_name !== 'jupyter.widget') {
            throw new Error('Unknown comm open message');
        }
        const commTargetCallback = this.commTargetCallbacks.get(msg.content.target_name);
        if (!commTargetCallback) {
            throw new Error(`Comm Target callback not registered for ${msg.content.target_name}`);
        }

        const comm = this.createComm(msg.content.target_name, msg.content.comm_id);

        // Invoke the CommOpen callbacks with the comm and the corresponding message.
        // This is the handshake with the ipywidgets.
        // At this point ipywidgets manager has the comm object it needs to communicate with the kernel.
        const promise = commTargetCallback(comm, msg);
        // tslint:disable-next-line: no-any
        if (promise && (promise as any).then) {
            await promise;
        }
    }
    private createComm(targetName: string, commId: string): Kernel.IComm {
        // Create the IComm object that ipywidgets will use to communicate directly with the kernel.
        const comm = new ClassicComm(commId, targetName, this.messageSender, this.shellCallbackManager);
        // const comm = this.createKernelCommForCommOpenCallback(msg);

        // When messages arrive on `onMsg` in the comm component, we need to send these back.
        // Remember, `comm` here is a bogus IComm object.
        // The actual object is at the extension end. Back there we listen to messages arriving
        // in the callback of `IComm.onMsg`, those will come into this class and we need to send
        // them through the `comm` object. To propogate those messages we need to tie the delegate to the comm id.
        this.commsById.set(commId, comm);
        return comm;
    }
    // tslint:disable-next-line: no-any
    private async handleCommOpen(msg: string, payload?: any): Promise<void> {
        if (msg !== IPyWidgetMessages.IPyWidgets_comm_open) {
            return;
        }
        // Happens when a comm is opened (generatelly part of a cell execution).
        // We're only interested in `comm_open` messages.
        if (payload && payload.msg_type === 'comm_open') {
            const commOpenMessage = payload as KernelMessage.ICommOpenMsg;
            try {
                await this.onCommOpen(commOpenMessage);
            } catch (ex) {
                // tslint:disable-next-line: no-console
                console.error('Failed to exec commTargetCallback', ex);
            }
        }
    }
}
