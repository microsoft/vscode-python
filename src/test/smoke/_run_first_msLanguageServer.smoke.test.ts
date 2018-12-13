// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-this no-any

import * as assert from 'assert';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import * as vscode from 'vscode';
import { waitForCondition } from '../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, IS_SMOKE_TEST, SMOKE_TEST_EXTENSIONS_DIR } from '../constants';
import { noop, sleep } from '../core';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const fileDefinitions = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'definitions.py');

suite('Smoke Test: Language Server', function () {
    // Large value to allow for LS to get downloaded.
    this.timeout(4 * 60000);

    suiteSetup(async function () {
        if (!IS_SMOKE_TEST) {
            return this.skip();
        }
        await removeLanguageServerFiles();
        await enableJedi(false);
        await updateSetting('linting.ignorePatterns', ['**/dir1/**']);
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(async () => {
        await enableJedi(undefined);
        await closeActiveWindows();
        await updateSetting('linting.ignorePatterns', undefined);
    });
    teardown(closeActiveWindows);
    async function updateSetting(setting: string, value: any) {
        const resource = vscode.workspace.workspaceFolders![0].uri;
        await vscode.workspace.getConfiguration('python', resource).update(setting, value, vscode.ConfigurationTarget.WorkspaceFolder);
    }
    async function removeLanguageServerFiles() {
        const folders = await getLanaguageServerFolders();
        await Promise.all(folders.map(item => fs.remove(item).catch(noop)));
    }
    async function isLanguageServerDownloaded() {
        // tslint:disable-next-line:no-unnecessary-local-variable
        const downloaded = await getLanaguageServerFolders().then(items => items.length > 0);
        return downloaded;
    }
    async function getLanaguageServerFolders(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            glob('languageServer.*', { cwd: SMOKE_TEST_EXTENSIONS_DIR }, (ex, matches) => {
                ex ? reject(ex) : resolve(matches.map(item => path.join(SMOKE_TEST_EXTENSIONS_DIR, item)));
            });
        });
    }
    function isJediEnabled() {
        const resource = vscode.workspace.workspaceFolders![0].uri;
        const settings = vscode.workspace.getConfiguration('python', resource);
        return settings.get<boolean>('jediEnabled') === true;
    }
    async function enableJedi(enable: boolean | undefined) {
        if (isJediEnabled() === enable) {
            return;
        }
        await updateSetting('jediEnabled', enable);
    }

    async function openFile(file: string): Promise<vscode.TextDocument> {
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

    test('Definitions', async () => {
        const startPosition = new vscode.Position(13, 6);
        const textDocument = await openFile(fileDefinitions);
        let tested = false;
        for (let i = 0; i < 5; i += 1) {
            const locations = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, startPosition);
            if (locations && locations.length > 0) {
                expect(locations![0].uri.fsPath).to.contain(path.basename(fileDefinitions));
                tested = true;
                break;
            } else {
                // Wait for LS to start.
                await sleep(5_000);
            }
        }
        if (!tested) {
            assert.fail('Failled to test definitions');
        }
    });
});
