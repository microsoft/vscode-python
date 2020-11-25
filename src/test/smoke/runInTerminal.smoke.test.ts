// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this

// import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
// import * as vscode from 'vscode';
// import { openFile, waitForCondition } from '../common';
import { waitForCondition } from '../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, IS_SMOKE_TEST } from '../constants';
// import { sleep } from '../core';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

const testTimeout = 30 * 1_000;

suite('Smoke Test: Run Python File In Terminal', () => {
    suiteSetup(async function () {
        if (!IS_SMOKE_TEST) {
            return this.skip();
        }
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Exec', async () => {
        // const file = path.join(
        //     EXTENSION_ROOT_DIR_FOR_TESTS,
        //     'src',
        //     'testMultiRootWkspc',
        //     'smokeTests',
        //     'testExecInTerminal.py'
        // );
        const outputFile = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            'testExecInTerminal.log'
        );
        if (await fs.pathExists(outputFile)) {
            await fs.unlink(outputFile);
        }
        // const textDocument = await openFile(file);

        // Wait here
        // await sleep(1_000);

        // await vscode.commands.executeCommand<void>('python.execInTerminal', textDocument.uri).then(undefined, (err) => {
        //     assert.fail(`Unhandled failure:  ${err}`);
        // });

        const checkIfFileHasBeenCreated = () => fs.pathExists(outputFile);
        await waitForCondition(checkIfFileHasBeenCreated, testTimeout, `"${outputFile}" file not created`);
    }).timeout(testTimeout);
});
