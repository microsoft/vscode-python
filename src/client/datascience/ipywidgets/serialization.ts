// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { KernelMessage } from '@jupyterlab/services';

export function restoreBuffers(buffers?: (ArrayBuffer | ArrayBufferView)[] | undefined) {
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

export function serializeDataViews(msg: KernelMessage.IIOPubMessage): KernelMessage.IIOPubMessage {
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
                buffer,
                // tslint:disable-next-line: no-any
            } as any); // NOSONAR
        } else {
            // tslint:disable-next-line: no-any
            newBufferView.push(Array.apply(null, new Uint8Array(item as any) as any) as any);
        }
    }

    return {
        ...msg,
        buffers: newBufferView,
    };
}
