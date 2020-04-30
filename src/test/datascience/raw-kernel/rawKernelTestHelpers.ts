// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { createDeferred, Deferred } from '../../../client/common/utils/async';
import { RawKernel } from '../../../client/datascience/raw-kernel/rawKernel';

// tslint:disable: no-any
export async function requestExecute(
    rawKernel: RawKernel,
    code: string,
    started?: Deferred<void>
): Promise<KernelMessage.IMessage[]> {
    const waiter = createDeferred<KernelMessage.IMessage<KernelMessage.MessageType>[]>();
    const requestContent = {
        code,
        silent: false,
        store_history: false
    };

    const replies: KernelMessage.IMessage<KernelMessage.MessageType>[] = [];
    let foundReply = false;
    let foundIdle = false;
    const ioPubHandler = (m: KernelMessage.IIOPubMessage) => {
        replies.push(m);
        if (m.header.msg_type === 'status') {
            foundIdle = (m.content as any).execution_state === 'idle';
            if (started && (m.content as any).execution_state === 'busy') {
                started.resolve();
            }
        }
        if (!waiter.resolved && foundReply && foundIdle) {
            waiter.resolve(replies);
        }
    };
    const shellHandler = (m: KernelMessage.IExecuteReplyMsg | KernelMessage.IExecuteRequestMsg) => {
        replies.push(m);
        if (m.header.msg_type === 'execute_reply') {
            foundReply = true;
        }
        if (!waiter.resolved && foundReply && foundIdle) {
            waiter.resolve(replies);
        }
    };
    const future = rawKernel.requestExecute(requestContent);
    future.onIOPub = ioPubHandler;
    future.onReply = shellHandler;
    rawKernel.requestExecute(requestContent, true);
    return waiter.promise.then((m) => {
        return m;
    });
}

export async function requestInspect(rawKernel: RawKernel, code: string): Promise<JSONObject> {
    // Create a deferred that will fire when the request completes
    const deferred = createDeferred<JSONObject>();

    rawKernel
        .requestInspect({ code, cursor_pos: 0, detail_level: 0 })
        .then((r) => {
            if (r && r.content.status === 'ok') {
                deferred.resolve(r.content.data);
            } else {
                deferred.resolve(undefined);
            }
        })
        .catch((ex) => {
            deferred.reject(ex);
        });

    return deferred.promise;
}
