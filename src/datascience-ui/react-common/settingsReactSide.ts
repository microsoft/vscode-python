// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// The WebPanel constructed by the extension should inject a getSettings function into
// the script. This should return a dictionary of key value pairs for settings
export declare function getSettings() : { [index: string ] : string | boolean | number };

// IANHU: Need to handle settings update
let loadedSettingsCollection: { [index: string]: string | boolean | number } | undefined ;

// IANHU: Does default value make sense here for a setting? Also chance to def value must match return type
// IANHU: instead of a dictionary can I deserialize into an object?
export function getSetting(key: string, defValue: string | boolean | number) : string | boolean | number {
    if (!loadedSettingsCollection) {
        load();
    }

    if (loadedSettingsCollection && loadedSettingsCollection.hasOwnProperty(key)) {
        return loadedSettingsCollection[key];
    }

    return defValue;
}

function load() {
    // tslint:disable-next-line:no-typeof-undefined
    if (typeof getSettings !== 'undefined') {
        loadedSettingsCollection = getSettings();
    } else {
        loadedSettingsCollection = {};
    }
}
