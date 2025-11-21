import * as vscode from 'vscode';
import * as path from 'path';
import { assert } from 'chai';
import * as fs from '../../client/common/platform/fs-paths';
import { EXTENSION_ROOT_DIR_FOR_TESTS, IS_SMOKE_TEST } from '../constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { openFile, waitForCondition } from '../common';

suite('Smoke Test: Run Smart Selection and Advance Cursor', async () => {
    suiteSetup(async function () {
        if (!IS_SMOKE_TEST) {
            return this.skip();
        }
        await initialize();
        return undefined;
    });

    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    test('Smart Send', async () => {
        const file = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            'create_delete_file.py',
        );
        const outputFile = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            'smart_send_smoke.txt',
        );

        console.log(`[smartSend.smoke] Test starting`);
        console.log(`[smartSend.smoke] Python file: ${file}`);
        console.log(`[smartSend.smoke] Output file: ${outputFile}`);
        console.log(`[smartSend.smoke] Python file exists: ${await fs.pathExists(file)}`);

        const outputFileExistsBefore = await fs.pathExists(outputFile);
        console.log(`[smartSend.smoke] Output file exists before cleanup: ${outputFileExistsBefore}`);
        await fs.remove(outputFile);
        console.log(`[smartSend.smoke] Output file removed`);

        const textDocument = await openFile(file);
        console.log(`[smartSend.smoke] File opened in editor`);
        console.log(`[smartSend.smoke] Document has ${textDocument.lineCount} lines`);
        console.log(`[smartSend.smoke] First 5 lines of file:`);
        for (let i = 0; i < Math.min(5, textDocument.lineCount); i++) {
            console.log(`[smartSend.smoke]   Line ${i}: ${textDocument.lineAt(i).text}`);
        }

        if (vscode.window.activeTextEditor) {
            const myPos = new vscode.Position(0, 0);
            vscode.window.activeTextEditor!.selections = [new vscode.Selection(myPos, myPos)];
            console.log(`[smartSend.smoke] Cursor set to position (0, 0)`);
            console.log(
                `[smartSend.smoke] Current selection: "${vscode.window.activeTextEditor.document.getText(
                    vscode.window.activeTextEditor.selection,
                )}"`,
            );

            // Wait a bit for the editor state to settle
            console.log(`[smartSend.smoke] Waiting 500ms for editor state to settle...`);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const terminalsBefore = vscode.window.terminals.length;
        console.log(`[smartSend.smoke] Number of terminals before execution: ${terminalsBefore}`);

        // On Windows, if there are existing terminals, wait a bit to ensure they're fully ready
        if (terminalsBefore > 0 && process.platform === 'win32') {
            console.log(`[smartSend.smoke] Waiting 3s for existing terminals to be ready on Windows...`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        const startTime = Date.now();
        console.log(
            `[smartSend.smoke] Executing first 'python.execSelectionInTerminal' command at ${new Date().toISOString()}`,
        );

        await vscode.commands
            .executeCommand<void>('python.execSelectionInTerminal', textDocument.uri)
            .then(undefined, (err) => {
                console.error(`[smartSend.smoke] First command failed: ${err}`);
                assert.fail(`Something went wrong running the Python file in the terminal: ${err}`);
            });
        const firstCmdTime = Date.now();
        console.log(`[smartSend.smoke] First command completed in ${firstCmdTime - startTime}ms`);

        const terminalsAfter = vscode.window.terminals.length;
        console.log(`[smartSend.smoke] Number of terminals after first execution: ${terminalsAfter}`);
        if (vscode.window.activeTerminal) {
            console.log(`[smartSend.smoke] Active terminal name: ${vscode.window.activeTerminal.name}`);
        }

        // Add additional wait to allow terminal to start processing
        // Windows may need more time for terminal to initialize and start executing
        const isWindows = process.platform === 'win32';
        const initialWaitTime = isWindows ? 2000 : 1000;
        console.log(
            `[smartSend.smoke] Waiting ${initialWaitTime}ms for terminal to start processing (isWindows: ${isWindows})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, initialWaitTime));

        // Verify the working directory matches expected
        const expectedDir = path.dirname(outputFile);
        console.log(`[smartSend.smoke] Expected output directory: ${expectedDir}`);
        console.log(`[smartSend.smoke] Directory exists: ${await fs.pathExists(expectedDir)}`);

        let checkCount = 0;
        const checkIfFileHasBeenCreated = async () => {
            checkCount++;
            const exists = await fs.pathExists(outputFile);
            if (checkCount % 100 === 0) {
                // Log every 100 checks (~1 second)
                const elapsed = Date.now() - startTime;
                console.log(`[smartSend.smoke] File creation check #${checkCount} at ${elapsed}ms: ${exists}`);
            }
            return exists;
        };

        try {
            await waitForCondition(checkIfFileHasBeenCreated, 20_000, `"${outputFile}" file not created`);
            const createTime = Date.now() - startTime;
            console.log(`[smartSend.smoke] SUCCESS: File created after ${createTime}ms (${checkCount} checks)`);
        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`[smartSend.smoke] FAILURE: File not created after ${totalTime}ms (${checkCount} checks)`);
            console.error(`[smartSend.smoke] Output file exists: ${await fs.pathExists(outputFile)}`);
            console.error(`[smartSend.smoke] Number of terminals: ${vscode.window.terminals.length}`);

            // List directory contents
            const dir = path.dirname(outputFile);
            try {
                const fsModule = await import('fs');
                const files = fsModule.readdirSync(dir);
                console.error(`[smartSend.smoke] Directory contents (${dir}):`, files);
            } catch (e) {
                console.error(`[smartSend.smoke] Failed to list directory: ${e}`);
            }

            throw error;
        }

        console.log(`[smartSend.smoke] Executing second 'python.execSelectionInTerminal' command`);
        await vscode.commands
            .executeCommand<void>('python.execSelectionInTerminal', textDocument.uri)
            .then(undefined, (err) => {
                console.error(`[smartSend.smoke] Second command failed: ${err}`);
                assert.fail(`Something went wrong running the Python file in the terminal: ${err}`);
            });
        console.log(`[smartSend.smoke] Second command completed`);

        console.log(`[smartSend.smoke] Executing third 'python.execSelectionInTerminal' command`);
        await vscode.commands
            .executeCommand<void>('python.execSelectionInTerminal', textDocument.uri)
            .then(undefined, (err) => {
                console.error(`[smartSend.smoke] Third command failed: ${err}`);
                assert.fail(`Something went wrong running the Python file in the terminal: ${err}`);
            });
        console.log(`[smartSend.smoke] Third command completed`);

        async function wait() {
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 10000);
            });
        }

        console.log(`[smartSend.smoke] Waiting 10s for file deletion to complete...`);
        await wait();

        const deletedFile = !(await fs.pathExists(outputFile));
        console.log(`[smartSend.smoke] File exists after deletion commands: ${!deletedFile}`);
        if (deletedFile) {
            console.log(`[smartSend.smoke] SUCCESS: File has been deleted as expected`);
            assert.ok(true, `"${outputFile}" file has been deleted`);
        } else {
            console.error(`[smartSend.smoke] FAILURE: File still exists`);
            assert.fail(`"${outputFile}" file still exists`);
        }
    });
});
