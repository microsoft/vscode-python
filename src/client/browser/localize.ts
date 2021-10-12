// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/* eslint-disable @typescript-eslint/no-namespace */

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../constants';

export namespace LanguageService {
    export const statusItem = {
        name: localize('LanguageService.statusItem.name', 'Python IntelliSense Status'),
        text: localize('LanguageService.statusItem.text', 'Partial Mode'),
        detail: localize('LanguageService.statusItem.detail', 'Limited IntelliSense provided by Pylance'),
    };
}

// Skip using vscode-nls and instead just compute our strings based on key values. Key values
// can be loaded out of the nls.<locale>.json files
let loadedCollection: Record<string, string> | undefined;
let defaultCollection: Record<string, string> | undefined;
let askedForCollection: Record<string, string> = {};
let loadedLocale: string;

// This is exported only for testing purposes.
export function _resetCollections(): void {
    loadedLocale = '';
    loadedCollection = undefined;
    askedForCollection = {};
}

// This is exported only for testing purposes.
export function _getAskedForCollection(): Record<string, string> {
    return askedForCollection;
}

export function localize(key: string, defValue?: string) {
    // Return a pointer to function so that we refetch it on each call.
    return (): string => getString(key, defValue);
}

declare let navigator: { language: string } | undefined;

function parseLocale(): string {
    try {
        if (navigator?.language) {
            return navigator.language.toLowerCase();
        }
    } catch {
        // Fall through
    }
    // Attempt to load from the vscode locale. If not there, use english
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    return vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
}

function getString(key: string, defValue?: string) {
    // The default collection (package.nls.json) is the fallback.
    // Note that we are guaranteed the following (during shipping)
    //  1. defaultCollection was initialized by the load() call above
    //  2. defaultCollection has the key (see the "keys exist" test)
    let collection = defaultCollection;

    // Use the current locale if the key is defined there.
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        collection = loadedCollection;
    }
    if (collection === undefined) {
        throw new Error("Localizations haven't been loaded yet");
    }
    let result = collection[key];
    if (!result && defValue) {
        // This can happen during development if you haven't fixed up the nls file yet or
        // if for some reason somebody broke the functional test.
        result = defValue;
    }
    askedForCollection[key] = result;

    return result;
}

/**
 * Only uses the VSCode APIs to query filesystem and not the node fs APIs, as
 * they're not available in browser. Must be called before any use of the locale.
 */
export async function loadLocalizedStrings(): Promise<void> {
    // Figure out our current locale.
    loadedLocale = parseLocale();

    loadedCollection = await parseNLS(loadedLocale);

    // Get the default collection if necessary. Strings may be in the default or the locale json
    if (!defaultCollection) {
        defaultCollection = await parseNLS();
    }
}

async function parseNLS(locale?: string) {
    try {
        const filename = locale ? `package.nls.${locale}.json` : `package.nls.json`;
        const nlsFile = vscode.Uri.joinPath(vscode.Uri.file(EXTENSION_ROOT_DIR), filename);
        const buffer = await vscode.workspace.fs.readFile(nlsFile);
        const contents = new TextDecoder().decode(buffer);
        return JSON.parse(contents);
    } catch {
        // If there isn't one, at least remember that we looked so we don't try to load a second time.
        return {};
    }
}
