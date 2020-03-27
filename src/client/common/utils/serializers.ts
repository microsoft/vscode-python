// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/**
 * Serialize ArraBuffer and ArrayBufferView into a fomat such that they are json serializable.
 *
 * @export
 * @param {(undefined | (ArrayBuffer | ArrayBufferView)[])} buffers
 * @returns
 */
export function serializeDataViews(buffers: undefined | (ArrayBuffer | ArrayBufferView)[]) {
    if (!buffers || !Array.isArray(buffers) || buffers.length === 0) {
        return;
    }
    // tslint:disable-next-line: no-any
    const newBufferView: any[] = [];
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < buffers.length; i += 1) {
        const item = buffers[i];
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
            } as any);
        } else {
            // tslint:disable-next-line: no-any
            newBufferView.push(Array.apply(null, new Uint8Array(item as any) as any) as any);
        }
    }

    // tslint:disable-next-line: no-any
    return newBufferView;
}

/**
 * Deserializes ArrayBuffer and ArrayBufferView from a format that was json serializable into actual ArrayBuffer and ArrayBufferViews.
 *
 * @export
 * @param {(undefined | (ArrayBuffer | ArrayBufferView)[])} buffers
 * @returns
 */
export function deserializeDataViews(buffers: undefined | (ArrayBuffer | ArrayBufferView)[]) {
    if (!Array.isArray(buffers) || buffers.length === 0) {
        return buffers;
    }
    const newBufferView: (ArrayBuffer | ArrayBufferView)[] = [];
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < buffers.length; i += 1) {
        const item = buffers[i];
        if ('buffer' in item && 'byteOffset' in item) {
            const buffer = new Uint8Array(item.buffer).buffer;
            // It is an ArrayBufferView
            // tslint:disable-next-line: no-any
            const bufferView = new DataView(buffer, item.byteOffset, item.byteLength);
            newBufferView.push(bufferView);
        } else {
            const buffer = new Uint8Array(item).buffer;
            // tslint:disable-next-line: no-any
            newBufferView.push(buffer);
        }
    }
    return newBufferView;
}
