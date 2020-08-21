// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable-next-line: no-any
async function requirePromise(pkg: string | string[]): Promise<any> {
    return new Promise((resolve, reject) => {
        // tslint:disable-next-line: no-any
        const requirejs = (window as any).require;
        if (requirejs === undefined) {
            reject('Requirejs is needed, please ensure it is loaded on the page.');
        } else {
            requirejs(pkg, resolve, reject);
        }
    });
}
// tslint:disable-next-line: no-any
const requirePromises = new Map<string, Promise<any>>();
export function requireLoader(moduleName: string) {
    if (requirePromises.get(moduleName)) {
        return requirePromises.get(moduleName);
    }
    const promise = requirePromise([`${moduleName}`]);
    requirePromises.set(moduleName, promise);
    return promise;
}
