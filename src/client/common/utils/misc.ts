// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Uri } from 'vscode';
import { InterpreterUri } from '../installer/types';
import { IAsyncDisposable, IDisposable, Resource } from '../types';

// tslint:disable-next-line:no-empty
export function noop() {}

export function using<T extends IDisposable>(disposable: T, func: (obj: T) => void) {
    try {
        func(disposable);
    } finally {
        disposable.dispose();
    }
}

export async function usingAsync<T extends IAsyncDisposable, R>(disposable: T, func: (obj: T) => Promise<R>): Promise<R> {
    try {
        return await func(disposable);
    } finally {
        await disposable.dispose();
    }
}

/**
 * Checking whether something is a Resource (Uri/undefined).
 * Using `instanceof Uri` doesn't always work as the object is not an instance of Uri (at least not in tests).
 * That's why VSC too has a helper method `URI.isUri` (though not public).
 *
 * @export
 * @param {InterpreterUri} [resource]
 * @returns {resource is Resource}
 */
export function isResource(resource?: InterpreterUri): resource is Resource {
    if (!resource) {
        return true;
    }
    const uri = resource as Uri;
    return typeof uri.path === 'string' && typeof uri.scheme === 'string';
}
