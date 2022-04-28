// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// IMPORTANT: Do not import any node fs related modules here, as they do not work in browser.

import * as vscode from 'vscode';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IFileSystem } from '../platform/types';

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

export function shouldLoadUsingNodeFS(): boolean {
    return !loadedCollection || parseLocale() !== loadedLocale;
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

    try {
        // Attempt to load from the vscode locale. If not there, use english
        // 'process' should be in this `try` block for browser support.
        // Don't merge this try block with the one above. They have to fall
        // through in this order.
        const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
        return vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
    } catch {
        // Fall through
    }

    return 'en-us';
}

export function getLocalizedString(key: string, defValue?: string): string {
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
        throw new Error(`Localizations haven't been loaded yet for key: ${key}`);
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
 * Can be used to synchronously load localized strings, useful if we want localized strings at module level itself.
 * Cannot be used in VSCode web or any browser. Must be called before any use of the locale.
 */
export function loadLocalizedStringsUsingNodeFS(fs: IFileSystem): void {
    // Figure out our current locale.
    loadedLocale = parseLocale();

    // Find the nls file that matches (if there is one)
    const nlsFile = path.join(EXTENSION_ROOT_DIR, `package.nls.${loadedLocale}.json`);
    if (fs.fileExistsSync(nlsFile)) {
        const contents = fs.readFileSync(nlsFile);
        loadedCollection = JSON.parse(contents);
    } else {
        // If there isn't one, at least remember that we looked so we don't try to load a second time
        loadedCollection = {};
    }

    // Get the default collection if necessary. Strings may be in the default or the locale json
    if (!defaultCollection) {
        const defaultNlsFile = path.join(EXTENSION_ROOT_DIR, 'package.nls.json');
        if (fs.fileExistsSync(defaultNlsFile)) {
            const contents = fs.readFileSync(defaultNlsFile);
            defaultCollection = JSON.parse(contents);
        } else {
            defaultCollection = {};
        }
    }
}

/**
 * Only uses the VSCode APIs to query filesystem and not the node fs APIs, as
 * they're not available in browser. Must be called before any use of the locale.
 */
export async function loadLocalizedStringsForBrowser(): Promise<void> {
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
