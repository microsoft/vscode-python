// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// The WebPanel constructed by the extension should inject a getLocStrings function into
// the script. This should return a dictionary of key value pairs for loc strings
export declare function getLocStrings(): Record<string, string>;

// The react code can't use the localize.ts module because it reads from
// disk. This isn't allowed inside a browser, so we pass the collection
// through the javascript.
let loadedCollection: Record<string, string> | undefined;

export function getLocString(key: string, defValue: string): string {
    if (!loadedCollection) {
        load();
    }

    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        return loadedCollection[key];
    }

    return defValue;
}

function load() {
    // tslint:disable-next-line:no-typeof-undefined
    if (typeof getLocStrings !== 'undefined') {
        loadedCollection = getLocStrings();
    } else {
        loadedCollection = {};
    }
}
