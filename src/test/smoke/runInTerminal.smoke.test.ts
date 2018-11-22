// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-this no-any

import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { openFile, waitForCondition } from '../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, IS_SMOKE_TEST } from '../constants';
import { closeActiveWindows, initializeTest } from '../initialize';

suite('Smoke Test: Run Python File In Terminal', function () {
    // Large value to allow for LS to get downloaded.
    this.timeout(4 * 60_000);

    suiteSetup(function () {
        if (!IS_SMOKE_TEST) {
            return this.skip();
        }
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Exec', async () => {
        const file = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.py');
        const outputFile = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.log');
        if (await fs.pathExists(outputFile)) {
            await fs.unlink(outputFile);
        }
        const textDocument = await openFile(file);

        await vscode.commands.executeCommand<void>('python.execInTerminal', textDocument.uri);
        const checkIfFileHasBeenCreated = () => fs.pathExists(outputFile);
        await waitForCondition(checkIfFileHasBeenCreated, 30_000, '\'testExecInTerminal.log\' file not created');
    });
});
