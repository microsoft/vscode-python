// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-this no-any

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';
import { updateSetting } from '../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, IS_SMOKE_TEST } from '../constants';
import { sleep } from '../core';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { openFileAndWaitForLS } from './common';

const fileDefinitions = path.join(
    EXTENSION_ROOT_DIR_FOR_TESTS,
    'src',
    'testMultiRootWkspc',
    'smokeTests',
    'definitions.py'
);

suite('Smoke Test: Language Server', () => {
    suiteSetup(async function() {
        if (!IS_SMOKE_TEST) {
            return this.skip();
        }
        await updateSetting(
            'linting.ignorePatterns',
            ['**/dir1/**'],
            vscode.workspace.workspaceFolders![0].uri,
            vscode.ConfigurationTarget.WorkspaceFolder
        );
        await initialize();
    });
    setup(async () => {
        await initializeTest();
        await closeActiveWindows();
    });
    suiteTeardown(async () => {
        await closeActiveWindows();
        await updateSetting(
            'linting.ignorePatterns',
            undefined,
            vscode.workspace.workspaceFolders![0].uri,
            vscode.ConfigurationTarget.WorkspaceFolder
        );
    });
    teardown(closeActiveWindows);

    test('Definitions', async () => {
        const startPosition = new vscode.Position(13, 6);
        const textDocument = await openFileAndWaitForLS(fileDefinitions);
        let tested = false;
        for (let i = 0; i < 5; i += 1) {
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeDefinitionProvider',
                textDocument.uri,
                startPosition
            );
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
