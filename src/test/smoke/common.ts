// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this no-default-export no-console

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import * as vscode from 'vscode';
import { waitForCondition } from '../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, IS_SMOKE_TEST, SMOKE_TEST_EXTENSIONS_DIR } from '../constants';
import { noop, sleep } from '../core';
import { initialize } from '../initialize';

let initialized = false;
const fileDefinitions = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'definitions.py');

export async function initializeSmokeTests() {
    if (!IS_SMOKE_TEST || initialized) {
        return;
    }
    await removeLanguageServerFiles();
    await enableJedi(false);
    await initialize();
    await openFileAndWaitForLS(fileDefinitions);
    initialized = true;
}

export async function updateSetting(setting: string, value: any) {
    const resource = vscode.workspace.workspaceFolders![0].uri;
    await vscode.workspace.getConfiguration('python', resource).update(setting, value, vscode.ConfigurationTarget.WorkspaceFolder);
}
export async function removeLanguageServerFiles() {
    const folders = await getLanaguageServerFolders();
    await Promise.all(folders.map(item => fs.remove(item).catch(noop)));
}
async function getLanaguageServerFolders(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        glob('languageServer.*', { cwd: SMOKE_TEST_EXTENSIONS_DIR }, (ex, matches) => {
            ex ? reject(ex) : resolve(matches.map(item => path.join(SMOKE_TEST_EXTENSIONS_DIR, item)));
        });
    });
}
export function isJediEnabled() {
    const resource = vscode.workspace.workspaceFolders![0].uri;
    const settings = vscode.workspace.getConfiguration('python', resource);
    return settings.get<boolean>('jediEnabled') === true;
}
export async function enableJedi(enable: boolean | undefined) {
    if (isJediEnabled() === enable) {
        return;
    }
    await updateSetting('jediEnabled', enable);
}
export async function openFileAndWaitForLS(file: string): Promise<vscode.TextDocument> {
    const textDocument = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(textDocument);
    assert(vscode.window.activeTextEditor, 'No active editor');
    // Make sure LS completes file loading and analysis.
    // In test mode it awaits for the completion before trying
    // to fetch data for completion, hover.etc.
    await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, new vscode.Position(0, 0));
    await waitForCondition(isLanguageServerDownloaded, 30_000, 'Language Server not downloaded');
    // For for LS to get extracted.
    await sleep(10_000);
    return textDocument;
}

async function isLanguageServerDownloaded() {
    // tslint:disable-next-line:no-unnecessary-local-variable
    const downloaded = await getLanaguageServerFolders().then(items => items.length > 0);
    return downloaded;
}
