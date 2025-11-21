// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from '../../client/common/platform/fs-paths';
import { openFile, waitForCondition } from '../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, IS_SMOKE_TEST } from '../constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';

suite('Smoke Test: Run Python File In Terminal', () => {
    suiteSetup(async function () {
        if (!IS_SMOKE_TEST) {
            return this.skip();
        }
        await initialize();
        // Ensure the environments extension is not used for this test
        await vscode.workspace
            .getConfiguration('python')
            .update('useEnvironmentsExtension', false, vscode.ConfigurationTarget.Global);
        return undefined;
    });

    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Exec', async () => {
        const file = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            'testExecInTerminal.py',
        );
        const outputFile = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            'testExecInTerminal.log',
        );

        console.log(`[runInTerminal.smoke] Test starting`);
        console.log(`[runInTerminal.smoke] Python file: ${file}`);
        console.log(`[runInTerminal.smoke] Output file: ${outputFile}`);
        console.log(`[runInTerminal.smoke] Python file exists: ${await fs.pathExists(file)}`);

        if (await fs.pathExists(outputFile)) {
            console.log(`[runInTerminal.smoke] Output file already exists, deleting...`);
            await fs.unlink(outputFile);
            console.log(`[runInTerminal.smoke] Output file deleted`);
        } else {
            console.log(`[runInTerminal.smoke] Output file does not exist (clean state)`);
        }

        const textDocument = await openFile(file);
        console.log(`[runInTerminal.smoke] File opened in editor`);

        // Check active terminals before execution
        const terminalsBefore = vscode.window.terminals.length;
        console.log(`[runInTerminal.smoke] Number of terminals before execution: ${terminalsBefore}`);

        // On Windows, if there are existing terminals, wait a bit to ensure they're fully ready
        if (terminalsBefore > 0 && process.platform === 'win32') {
            console.log(`[runInTerminal.smoke] Waiting 2s for existing terminals to be ready on Windows...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const startTime = Date.now();
        console.log(`[runInTerminal.smoke] Executing 'python.execInTerminal' command at ${new Date().toISOString()}`);

        await vscode.commands.executeCommand<void>('python.execInTerminal', textDocument.uri).then(undefined, (err) => {
            console.error(`[runInTerminal.smoke] Command failed with error: ${err}`);
            assert.fail(`Something went wrong running the Python file in the terminal: ${err}`);
        });
        const commandCompleteTime = Date.now();
        console.log(`[runInTerminal.smoke] Command completed in ${commandCompleteTime - startTime}ms`);

        // Check active terminals after execution
        const terminalsAfter = vscode.window.terminals.length;
        console.log(`[runInTerminal.smoke] Number of terminals after execution: ${terminalsAfter}`);
        if (vscode.window.activeTerminal) {
            console.log(`[runInTerminal.smoke] Active terminal name: ${vscode.window.activeTerminal.name}`);
        }

        // Add additional wait to allow terminal to start processing
        // Windows may need more time for terminal to initialize and start executing
        const isWindows = process.platform === 'win32';
        const initialWaitTime = isWindows ? 2000 : 1000;
        console.log(
            `[runInTerminal.smoke] Waiting ${initialWaitTime}ms for terminal to start processing (isWindows: ${isWindows})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, initialWaitTime));

        // Verify the working directory matches expected
        const expectedDir = path.dirname(outputFile);
        console.log(`[runInTerminal.smoke] Expected output directory: ${expectedDir}`);
        console.log(`[runInTerminal.smoke] Directory exists: ${await fs.pathExists(expectedDir)}`);

        let checkCount = 0;
        const checkIfFileHasBeenCreated = async () => {
            checkCount++;
            const exists = await fs.pathExists(outputFile);
            if (checkCount % 100 === 0) {
                // Log every 100 checks (~1 second)
                const elapsed = Date.now() - startTime;
                console.log(`[runInTerminal.smoke] File check #${checkCount} at ${elapsed}ms: ${exists}`);
            }
            return exists;
        };

        try {
            await waitForCondition(checkIfFileHasBeenCreated, 30_000, `"${outputFile}" file not created`);
            const totalTime = Date.now() - startTime;
            console.log(`[runInTerminal.smoke] SUCCESS: File created after ${totalTime}ms (${checkCount} checks)`);
        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`[runInTerminal.smoke] FAILURE after ${totalTime}ms (${checkCount} checks)`);
            console.error(`[runInTerminal.smoke] Output file exists: ${await fs.pathExists(outputFile)}`);
            console.error(`[runInTerminal.smoke] Number of terminals: ${vscode.window.terminals.length}`);

            // List directory contents to see if file is there
            const dir = path.dirname(outputFile);
            try {
                const fsModule = await import('fs');
                const files = fsModule.readdirSync(dir);
                console.error(`[runInTerminal.smoke] Directory contents (${dir}):`, files);
            } catch (e) {
                console.error(`[runInTerminal.smoke] Failed to list directory: ${e}`);
            }

            throw error;
        }
    });
});
