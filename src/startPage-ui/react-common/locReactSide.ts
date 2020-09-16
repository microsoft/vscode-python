// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable */

'use strict';
// The react code can't use the localize.ts module because it reads from
// disk. This isn't allowed inside a browser, so we pass the collection
// through the javascript.
let loadedCollection: Record<string, string> | undefined;

export function getLocString(key: string, defValue: string): string {
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        return loadedCollection[key];
    }

    return defValue;
}

export function storeLocStrings(collection: Record<string, string>) {
    loadedCollection = collection;
}
