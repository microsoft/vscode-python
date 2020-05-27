// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-this no-default-export no-console

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import * as vscode from 'vscode';
import { SMOKE_TEST_EXTENSIONS_DIR } from '../constants';
import { noop, sleep } from '../core';

export async function updateSetting(setting: string, value: any) {
    const resource = vscode.workspace.workspaceFolders![0].uri;
    await vscode.workspace
        .getConfiguration('python', resource)
        .update(setting, value, vscode.ConfigurationTarget.WorkspaceFolder);
}
export async function removeLanguageServerFiles() {
    const folders = await getLanguageServerFolders();
    await Promise.all(folders.map((item) => fs.remove(item).catch(noop)));
}
async function getLanguageServerFolders(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        glob('languageServer.*', { cwd: SMOKE_TEST_EXTENSIONS_DIR }, (ex, matches) => {
            ex ? reject(ex) : resolve(matches.map((item) => path.join(SMOKE_TEST_EXTENSIONS_DIR, item)));
        });
    });
}
export function isJediEnabled() {
    const resource = vscode.workspace.workspaceFolders![0].uri;
    const settings = vscode.workspace.getConfiguration('python', resource);
    return settings.get<string>('languageServer') === 'Jedi';
}
export async function enableJedi(enable: boolean | undefined) {
    if (isJediEnabled() === enable) {
        return;
    }
    await updateSetting('languageServer', 'Jedi');
}
export async function openFileAndWaitForLS(file: string): Promise<vscode.TextDocument> {
    const textDocument = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(textDocument);
    assert(vscode.window.activeTextEditor, 'No active editor');
    // Make sure LS completes file loading and analysis.
    // In test mode it awaits for the completion before trying
    // to fetch data for completion, hover.etc.
    await vscode.commands.executeCommand(
        'vscode.executeCompletionItemProvider',
        textDocument.uri,
        new vscode.Position(0, 0)
    );
    // For for LS to get extracted.
    await sleep(10_000);
    return textDocument;
}
