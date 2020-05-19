// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { openFile } from '../../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST, TEST_DEBUGGER } from '../../../initialize';
import { DebuggerFixture } from '../../utils';

const WS_ROOT = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test');

function resolveWSFile(wsRoot: string, ...filePath: string[]): string {
    return path.join(wsRoot, ...filePath);
}

suite('Debugger Integration', () => {
    const file = resolveWSFile(WS_ROOT, 'pythonFiles', 'debugging', 'wait_for_file.py');
    const doneFile = resolveWSFile(WS_ROOT, 'should-not-exist');
    const outFile = resolveWSFile(WS_ROOT, 'output.txt');
    const resource = vscode.Uri.file(file);
    const defaultScriptArgs = [doneFile];
    let workspaceRoot: vscode.WorkspaceFolder;
    let fix: DebuggerFixture;
    suiteSetup(async function () {
        if (IS_MULTI_ROOT_TEST || !TEST_DEBUGGER) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
        const ws = vscode.workspace.getWorkspaceFolder(resource);
        workspaceRoot = ws!;
        expect(workspaceRoot).to.not.equal(undefined, 'missing workspace root');
    });
    setup(async () => {
        fix = new DebuggerFixture();
        await initializeTest();
        await openFile(file);
    });
    teardown(async () => {
        await fix.cleanUp();
        fix.addFSCleanup(outFile);
        await closeActiveWindows();
    });
    async function setDone() {
        await fs.writeFile(doneFile, '');
        fix.addFSCleanup(doneFile);
    }

    type ConfigName = string;
    type ScriptArgs = string[];
    const tests: { [key: string]: [ConfigName, ScriptArgs] } = {
        // prettier-ignore
        'launch': ['launch a file', [...defaultScriptArgs, outFile]],
        // prettier-ignore
        'attach': ['attach to a local port', defaultScriptArgs]
        // We are starting with just launch and attach...
        //'attach to PID': ['attach to a local PID', defaultScriptArgs]
        // For now we do not worry about "test" debugging.
    };

    suite('run to end', () => {
        for (const kind of Object.keys(tests)) {
            const [configName, scriptArgs] = tests[kind];
            test(kind, async () => {
                const session = fix.resolveDebugger(configName, file, scriptArgs, workspaceRoot);
                // Un-comment this to see the debug config used here:
                //console.log('|', session.config, '|');
                await session.start();
                // Any debugger ops would go here.
                await new Promise((r) => setTimeout(r, 300)); // 0.3 seconds
                await setDone();
                const result = await session.waitUntilDone();

                expect(result.exitCode).to.equal(0, 'bad exit code');
                const output = result.stdout !== '' ? result.stdout : fs.readFileSync(outFile).toString();
                expect(output.trim().endsWith('done!')).to.equal(true, `bad output\n${output}`);
            });
        }
    });
});
