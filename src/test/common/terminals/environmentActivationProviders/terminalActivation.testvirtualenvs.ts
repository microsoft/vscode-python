'use strict';
// tslint:disable:max-func-body-length no-invalid-this no-any

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { ENV_PATHS_LOCATION } from '../../../ciConstants';
import { PYTHON_PATH, restorePythonPathInWorkspaceRoot, setPythonPathInWorkspaceRoot, updateSetting, waitForCondition } from '../../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { sleep } from '../../../core';
import { initialize, initializeTest } from '../../../initialize';

suite('Activation of Environments in Terminal', () => {
    const file = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.py');
    const outputFile = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'smokeTests', 'testExecInTerminal.log');
    const envPathsLocation = ENV_PATHS_LOCATION !== undefined ?
                                path.join(EXTENSION_ROOT_DIR_FOR_TESTS, ENV_PATHS_LOCATION) : path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'tmp', 'envPaths.json');
    const waitTimeForActivation = 5000;
    type EnvPath = {
        venvPath: string;
        pipenvPath: string;
        virtualEnvPath: string;
    };
    let envPaths: EnvPath;
    suiteSetup(async () => {
        envPaths = await fs.readJson(envPathsLocation);
        await initialize();
    });
    setup(async () => {
        await initializeTest();
        await cleanUp();
    });
    teardown(cleanUp);
    suiteTeardown(revertSettings);
    async function revertSettings() {
        await updateSetting('terminal.activateEnvironment', undefined , vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await restorePythonPathInWorkspaceRoot();
    }
    async function cleanUp() {
        if (await fs.pathExists(outputFile)) {
            await fs.unlink(outputFile);
        }
    }
    async function testActivation(envPath){
        await updateSetting('terminal.activateEnvironment', true, vscode.workspace.workspaceFolders[0].uri, vscode.ConfigurationTarget.WorkspaceFolder);
        await setPythonPathInWorkspaceRoot(envPath);
        const terminal = vscode.window.createTerminal();
        await sleep(waitTimeForActivation);
        terminal.sendText(`python ${file}`, true);
        await waitForCondition(() => fs.pathExists(outputFile), 5_000, '\'testExecInTerminal.log\' file not created');
        const content = await fs.readFile(outputFile, 'utf-8');

        expect(content).to.equal(envPath);
    }
    async function testNonActivation(){
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
});
