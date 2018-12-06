'use strict';
// tslint:disable:max-func-body-length no-invalid-this no-any

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { ENV_PATHS_LOCATION } from '../test/ciConstants';
import { PYTHON_PATH, setPythonPathInWorkspaceRoot, updateSetting, waitForCondition } from '../test/common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../test/constants';
import { sleep } from '../test/core';
import { initialize, initializeTest } from '../test/initialize';

suite('Activation of Environments in Terminal', () => {
    const file = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.py');
    const outputFile = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.log');
    const envPathsLocation = ENV_PATHS_LOCATION !== undefined ?
                            ENV_PATHS_LOCATION : path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testVirtualEnv', 'envPaths.json');
    const envPaths = fs.readJsonSync(envPathsLocation);
    suiteSetup(initialize);
    setup(async () => {
        await initializeTest();
        await cleanUp();
    });
    teardown(cleanUp);
    suiteTeardown(revertSettings);
    async function revertSettings() {
        await updateSetting('terminal.activateEnvironment', false , vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
    }
    async function cleanUp() {
        if (await fs.pathExists(outputFile)) {
            await fs.unlink(outputFile);
        }
    }
    test('Should not activate', async () => {
        await updateSetting('terminal.activateEnvironment', false, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        const terminal = vscode.window.createTerminal();
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');
        expect(content).to.not.equal(PYTHON_PATH);
    });
    test('Should activate with venv', async () => {
        await updateSetting('terminal.activateEnvironment', true, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await setPythonPathInWorkspaceRoot(envPaths['venv']);
        const terminal = vscode.window.createTerminal();
        await sleep(5000);
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');

        expect(content).to.equal(envPaths['venv']);
    });
    test('Should activate with pipenv', async () => {
        await updateSetting('terminal.activateEnvironment', true, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await setPythonPathInWorkspaceRoot(envPaths['pipenv']);
        const terminal = vscode.window.createTerminal();
        await sleep(5000);
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');

        expect(content).to.equal(envPaths['pipenv']);
    });
    test('Should activate with virtualenv', async () => {
        await updateSetting('terminal.activateEnvironment', true, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await setPythonPathInWorkspaceRoot(envPaths['virtualenv']);
        const terminal = vscode.window.createTerminal();
        await sleep(5000);
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');

        expect(content).to.equal(envPaths['virtualenv']);
    });
    test('Should activate with conda', async () => {
        await updateSetting('terminal.activateEnvironment', true, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await setPythonPathInWorkspaceRoot(envPaths['conda']);
        const terminal = vscode.window.createTerminal();
        await sleep(5000);
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');

        expect(content).to.equal(envPaths['conda']);
    });
});
