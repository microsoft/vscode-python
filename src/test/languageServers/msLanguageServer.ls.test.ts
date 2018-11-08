// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-this no-any

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { noop } from '../../client/common/utils/misc';
import { IS_LANGUAGE_SERVER_TEST } from '../constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const decoratorsPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'definition', 'navigation');
const fileDefinitions = path.join(decoratorsPath, 'definitions.py');
const wksPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'exclusions');
const fileOne = path.join(wksPath, 'one.py');

suite('Language Server: Integration', function () {
    // Large value to allow for LS to get downloaded.
    this.timeout(4 * 60000);

    suiteSetup(async function () {
        if (!IS_LANGUAGE_SERVER_TEST) {
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
            glob('languageServer.*', { cwd: EXTENSION_ROOT_DIR }, (ex, matches) => {
                ex ? reject(ex) : resolve(matches.map(item => path.join(EXTENSION_ROOT_DIR, item)));
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
        assert.equal(await isLanguageServerDownloaded(), true, 'Language Server not downloaded');
        return textDocument;
    }

    const assertFile = (expectedLocation: string, location: vscode.Uri) => {
        const relLocation = vscode.workspace.asRelativePath(location);
        const expectedRelLocation = vscode.workspace.asRelativePath(expectedLocation);
        assert.equal(expectedRelLocation, relLocation, 'Position is in wrong file');
    };

    const assertRange = (expectedRange: vscode.Range, range: vscode.Range) => {
        const formatPosition = (position: vscode.Position) => {
            return `${position.line},${position.character}`;
        };
        assert.equal(formatPosition(expectedRange.start), formatPosition(range.start), 'Start position is incorrect');
        assert.equal(formatPosition(expectedRange.end), formatPosition(range.end), 'End position is incorrect');
    };

    test('Definitions', async () => {
        const startPosition = new vscode.Position(2, 6);
        const expectedFiles = [fileDefinitions];
        const expectedRanges = [new vscode.Range(2, 4, 2, 16)];
        const textDocument = await openFile(fileDefinitions);

        const locations = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, startPosition);
        assert.equal(expectedFiles.length, locations!.length, 'Wrong number of results');

        for (let i = 0; i < locations!.length; i += 1) {
            assertFile(expectedFiles[i], locations![i].uri);
            assertRange(expectedRanges[i], locations![i].range!);
        }
    });

    test('Exclude subfolder', async () => {
        await openFile(fileOne);
        const diag = vscode.languages.getDiagnostics();

        const main = diag.filter(d => d[0].fsPath.indexOf('one.py') >= 0);
        assert.equal(main.length > 0, true);

        const subdir1 = diag.filter(d => d[0].fsPath.indexOf('dir1file.py') >= 0);
        assert.equal(subdir1.length, 0);

        const subdir2 = diag.filter(d => d[0].fsPath.indexOf('dir2file.py') >= 0);
        assert.equal(subdir2.length, 0);
    });
});
