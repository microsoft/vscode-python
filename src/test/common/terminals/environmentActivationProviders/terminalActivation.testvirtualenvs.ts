// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { PYTHON_VIRTUAL_ENVS_LOCATION } from '../../../ciConstants';
import { PYTHON_PATH, restorePythonPathInWorkspaceRoot, setPythonPathInWorkspaceRoot, updateSetting, waitForCondition } from '../../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { sleep } from '../../../core';
import { initialize, initializeTest } from '../../../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Activation of Environments in Terminal', () => {
    const file = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.py');
    const outputFile = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.log');
    const envsLocation = PYTHON_VIRTUAL_ENVS_LOCATION !== undefined ?
        path.join(EXTENSION_ROOT_DIR_FOR_TESTS, PYTHON_VIRTUAL_ENVS_LOCATION) : path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'tmp', 'envPaths.json');
    const waitTimeForActivation = 5000;
    type EnvPath = {
        condaExecPath: string;
        condaPath: string;
        venvPath: string;
        pipenvPath: string;
        virtualEnvPath: string;
    };
    let envPaths: EnvPath;
    const defaultShell = {
        Windows: '',
        Linux: '',
        MacOS: ''
    };
    let terminalSettings;
    let pythonSettings;
    suiteSetup(async () => {
        envPaths = await fs.readJson(envsLocation);
        terminalSettings = vscode.workspace.getConfiguration('terminal', vscode.workspace.workspaceFolders[0].uri);
        pythonSettings = vscode.workspace.getConfiguration('python', vscode.workspace.workspaceFolders[0].uri);
        defaultShell.Windows = terminalSettings.inspect('integrated.shell.windows').globalValue;
        defaultShell.Linux = terminalSettings.inspect('integrated.shell.linux').globalValue;
        await terminalSettings.update('integrated.shell.linux', '/bin/bash', vscode.ConfigurationTarget.Global);
        await initialize();
    });
    setup(async () => {
        await initializeTest();
        await cleanUp();
    });
    teardown(cleanUp);
    suiteTeardown(revertSettings);
    async function revertSettings() {
        await updateSetting('terminal.activateEnvironment', undefined, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await terminalSettings.update('integrated.shell.windows', defaultShell.Windows, vscode.ConfigurationTarget.Global);
        await terminalSettings.update('integrated.shell.linux', defaultShell.Linux, vscode.ConfigurationTarget.Global);
        await pythonSettings.update('condaPath', undefined, vscode.ConfigurationTarget.Workspace);
        await restorePythonPathInWorkspaceRoot();
    }
    async function cleanUp() {
        if (await fs.pathExists(outputFile)) {
            await fs.unlink(outputFile);
        }
    }

    async function testActivation(envPath) {
        await updateSetting('terminal.activateEnvironment', true, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await setPythonPathInWorkspaceRoot(envPath);
        const terminal = vscode.window.createTerminal();
        await sleep(waitTimeForActivation);
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');
        expect(content).to.equal(envPath);
    }
    async function testNonActivation() {
        await updateSetting('terminal.activateEnvironment', false, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        const terminal = vscode.window.createTerminal();
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');
        expect(content).to.not.equal(PYTHON_PATH);
    }
    test('Should not activate', async () => {
        await testNonActivation();
    });
    test('Should activate with venv', async () => {
        await testActivation(envPaths.venvPath);
    });
    test('Should activate with pipenv', async () => {
        await testActivation(envPaths.pipenvPath);
    });
    test('Should activate with virtualenv', async () => {
        await testActivation(envPaths.virtualEnvPath);
    });
    test('Should activate with conda', async () => {
        await terminalSettings.update('integrated.shell.windows', 'C:\\Windows\\System32\\cmd.exe', vscode.ConfigurationTarget.Global);
        await pythonSettings.update('condaPath', envPaths.condaExecPath, vscode.ConfigurationTarget.Workspace);
        await testActivation(envPaths.condaPath);
    });
});
