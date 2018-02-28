// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export async function sleep(timeout: number) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}

// tslint:disable-next-line:no-empty
export function noop() { }
