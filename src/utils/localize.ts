// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';

// External callers of localize use these tables to retrieve localized values.
export namespace LanguageServiceSurveyBanner {
    export const bannerMessage = localize('LanguageServiceSurveyBanner.bannerMessage', 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?');
    export const bannerLabelYes = localize('LanguageServiceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('LanguageServiceSurveyBanner.bannerLabelNo', 'No, thanks');
}

// Skip using vscode-nls and instead just compute our strings based on key values. Key values
// can be loaded out of the nls.<locale>.json files
let loadedCollection: { [index: string]: string } | undefined ;
let defaultCollection: { [index: string]: string } | undefined ;
let loadedLocale: string;

function localize(key: string, defValue: string) {
    // Return a pointer to function so that we refetch it on each call.
    return () => {
        return getString(key, defValue);
    };
}

function parseLocale() : string {
    // Attempt to load from the vscode locale. If not there, use english
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    return vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
}

function getString(key: string, defValue: string) {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }

    // First lookup in the dictionary that matches the current locale
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        return loadedCollection[key];
    }

    // Fallback to the default dictionary
    if (defaultCollection && defaultCollection.hasOwnProperty(key)) {
        return defaultCollection[key];
    }

    // Not found, return the default
    return defValue;
}

function load() {
    // Figure out our current locale.
    loadedLocale = parseLocale();

    // Find the nls file that matches (if there is one)
    const nlsFile = path.join(EXTENSION_ROOT_DIR, `package.nls.${loadedLocale}.json`);
    if (fs.existsSync(nlsFile)) {
        const contents = fs.readFileSync(nlsFile, 'utf8');
        loadedCollection = JSON.parse(contents);
    } else {
        // If there isn't one, at least remember that we looked so we don't try to load a second time
        loadedCollection = {};
    }

    // Get the default collection if necessary. Strings may be in the default or the locale json
    if (!defaultCollection) {
        const defaultNlsFile = path.join(EXTENSION_ROOT_DIR, 'package.nls.json');
        if (fs.existsSync(defaultNlsFile)) {
            const contents = fs.readFileSync(defaultNlsFile, 'utf8');
            return JSON.parse(contents);
        } else {
            defaultCollection = {};
        }
    }
}

// Default to loading the current locale
load();
